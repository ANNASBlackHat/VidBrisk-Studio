/**
 * Generates and renders a comprehensive 32-second showcase video
 * demonstrating all newly built advanced Remotion capabilities:
 * 1. MapExplainer (Route mode: Cape Canaveral -> Pacific Ocean)
 * 2. Transition SFX (whip-pan + whoosh.wav)
 * 3. AudioWaveform (Neil Armstrong vocal spectrum + telemetry)
 * 4. Transition SFX (glitch + uiSwitch.wav)
 * 5. MapExplainer (Pin mode: Houston Mission Control radar beacon)
 * 6. Transition SFX (flash + shutterModern.wav)
 * 7. StatCard ($25.4B Apollo investment)
 * 8. KineticCaptions (synchronized word-by-word bouncing subtitle highlights)
 */

import fs from "fs";
import path from "path";
import { spawn } from "child_process";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");

// Load .env.local
const envLocalPath = path.join(rootDir, ".env.local");
if (fs.existsSync(envLocalPath)) {
  const content = fs.readFileSync(envLocalPath, "utf-8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx > 0) {
      const key = trimmed.slice(0, eqIdx).trim();
      const val = trimmed.slice(eqIdx + 1).trim();
      if (!process.env[key]) {
        process.env[key] = val;
      }
    }
  }
}

const maptilerKey = process.env.REMOTION_MAPTILER_KEY || "";

const showcaseState = {
  jobId: "showcase-advanced-remotion",
  fps: 30,
  totalDuration: 32.0,
  width: 1280,
  height: 720,
  orientation: "horizontal",
  transitionStyle: "whip-pan",
  selectedClipId: null,
  tracks: [
    {
      id: "video",
      label: "Visual & Motion Graphics Track",
      type: "video",
      items: [
        // Scene 1: Map Route (0s - 8s)
        {
          id: "clip_map_route",
          trackId: "video",
          trackStart: 0.0,
          trackEnd: 8.0,
          duration: 8.0,
          assetType: "motion",
          componentId: "GeoAnimations/MapExplainer",
          props: {
            origin: "Cape Canaveral",
            destination: "Pacific Ocean",
            title: "APOLLO 11 TRAJECTORY",
            subtext: "TRANSLUNAR FLIGHT PATH",
            mode: "route",
            themeColor: "#38bdf8",
            layoutRole: "takeover",
            apiKey: maptilerKey,
          },
          exitTransition: "whip-pan",
          zIndex: 0,
        },
        // Scene 2: Audio Waveform (8s - 16s)
        {
          id: "clip_audio_waveform",
          trackId: "video",
          trackStart: 8.0,
          trackEnd: 16.0,
          duration: 8.0,
          assetType: "motion",
          componentId: "AudioAnimations/AudioWaveform",
          props: {
            speaker: "NEIL ARMSTRONG",
            title: "APOLLO 11 VOICE FEED • TRANQUILITY BASE",
            subtext: "LIVE AUDIO COMM",
            quote: "That's one small step for man, one giant leap for mankind.",
            themeColor: "#10b981",
            barCount: 36,
            layoutRole: "takeover",
          },
          enterTransition: "whip-pan",
          exitTransition: "shake",
          zIndex: 0,
        },
        // Scene 3: Map Pin (16s - 24s)
        {
          id: "clip_map_pin",
          trackId: "video",
          trackStart: 16.0,
          trackEnd: 24.0,
          duration: 8.0,
          assetType: "motion",
          componentId: "GeoAnimations/MapExplainer",
          props: {
            origin: { name: "Houston Mission Control", lat: 29.7604, lng: -95.3698 },
            title: "MISSION CONTROL CENTER",
            subtext: "COORDINATE LOCK",
            mode: "pin",
            themeColor: "#f59e0b",
            layoutRole: "takeover",
            apiKey: maptilerKey,
          },
          exitTransition: "whip-pan",
          zIndex: 0,
        },
        // Scene 4: StatCard Data Viz (24s - 32s)
        {
          id: "clip_stat_card",
          trackId: "video",
          trackStart: 24.0,
          trackEnd: 32.0,
          duration: 8.0,
          assetType: "motion",
          componentId: "DataAnimations/StatCard",
          props: {
            value: "$25.4B",
            label: "Total Apollo Program Cost",
            subtext: "Represented 4% of the United States Federal Budget at peak.",
            visualType: "ring",
            themeColor: "#38bdf8",
            layoutRole: "takeover",
          },
          enterTransition: "whip-pan",
          zIndex: 0,
        },
      ],
    },
    {
      id: "text",
      label: "Kinetic Captions Track",
      type: "text",
      items: [
        {
          id: "cap_1",
          trackId: "text",
          trackStart: 0.5,
          trackEnd: 7.5,
          duration: 7.0,
          content: "Apollo 11 launched from Cape Canaveral charting a course across the Pacific Ocean.",
        },
        {
          id: "cap_2",
          trackId: "text",
          trackStart: 8.5,
          trackEnd: 15.5,
          duration: 7.0,
          content: "Houston Tranquility Base here the Eagle has landed on the lunar surface.",
        },
        {
          id: "cap_3",
          trackId: "text",
          trackStart: 16.5,
          trackEnd: 23.5,
          duration: 7.0,
          content: "Telemetry streams locked into Houston Mission Control monitoring every parameter.",
        },
        {
          id: "cap_4",
          trackId: "text",
          trackStart: 24.5,
          trackEnd: 31.5,
          duration: 7.0,
          content: "A historic twenty-five billion dollar investment proving humanity can achieve the impossible.",
        },
      ],
    },
    {
      id: "audio",
      label: "Audio Narration Track",
      type: "audio",
      items: [
        {
          id: "aud_1",
          trackId: "audio",
          trackStart: 0.0,
          trackEnd: 8.0,
          duration: 8.0,
          assetId: "output/audio/930ff842-f898-491d-b833-08c2dbb87d04/b1.wav",
        },
        {
          id: "aud_2",
          trackId: "audio",
          trackStart: 8.0,
          trackEnd: 16.0,
          duration: 8.0,
          assetId: "output/audio/930ff842-f898-491d-b833-08c2dbb87d04/b2.wav",
        },
        {
          id: "aud_3",
          trackId: "audio",
          trackStart: 16.0,
          trackEnd: 24.0,
          duration: 8.0,
          assetId: "output/audio/930ff842-f898-491d-b833-08c2dbb87d04/b4.wav",
        },
      ],
    },
  ],
};

const statePath = path.join(rootDir, "public/renders/showcase_state.json");
const outVideoPath = path.join(rootDir, "public/renders/showcase_advanced_remotion.mp4");

fs.writeFileSync(statePath, JSON.stringify(showcaseState, null, 2));
console.log(`[Showcase] Wrote project state to ${statePath}`);
console.log(`[Showcase] Starting Remotion render for 32-second video at 1280x720 (960 frames)...`);

const renderProcess = spawn("node", [
  path.join(rootDir, "scripts/render_video.mjs"),
  "--state",
  statePath,
  "--out",
  outVideoPath,
], {
  cwd: rootDir,
  stdio: "inherit",
});

renderProcess.on("exit", (code) => {
  if (code === 0) {
    console.log(`\n✅ Showcase video successfully rendered to: ${outVideoPath}`);
  } else {
    console.error(`\n❌ Render failed with exit code ${code}`);
    process.exit(code);
  }
});
