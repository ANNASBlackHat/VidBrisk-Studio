/**
 * Phase 5 smoke test: renders a layered EditorProjectState end-to-end through
 * scripts/render_video.mjs (--state path — same one /api/render uses).
 *
 * Generates small synthetic MP4s with ffmpeg so real <Video> elements decode,
 * then verifies the exported file exists and extracts preview frames.
 *
 * Usage: node scripts/smoke_layered_render.mjs [--keep]
 */
import { execFileSync } from "child_process";
import { mkdtempSync, writeFileSync, existsSync, statSync, rmSync } from "fs";
import { tmpdir } from "os";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const KEEP = process.argv.includes("--keep");

const workDir = mkdtempSync(path.join(tmpdir(), "layered-smoke-"));
const die = (msg) => {
  console.error(`❌ ${msg}`);
  if (!KEEP) rmSync(workDir, { recursive: true, force: true });
  process.exit(1);
};

function makeColorClip(name, color, seconds = 4) {
  const out = path.join(workDir, `${name}.mp4`);
  execFileSync("ffmpeg", [
    "-y",
    "-f", "lavfi",
    "-i", `color=c=${color}:s=640x360:r=30:d=${seconds}`,
    "-c:v", "libx264",
    "-pix_fmt", "yuv420p",
    out,
  ]);
  return out;
}

console.log("[Smoke] Generating synthetic footage...");
const redClip = makeColorClip("red", "red");
const blueClip = makeColorClip("blue", "blue");
const greenClip = makeColorClip("green", "green");

// Layered project: b1 = split_screen (two footage halves),
// b2 = stat_over_footage (full footage + StatCard overlay).
const state = {
  jobId: "smoke-layered-job",
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
          id: "b1_layer0",
          trackId: "video",
          trackStart: 0,
          trackEnd: 4,
          duration: 4,
          assetType: "video",
          sourceIn: 0,
          sourceOut: 4,
          storageUrl: redClip,
          zIndex: 0,
          layoutRole: "split-left",
        },
        {
          id: "b1_layer1",
          trackId: "video",
          trackStart: 0,
          trackEnd: 4,
          duration: 4,
          assetType: "video",
          sourceIn: 0,
          sourceOut: 4,
          storageUrl: blueClip,
          zIndex: 1,
          layoutRole: "split-right",
        },
        {
          id: "b2_layer0",
          trackId: "video",
          trackStart: 4,
          trackEnd: 8,
          duration: 4,
          assetType: "video",
          sourceIn: 0,
          sourceOut: 4,
          storageUrl: greenClip,
          zIndex: 0,
          layoutRole: "full",
        },
        {
          id: "b2_layer1",
          trackId: "video",
          trackStart: 4,
          trackEnd: 8,
          duration: 4,
          assetType: "motion",
          componentId: "DataAnimations/StatCard",
          props: {
            primary_value: "$25.4B",
            kicker: "PROGRAM INVESTMENT",
            visual_type: "chart",
            subtext: "$25.4 billion invested in modernization",
            themeColor: "#38bdf8",
          },
          content: "$25.4 billion invested in modernization",
          zIndex: 1,
          layoutRole: "overlay-lower-third",
        },
      ],
    },
    { id: "text", label: "Captions & Titles", type: "text", items: [] },
    { id: "audio", label: "Voiceover Track", type: "audio", items: [] },
  ],
};

const statePath = path.join(workDir, "state.json");
writeFileSync(statePath, JSON.stringify(state, null, 2));

const outPath = path.join(workDir, "smoke-layered.mp4");
console.log("[Smoke] Rendering layered project via render_video.mjs --state ...");

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

// Extract probe frames: t=2s must show the split (red|blue), t=5s the StatCard over green.
for (const t of [2, 5]) {
  const frame = path.join(workDir, `frame_t${t}.png`);
  execFileSync("ffmpeg", ["-y", "-ss", String(t), "-i", outPath, "-frames:v", "1", frame]);
  console.log(`[Smoke] 📸 frame @${t}s -> ${frame}`);
}

console.log(`[Smoke] ✅ PASS — layered export rendered (${sizeMb.toFixed(2)} MB): ${outPath}`);
console.log(`[Smoke] Work dir: ${workDir}${KEEP ? " (kept)" : ""}`);
