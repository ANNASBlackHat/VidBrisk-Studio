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
let outFile = "";

for (let i = 0; i < args.length; i++) {
  if (args[i] === "--state" && args[i + 1]) {
    stateFile = args[i + 1];
    i++;
  } else if (args[i] === "--out" && args[i + 1]) {
    outFile = args[i + 1];
    i++;
  }
}

if (!stateFile || !fs.existsSync(stateFile)) {
  console.error("Error: Missing or invalid --state file path");
  process.exit(1);
}

const state = JSON.parse(fs.readFileSync(stateFile, "utf-8"));
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

const result = await renderMedia({
  composition,
  serveUrl: bundleLocation,
  codec: "h264",
  audioCodec: "aac",
  outputLocation: outFile,
  overwrite: true,
  timeoutInMilliseconds: 120000,
  inputProps: {
    projectState: state,
  },
  imageFormat: "jpeg",
  concurrency: Math.max(2, Math.min(6, os.cpus().length || 4)),
});

console.log(`[Remotion] ✅ Video render complete: ${outFile}`);
