import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
import { enableTailwind } from "@remotion/tailwind";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");

async function run() {
  console.log("Fetching timeline from backend...");
  const res = await fetch("http://localhost:8000/jobs/2a2152f3-d7c2-42e0-b0d9-6d329d65c293/timeline");
  const timeline = await res.json();

  // Build test editor state
  const state = {
    jobId: "2a2152f3-d7c2-42e0-b0d9-6d329d65c293",
    fps: 30,
    totalDuration: 24.8,
    width: 1280,
    height: 720,
    orientation: "horizontal",
    tracks: [
      {
        id: "video",
        label: "Visuals",
        type: "video",
        items: [
          {
            id: "clip_b1",
            trackStart: 0,
            trackEnd: 6.17,
            duration: 6.17,
            assetType: "video",
            storageUrl: "https://cdn.pixabay.com/video/2015/08/10/228-135860602_medium.mp4",
            sourceIn: 7.82,
            sourceOut: 13.99,
          },
          {
            id: "clip_b2",
            trackStart: 6.17,
            trackEnd: 12.78,
            duration: 6.61,
            assetType: "video",
            storageUrl: "https://cdn.pixabay.com/video/2024/08/13/226200_medium.mp4",
            sourceIn: 4.7,
            sourceOut: 11.31,
          },
          {
            id: "b3_motion",
            trackStart: 12.78,
            trackEnd: 19.29,
            duration: 6.51,
            assetType: "motion",
            componentId: "DataAnimations/StatCard",
            props: {
              value: "$25 BILLION",
              label: "Apollo Project Investment",
              subtext: "The entire Apollo project cost over 25 billion dollars, representing 4 percent of the federal budget.",
              themeColor: "#3b82f6",
            },
          },
          {
            id: "clip_b4",
            trackStart: 19.29,
            trackEnd: 24.84,
            duration: 5.55,
            assetType: "video",
            storageUrl: "https://cdn.pixabay.com/video/2017/06/18/10063-222381500_medium.mp4",
            sourceIn: 1.23,
            sourceOut: 6.78,
          },
        ],
      },
      {
        id: "text",
        label: "Captions",
        type: "text",
        items: [],
      },
      {
        id: "audio",
        label: "Audio",
        type: "audio",
        items: [
          {
            id: "vo_b1",
            trackStart: 0,
            trackEnd: 6.17,
            duration: 6.17,
            assetId: "http://localhost:8000/static/output/audio/b1.wav",
          },
          {
            id: "vo_b2",
            trackStart: 6.17,
            trackEnd: 12.78,
            duration: 6.61,
            assetId: "http://localhost:8000/static/output/audio/b2.wav",
          },
          {
            id: "vo_b3",
            trackStart: 12.78,
            trackEnd: 19.29,
            duration: 6.51,
            assetId: "http://localhost:8000/static/output/audio/b3.wav",
          },
          {
            id: "vo_b4",
            trackStart: 19.29,
            trackEnd: 24.84,
            duration: 5.55,
            assetId: "http://localhost:8000/static/output/audio/b4.wav",
          },
        ],
      },
    ],
  };

  const outDir = path.join(rootDir, "public", "renders");
  fs.mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, "test_remotion_export.mp4");

  console.log("Bundling Remotion composition with Tailwind & alias...");
  const bundleLocation = await bundle({
    entryPoint: path.join(rootDir, "src", "remotion", "index.tsx"),
    webpackOverride: (config) =>
      enableTailwind({
        ...config,
        resolve: {
          ...(config.resolve || {}),
          alias: {
            ...(config.resolve?.alias || {}),
            "@": path.join(rootDir, "src"),
          },
        },
      }),
  });

  console.log("Selecting composition...");
  const composition = await selectComposition({
    serveUrl: bundleLocation,
    id: "VideoExport",
    inputProps: {
      projectState: state,
    },
  });

  console.log(`Rendering ${composition.durationInFrames} frames at ${composition.width}x${composition.height}...`);
  await renderMedia({
    composition,
    serveUrl: bundleLocation,
    codec: "h264",
    audioCodec: "aac",
    outputLocation: outFile,
    inputProps: {
      projectState: state,
    },
    imageFormat: "jpeg",
    concurrency: 4,
    onProgress: ({ renderedFrames, totalFrames }) => {
      process.stdout.write(`\rProgress: ${renderedFrames}/${totalFrames} frames (${Math.round((renderedFrames/totalFrames)*100)}%)`);
    },
  });

  console.log("\n✅ Video rendering complete: ", outFile);
}

run().catch((e) => {
  console.error("Test render failed:", e);
  process.exit(1);
});
