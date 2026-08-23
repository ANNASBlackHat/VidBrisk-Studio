/**
 * Smoke test: renders SwipeDeck and ChatBubbles end-to-end through
 * scripts/render_video.mjs to verify full Remotion rendering.
 *
 * Usage: node scripts/smoke_list_reveal_render.mjs [--keep]
 */
import { execFileSync } from "child_process";
import { mkdtempSync, writeFileSync, existsSync, statSync, rmSync } from "fs";
import { tmpdir } from "os";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const KEEP = process.argv.includes("--keep");

const workDir = mkdtempSync(path.join(tmpdir(), "list-reveal-smoke-"));
const die = (msg) => {
  console.error(`❌ ${msg}`);
  if (!KEEP) rmSync(workDir, { recursive: true, force: true });
  process.exit(1);
};

// Project with 2 blocks:
// Block 1 (0-4s): SwipeDeck (3 items)
// Block 2 (4-8s): ChatBubbles (3 messages)
const state = {
  jobId: "smoke-list-reveal-job",
  fps: 30,
  totalDuration: 8,
  width: 1280,
  height: 720,
  orientation: "horizontal",
  selectedClipId: null,
  tracks: [
    {
      id: "video",
      label: "Visuals & Motion Graphics",
      type: "video",
      items: [
        {
          id: "block1_swipe",
          trackId: "video",
          trackStart: 0,
          trackEnd: 4,
          duration: 4,
          assetType: "motion",
          componentId: "ListAnimations/SwipeDeck",
          props: {
            items: [
              "1. Autonomous Agent Setup",
              "2. High Performance Video Pipeline",
              "3. Seamless Multi-layer Compositing",
            ],
            title: "EXECUTION PHASES",
            themeColor: "#38bdf8",
          },
          content: "Execution Phases",
          zIndex: 0,
          layoutRole: "full",
        },
        {
          id: "block2_chat",
          trackId: "video",
          trackStart: 4,
          trackEnd: 8,
          duration: 4,
          assetType: "motion",
          componentId: "ListAnimations/ChatBubbles",
          props: {
            messages: [
              { text: "System check completed. All pipelines ready.", sender: "system" },
              { text: "Deploying latest motion templates now.", sender: "user" },
              { text: "Render successful. Output verified.", sender: "system" },
            ],
            title: "MISSION STATUS LOG",
            themeColor: "#3b82f6",
          },
          content: "Mission Status Log",
          zIndex: 0,
          layoutRole: "full",
        },
      ],
    },
    { id: "text", label: "Captions & Titles", type: "text", items: [] },
    { id: "audio", label: "Voiceover Track", type: "audio", items: [] },
  ],
};

const statePath = path.join(workDir, "state.json");
writeFileSync(statePath, JSON.stringify(state, null, 2));

const outPath = path.join(workDir, "smoke-list-reveal.mp4");
console.log("[Smoke] Rendering list-reveal motion project via render_video.mjs --state ...");

let exitCode = 0;
try {
  execFileSync("node", [path.join(rootDir, "scripts", "render_video.mjs"), "--state", statePath, "--out", outPath], {
    cwd: rootDir,
    stdio: ["ignore", "inherit", "inherit"],
    timeout: 15 * 60 * 1000,
  });
} catch (err) {
  exitCode = err.status ?? 1;
}

if (exitCode !== 0) die(`render_video.mjs exited with code ${exitCode}`);
if (!existsSync(outPath)) die("Output MP4 was not created");

const sizeMb = statSync(outPath).size / (1024 * 1024);
if (sizeMb < 0.02) die(`Output suspiciously small (${sizeMb.toFixed(3)} MB)`);

// Extract probe frames: t=2s (SwipeDeck), t=6s (ChatBubbles)
for (const t of [2, 6]) {
  const frame = path.join(workDir, `frame_t${t}.png`);
  execFileSync("ffmpeg", ["-y", "-ss", String(t), "-i", outPath, "-frames:v", "1", frame]);
  console.log(`[Smoke] 📸 frame @${t}s -> ${frame}`);
}

console.log(`[Smoke] ✅ PASS — list reveal components rendered (${sizeMb.toFixed(2)} MB): ${outPath}`);
if (!KEEP) rmSync(workDir, { recursive: true, force: true });
