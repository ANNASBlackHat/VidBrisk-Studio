import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
import { enableTailwind } from "@remotion/tailwind";
import path from "path";
import fs from "fs";
import os from "os";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");

const args = process.argv.slice(2);
let stateFile = "";
let timelineFile = "";
let outFile = "";

for (let i = 0; i < args.length; i++) {
  if (args[i] === "--state" && args[i + 1]) {
    stateFile = args[i + 1];
    i++;
  } else if (args[i] === "--timeline" && args[i + 1]) {
    timelineFile = args[i + 1];
    i++;
  } else if (args[i] === "--out" && args[i + 1]) {
    outFile = args[i + 1];
    i++;
  }
}

let state;
if (timelineFile && fs.existsSync(timelineFile)) {
  console.log(`[Remotion] Loading timeline JSON from: ${timelineFile}`);
  const timeline = JSON.parse(fs.readFileSync(timelineFile, "utf-8"));
  
  // Convert TimelineJSON to EditorProjectState
  const fps = 30;
  const totalDuration = timeline.total_duration || 10;
  const width = 1920;
  const height = 1080;
  const videoItems = [];
  const textItems = [];
  const audioItems = [];

  for (const track of timeline.tracks || []) {
    if (track.type === "video") {
      for (const item of track.items || []) {
        const dur = Math.max(0.1, (item.trackEnd || 0) - (item.trackStart || 0));
        videoItems.push({
          id: item.id,
          trackId: "video",
          trackStart: item.trackStart || 0,
          trackEnd: item.trackEnd || (item.trackStart || 0) + dur,
          duration: dur,
          assetType: item.assetType || "video",
          assetId: item.assetId,
          sourceIn: item.sourceIn || 0,
          sourceOut: item.sourceOut || dur,
          storagePath: item.storagePath,
          storageUrl: item.storageUrl || item.storagePath,
          componentId: item.componentId,
          props: item.props || {},
          rawContent: item.rawContent,
          style: item.style,
        });
      }
    } else if (track.type === "text") {
      for (const item of track.items || []) {
        const dur = Math.max(0.1, (item.trackEnd || 0) - (item.trackStart || 0));
        const isMotion = item.style === "stat-callout" || item.style === "abstract-card" || item.id.includes("motion") || Boolean(item.componentId);
        if (isMotion) {
          videoItems.push({
            id: item.id.replace("txt_", "motion_"),
            trackId: "video",
            trackStart: item.trackStart || 0,
            trackEnd: item.trackEnd || (item.trackStart || 0) + dur,
            duration: dur,
            assetType: "motion",
            componentId: item.componentId || (item.style === "stat-callout" ? "DataAnimations/StatCard" : "TextAnimations/QuoteCard"),
            props: item.props || {},
            rawContent: item.content,
            style: item.style,
          });
        } else {
          textItems.push({
            id: item.id,
            trackId: "text",
            trackStart: item.trackStart || 0,
            trackEnd: item.trackEnd || (item.trackStart || 0) + dur,
            duration: dur,
            content: item.content,
            style: item.style,
          });
        }
      }
    } else if (track.type === "audio") {
      for (const item of track.items || []) {
        const dur = Math.max(0.1, (item.trackEnd || 0) - (item.trackStart || 0));
        audioItems.push({
          id: item.id,
          trackId: "audio",
          trackStart: item.trackStart || 0,
          trackEnd: item.trackEnd || (item.trackStart || 0) + dur,
          duration: dur,
          assetId: item.assetId,
        });
      }
    }
  }

  state = {
    jobId: timeline.metadata?.job_id || "cli-job",
    fps,
    totalDuration,
    width,
    height,
    orientation: "horizontal",
    tracks: [
      { id: "video", label: "Visuals", type: "video", items: videoItems },
      { id: "text", label: "Captions", type: "text", items: textItems },
      { id: "audio", label: "Voiceover", type: "audio", items: audioItems },
    ],
    selectedClipId: null,
  };
} else if (stateFile && fs.existsSync(stateFile)) {
  state = JSON.parse(fs.readFileSync(stateFile, "utf-8"));
} else {
  console.error("Error: Missing or invalid --state or --timeline file path");
  process.exit(1);
}

if (!outFile) {
  outFile = path.join(rootDir, "public", "renders", `render-${Date.now()}.mp4`);
} else {
  outFile = path.resolve(outFile);
}

fs.mkdirSync(path.dirname(outFile), { recursive: true });

console.log("[Remotion] Bundling composition entrypoint with Tailwind & path aliases...");
const bundleLocation = await bundle({
  entryPoint: path.join(rootDir, "src", "remotion", "index.tsx"),
  webpackOverride: (config) => {
    return enableTailwind({
      ...config,
      resolve: {
        ...(config.resolve || {}),
        alias: {
          ...(config.resolve?.alias || {}),
          "@": path.join(rootDir, "src"),
        },
      },
    });
  },
});

console.log("[Remotion] Selecting VideoExport composition...");
const composition = await selectComposition({
  serveUrl: bundleLocation,
  id: "VideoExport",
  inputProps: {
    projectState: state,
  },
});

console.log(
  `[Remotion] Rendering ${composition.durationInFrames} frames (${composition.width}x${composition.height} @ ${composition.fps}fps)...`
);

let lastLog = 0;
const result = await renderMedia({
  composition,
  serveUrl: bundleLocation,
  codec: "h264",
  audioCodec: "aac",
  outputLocation: outFile,
  overwrite: true,
  timeoutInMilliseconds: 300000,
  inputProps: {
    projectState: state,
  },
  onProgress: ({ renderedFrames, progress }) => {
    const now = Date.now();
    if (now - lastLog > 1000 || renderedFrames === composition.durationInFrames) {
      lastLog = now;
      const pct = Math.round(progress * 100);
      console.log(`[Remotion] 🎬 Rendering frame ${renderedFrames}/${composition.durationInFrames} (${pct}%)`);
    }
  },
  imageFormat: "jpeg",
  concurrency: Math.max(2, Math.min(6, os.cpus().length || 4)),
});

console.log(`[Remotion] ✅ Video render complete: ${outFile}`);
