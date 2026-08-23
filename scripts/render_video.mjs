import { renderMedia, selectComposition } from "@remotion/renderer";
import path from "path";
import fs from "fs";
import os from "os";
import http from "http";
import crypto from "crypto";
import { fileURLToPath } from "url";
import { bundleRemotion } from "./bundle_remotion.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");

// Start micro HTTP media server for Remotion to access local audio/video files with Range seek support
const mediaServer = http.createServer((req, res) => {
  const parsedUrl = new URL(req.url, `http://${req.headers.host}`);
  const filePath = parsedUrl.searchParams.get("path");
  if (filePath && fs.existsSync(filePath)) {
    const ext = path.extname(filePath).toLowerCase();
    const contentType =
      ext === ".wav"
        ? "audio/wav"
        : ext === ".mp4"
        ? "video/mp4"
        : ext === ".webm"
        ? "video/webm"
        : ext === ".mp3"
        ? "audio/mpeg"
        : "application/octet-stream";

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
        "Content-Type": contentType,
        "Access-Control-Allow-Origin": "*",
      });
      fs.createReadStream(filePath, { start, end }).pipe(res);
    } else {
      res.writeHead(200, {
        "Content-Length": fileSize,
        "Content-Type": contentType,
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

function toHttpUrl(p) {
  if (!p) return "";
  if (p.startsWith("http://") || p.startsWith("https://")) return p;
  const clean = p.replace("file://", "");
  return `${mediaBaseUrl}/media?path=${encodeURIComponent(clean)}`;
}

async function cacheMediaLocally(url) {
  if (!url || typeof url !== "string") return url;
  if (!url.startsWith("http://") && !url.startsWith("https://")) {
    return toHttpUrl(url);
  }
  // If already served by our local micro server
  if (url.startsWith(mediaBaseUrl)) return url;

  try {
    const hash = crypto.createHash("md5").update(url).digest("hex");
    const cleanUrl = url.split("?")[0];
    const ext = path.extname(cleanUrl) || ".mp4";
    const cacheDir = path.join(rootDir, "public", "cache", "media");
    const cacheFile = path.join(cacheDir, `${hash}${ext}`);

    if (fs.existsSync(cacheFile) && fs.statSync(cacheFile).size > 1024) {
      return toHttpUrl(cacheFile);
    }

    fs.mkdirSync(cacheDir, { recursive: true });
    console.log(`[Remotion] 📥 Pre-caching remote footage: ${url.slice(0, 70)}...`);
    const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
    if (!res.ok) {
      console.warn(`  ⚠️ Pre-cache HTTP ${res.status}: ${res.statusText}`);
      return url;
    }
    const buffer = Buffer.from(await res.arrayBuffer());
    fs.writeFileSync(cacheFile, buffer);
    console.log(`  ✓ Cached (${(buffer.length / 1024 / 1024).toFixed(1)} MB)`);
    return toHttpUrl(cacheFile);
  } catch (err) {
    console.warn(`  ⚠️ Failed to pre-cache ${url.slice(0, 50)}: ${err.message}`);
    return url;
  }
}

const args = process.argv.slice(2);
let stateFile = "";
let timelineFile = "";
let outFile = "";
let forceBundle = false;

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
  } else if (args[i] === "--force-bundle") {
    forceBundle = true;
  }
}

let state;
if (timelineFile && fs.existsSync(timelineFile)) {
  console.log(`[Remotion] Loading timeline JSON from: ${timelineFile}`);
  const timeline = JSON.parse(fs.readFileSync(timelineFile, "utf-8"));
  
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
        const rawMedia = item.storageUrl || item.storagePath;
        const cachedUrl = await cacheMediaLocally(rawMedia);
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
          storageUrl: cachedUrl,
          componentId: item.componentId,
          props: item.props || {},
          rawContent: item.rawContent,
          style: item.style,
          // Multi-layer passthrough — stacking order must survive the
          // timeline -> state translation.
          zIndex: item.zIndex,
          layoutRole: item.layoutRole,
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
        const cachedAudio = await cacheMediaLocally(item.assetId);
        audioItems.push({
          id: item.id,
          trackId: "audio",
          trackStart: item.trackStart || 0,
          trackEnd: item.trackEnd || (item.trackStart || 0) + dur,
          duration: dur,
          assetId: cachedAudio,
        });
      }
    }
  }

  // NOTE: --timeline mode does NOT expand asset_plan.layers (that lives in
  // the frontend adapter). Layered timelines must be exported via --state
  // (the /api/render path), which consumes the already-adapted
  // EditorProjectState. Here we only preserve stacking order.
  if (timeline.metadata?.resolved_beats?.some((rb) => rb.asset_plan?.layers?.length)) {
    console.warn(
      "[Remotion] ⚠️ Timeline contains asset_plan.layers but --timeline mode renders flat items. Use --state for true layered compositing."
    );
  }

  videoItems.sort(
    (a, b) =>
      a.trackStart - b.trackStart ||
      (a.zIndex ?? Number.MAX_SAFE_INTEGER) - (b.zIndex ?? Number.MAX_SAFE_INTEGER)
  );

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
  for (const track of state.tracks || []) {
    for (const item of track.items || []) {
      if (item.assetId) item.assetId = await cacheMediaLocally(item.assetId);
      if (item.storageUrl) item.storageUrl = await cacheMediaLocally(item.storageUrl);
      if (item.storagePath && !item.storageUrl) item.storageUrl = await cacheMediaLocally(item.storagePath);
    }
  }
} else {
  console.error("Error: Missing or invalid --state or --timeline file path");
  mediaServer.close();
  process.exit(1);
}

if (!outFile) {
  outFile = path.join(rootDir, "public", "renders", `render-${Date.now()}.mp4`);
} else {
  outFile = path.resolve(outFile);
}

fs.mkdirSync(path.dirname(outFile), { recursive: true });

const bundleLocation = await bundleRemotion({ force: forceBundle });

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
  timeoutInMilliseconds: 600000,
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
console.log(`[Remotion] ✅ Video render complete: ${outFile}`);
