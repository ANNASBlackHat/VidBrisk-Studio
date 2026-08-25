import { renderMedia, selectComposition } from "@remotion/renderer";
import path from "path";
import fs from "fs";
import http from "http";
import { fileURLToPath } from "url";
import { bundleRemotion } from "./bundle_remotion.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const pipelineDir = path.resolve(rootDir, "..", "video-generation-pipeline");

const mediaServer = http.createServer((req, res) => {
  const parsedUrl = new URL(req.url, `http://${req.headers.host}`);
  const filePath = parsedUrl.searchParams.get("path");
  if (filePath && fs.existsSync(filePath)) {
    const stat = fs.statSync(filePath);
    const fileSize = stat.size;
    const range = req.headers.range;
    if (range) {
      const parts = range.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunksize = end - start + 1;
      res.writeHead(206, {
        "Content-Range": `bytes ${start}-${end}/${fileSize}`,
        "Accept-Ranges": "bytes",
        "Content-Length": chunksize,
        "Content-Type": "video/mp4",
        "Access-Control-Allow-Origin": "*",
      });
      fs.createReadStream(filePath, { start, end }).pipe(res);
    } else {
      res.writeHead(200, {
        "Content-Length": fileSize,
        "Content-Type": "video/mp4",
        "Accept-Ranges": "bytes",
        "Access-Control-Allow-Origin": "*",
      });
      fs.createReadStream(filePath).pipe(res);
    }
  } else {
    res.writeHead(404);
    res.end("Not Found");
  }
});

await new Promise((resolve) => mediaServer.listen(0, "127.0.0.1", resolve));
const mediaPort = mediaServer.address().port;
const mediaBaseUrl = `http://127.0.0.1:${mediaPort}`;

const clipAFixed = "https://cdn.pixabay.com/video/2015/08/10/228-135860602_medium.mp4"; // distinct: rural road, trees
const clipBFixed = "https://cdn.pixabay.com/video/2024/08/13/226200_medium.mp4"; // distinct: aerial city
// Use two DIFFERENT remote videos so the cut is visually obvious
const bgVideoUrlA = clipAFixed;
const bgVideoUrlB = clipBFixed;

function createGlitchState() {
  return {
    jobId: `impact-glitch-demo`,
    fps: 30,
    totalDuration: 6.0,
    width: 1280,
    height: 720,
    orientation: "horizontal",
    transitionStyle: "glitch",
    tracks: [
      {
        id: "video",
        label: "Visuals",
        type: "video",
        items: [
          { id: "clip_1", trackStart: 0, trackEnd: 3.0, duration: 3.0, assetType: "video", storageUrl: bgVideoUrlA, sourceIn: 0, sourceOut: 3.0, zIndex: 1 },
          { id: "clip_2", trackStart: 3.0, trackEnd: 6.0, duration: 3.0, assetType: "video", storageUrl: bgVideoUrlB, sourceIn: 0, sourceOut: 3.0, zIndex: 1 },
        ],
      },
      {
        id: "text",
        label: "Captions",
        type: "text",
        items: [
          { id: "title_1", trackStart: 0.5, trackEnd: 2.8, duration: 2.3, content: "Glitch / VHS — Slice + Scanline at Cut", style: "standard" },
          { id: "title_2", trackStart: 3.2, trackEnd: 5.8, duration: 2.6, content: "Post-Glitch Scene (Chromatic Tint)", style: "standard" },
        ],
      },
    ],
  };
}

function createShakeState() {
  return {
    jobId: `impact-shake-demo`,
    fps: 30,
    totalDuration: 6.0,
    width: 1280,
    height: 720,
    orientation: "horizontal",
    transitionStyle: "none",
    tracks: [
      {
        id: "video",
        label: "Visuals",
        type: "video",
        items: [
          { id: "clip_1", trackStart: 0, trackEnd: 3.0, duration: 3.0, assetType: "video", storageUrl: bgVideoUrlA, sourceIn: 0, sourceOut: 3.0, zIndex: 1, enterTransition: "shake" },
          { id: "clip_2", trackStart: 3.0, trackEnd: 6.0, duration: 3.0, assetType: "video", storageUrl: bgVideoUrlB, sourceIn: 0, sourceOut: 3.0, zIndex: 1, enterTransition: "shake" },
        ],
      },
      {
        id: "text",
        label: "Captions",
        type: "text",
        items: [
          { id: "title_1", trackStart: 0.5, trackEnd: 2.8, duration: 2.3, content: "Camera Shake Entrance — Jitter + Decay", style: "standard" },
          { id: "title_2", trackStart: 3.2, trackEnd: 5.8, duration: 2.6, content: "Shake Again on Entry (Punch-In)", style: "standard" },
        ],
      },
    ],
  };
}

function createGlitchShakeComboState() {
  return {
    jobId: `impact-combo-demo`,
    fps: 30,
    totalDuration: 6.0,
    width: 1280,
    height: 720,
    orientation: "horizontal",
    transitionStyle: "glitch",
    tracks: [
      {
        id: "video",
        label: "Visuals",
        type: "video",
        items: [
          { id: "clip_1", trackStart: 0, trackEnd: 3.0, duration: 3.0, assetType: "video", storageUrl: bgVideoUrlA, sourceIn: 0, sourceOut: 3.0, zIndex: 1, enterTransition: "shake" },
          { id: "clip_2", trackStart: 3.0, trackEnd: 6.0, duration: 3.0, assetType: "video", storageUrl: bgVideoUrlB, sourceIn: 0, sourceOut: 3.0, zIndex: 1, enterTransition: "shake" },
        ],
      },
      {
        id: "text",
        label: "Captions",
        type: "text",
        items: [
          { id: "title_1", trackStart: 0.5, trackEnd: 2.8, duration: 2.3, content: "Combo: Shake Entry + Glitch Cut", style: "standard" },
          { id: "title_2", trackStart: 3.2, trackEnd: 5.8, duration: 2.6, content: "Shake Again + VHS Overlay", style: "standard" },
        ],
      },
    ],
  };
}

async function renderState(name, state) {
  console.log(`\n========================================`);
  console.log(`🎬 Rendering Impact Transition: [${name}]`);
  console.log(`========================================`);
  const serveUrl = await bundleRemotion();
  const inputProps = { projectState: state };
  const composition = await selectComposition({ serveUrl, id: "VideoExport", inputProps });
  const outputDir = path.join(rootDir, "public", "renders");
  fs.mkdirSync(outputDir, { recursive: true });
  const outputLocation = path.join(outputDir, `demo_impact_${name}.mp4`);
  await renderMedia({
    composition,
    serveUrl,
    codec: "h264",
    outputLocation,
    inputProps,
    onProgress: ({ progress }) => process.stdout.write(`\r Rendering [${name}]: ${(progress * 100).toFixed(1)}% `),
  });
  console.log(`\n✅ Finished: ${outputLocation} (${(fs.statSync(outputLocation).size/1024/1024).toFixed(2)} MB)`);
  return outputLocation;
}

async function run() {
  try {
    await renderState("glitch", createGlitchState());
    await renderState("shake", createShakeState());
    await renderState("glitch-shake-combo", createGlitchShakeComboState());
    console.log("\n🎉 All impact transition demos rendered!");
  } catch (err) {
    console.error("Render failed:", err);
  } finally {
    mediaServer.close();
    process.exit(0);
  }
}
run();
