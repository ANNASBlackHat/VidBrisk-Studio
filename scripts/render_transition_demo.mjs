import { renderMedia, selectComposition } from "@remotion/renderer";
import path from "path";
import fs from "fs";
import http from "http";
import { fileURLToPath } from "url";
import { bundleRemotion } from "./bundle_remotion.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const pipelineDir = path.resolve(rootDir, "..", "video-generation-pipeline");

// Micro HTTP media server for Remotion local media
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

const bgVideoPath = path.join(pipelineDir, "output", "test_bg.mp4");
const bgVideoUrl = fs.existsSync(bgVideoPath)
  ? `${mediaBaseUrl}/?path=${encodeURIComponent(bgVideoPath)}`
  : "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4";

// Build a 6-second sequence with two 3-second back-to-back clips to demonstrate transition at frame 90 (t = 3.0s)
function createProjectState(transitionStyle) {
  return {
    jobId: `transition-demo-${transitionStyle}`,
    fps: 30,
    totalDuration: 6.0,
    width: 1280,
    height: 720,
    orientation: "horizontal",
    transitionStyle: transitionStyle,
    tracks: [
      {
        id: "video",
        label: "Visuals",
        type: "video",
        items: [
          {
            id: "clip_1",
            trackStart: 0,
            trackEnd: 3.0,
            duration: 3.0,
            assetType: "video",
            storageUrl: bgVideoUrl,
            sourceIn: 0,
            sourceOut: 3.0,
            layerRole: "primary",
            zIndex: 1,
          },
          {
            id: "clip_2",
            trackStart: 3.0,
            trackEnd: 6.0,
            duration: 3.0,
            assetType: "video",
            storageUrl: bgVideoUrl,
            sourceIn: 5.0,
            sourceOut: 8.0,
            layerRole: "primary",
            zIndex: 1,
          },
        ],
      },
      {
        id: "text",
        label: "Captions",
        type: "text",
        items: [
          {
            id: "title_1",
            trackStart: 0.5,
            trackEnd: 2.8,
            duration: 2.3,
            text: `Clip 1 (Transition: ${transitionStyle.toUpperCase()})`,
            style: {
              preset: "standard",
              fontSize: 36,
              color: "#ffffff",
              position: "top",
            },
          },
          {
            id: "title_2",
            trackStart: 3.2,
            trackEnd: 5.8,
            duration: 2.6,
            text: `Clip 2 (Post-Cut Scene)`,
            style: {
              preset: "standard",
              fontSize: 36,
              color: "#38bdf8",
              position: "top",
            },
          },
        ],
      },
    ],
  };
}

async function renderTransition(style) {
  console.log(`\n========================================`);
  console.log(`🎬 Bundling & Rendering Transition Style: [${style.toUpperCase()}]`);
  console.log(`========================================`);

  const serveUrl = await bundleRemotion();
  const inputProps = { projectState: createProjectState(style) };

  const composition = await selectComposition({
    serveUrl,
    id: "VideoExport",
    inputProps,
  });

  const outputDir = path.join(rootDir, "public", "renders");
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const outputLocation = path.join(outputDir, `demo_transition_${style}.mp4`);

  await renderMedia({
    composition,
    serveUrl,
    codec: "h264",
    outputLocation,
    inputProps,
    onProgress: ({ progress }) => {
      process.stdout.write(`\rRendering [${style}]: ${(progress * 100).toFixed(1)}%`);
    },
  });

  console.log(`\n✅ Finished rendering: ${outputLocation}`);
}

async function run() {
  try {
    await renderTransition("flash");
    await renderTransition("whip-pan");
    console.log("\n🎉 All transition demos rendered successfully!");
  } catch (err) {
    console.error("Render failed:", err);
  } finally {
    mediaServer.close();
    process.exit(0);
  }
}

run();
