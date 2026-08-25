import { renderMedia, renderStill, selectComposition } from "@remotion/renderer";
import path from "path";
import fs from "fs";
import http from "http";
import { fileURLToPath } from "url";
import { bundleRemotion } from "./bundle_remotion.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const pipelineDir = path.resolve(rootDir, "..", "video-generation-pipeline");

// Start micro HTTP media server for Remotion local media
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
const bgVideoUrl = `${mediaBaseUrl}/?path=${encodeURIComponent(bgVideoPath)}`;

// 1-Beat Combined State: Footage Background + Graphic Overlay
const state = {
  jobId: "titanic-combo-beat",
  fps: 30,
  totalDuration: 4.0,
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
          id: "b1_layer0_bg",
          trackId: "video",
          trackStart: 0,
          trackEnd: 4.0,
          duration: 4.0,
          assetType: "video",
          sourceIn: 0,
          sourceOut: 4.0,
          storageUrl: bgVideoUrl,
          zIndex: 0,
          layoutRole: "full",
        },
        {
          id: "b1_layer1_stat",
          trackId: "video",
          trackStart: 0,
          trackEnd: 4.0,
          duration: 4.0,
          durationInFrames: 120,
          assetType: "motion",
          componentId: "DataAnimations/StatCard",
          props: {
            primary_value: "$7.5M",
            kicker: "CONSTRUCTION COST",
            visual_type: "chart",
            subtext: "Building the RMS Titanic in 1912 (~$400M today)",
            themeColor: "#38bdf8",
            fps: 30,
            durationInFrames: 120,
          },
          content: "$7.5 Million Titanic Construction Cost",
          zIndex: 1,
          layoutRole: "overlay-lower-third",
        },
      ],
    },
    { id: "text", label: "Captions & Titles", type: "text", items: [] },
    { id: "audio", label: "Voiceover Track", type: "audio", items: [] },
  ],
};

const bundleLocation = await bundleRemotion();

console.log("[Remotion] Selecting VideoExport composition...");
const composition = await selectComposition({
  serveUrl: bundleLocation,
  id: "VideoExport",
  inputProps: {
    projectState: state,
  },
});

const outPng = path.join(pipelineDir, "output", "titanic_combo_screenshot.png");
console.log(`[Remotion] 📸 Capturing still frame at frame 60 (2.0s mark) -> ${outPng}...`);

await renderStill({
  composition,
  serveUrl: bundleLocation,
  output: outPng,
  frame: 60,
  inputProps: {
    projectState: state,
  },
  imageFormat: "png",
  chromiumOptions: {
    args: [
      "--allow-file-access-from-files",
      "--disable-web-security",
      "--autoplay-policy=no-user-gesture-required",
      "--disable-features=IsolateOrigins,site-per-process",
    ],
  },
});

console.log(`[Remotion] ✅ Screenshot saved successfully to: ${outPng}`);

// Also render short 4s video
const outMp4 = path.join(pipelineDir, "output", "titanic_combo_beat.mp4");
console.log(`[Remotion] 🎬 Rendering 4-second MP4 video -> ${outMp4}...`);

await renderMedia({
  composition,
  serveUrl: bundleLocation,
  codec: "h264",
  audioCodec: "aac",
  outputLocation: outMp4,
  overwrite: true,
  timeoutInMilliseconds: 120000,
  inputProps: {
    projectState: state,
  },
  concurrency: 2,
  chromiumOptions: {
    args: [
      "--allow-file-access-from-files",
      "--disable-web-security",
      "--autoplay-policy=no-user-gesture-required",
      "--disable-features=IsolateOrigins,site-per-process",
    ],
  },
});

mediaServer.close();
console.log(`[Remotion] 🎉 Complete! Video rendered at: ${outMp4}`);
