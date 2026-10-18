import { renderMedia, selectComposition } from "@remotion/renderer";
import path from "path";
import fs from "fs";
import os from "os";
import http from "http";
import crypto from "crypto";
import { execSync } from "child_process";
import { fileURLToPath } from "url";
import { bundleRemotion } from "./bundle_remotion.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");

// Auto-load environment variables from .env files
function loadEnvFile(envPath) {
  if (fs.existsSync(envPath)) {
    try {
      const content = fs.readFileSync(envPath, "utf8");
      for (const rawLine of content.split(/\r?\n/)) {
        const line = rawLine.trim();
        if (!line || line.startsWith("#")) continue;
        const eqIdx = line.indexOf("=");
        if (eqIdx > 0) {
          const key = line.slice(0, eqIdx).trim();
          let val = line.slice(eqIdx + 1).trim();
          if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
            val = val.slice(1, -1);
          }
          if (!process.env[key]) {
            process.env[key] = val;
          }
        }
      }
    } catch {}
  }
}

loadEnvFile(path.resolve(rootDir, ".env"));
loadEnvFile(path.resolve(rootDir, ".env.local"));
loadEnvFile(path.resolve(rootDir, "..", "video-generation-pipeline", ".env"));

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

const browserExecutable =
  process.env.PUPPETEER_EXECUTABLE_PATH ||
  (fs.existsSync("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome")
    ? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
    : undefined);

const chromiumOptions = {
  args: [
    "--no-sandbox",
    "--disable-setuid-sandbox",
    "--disable-dev-shm-usage",
    "--disable-gpu-sandbox",
    "--allow-file-access-from-files",
    "--disable-web-security",
    "--autoplay-policy=no-user-gesture-required",
    "--disable-features=IsolateOrigins,site-per-process",
  ],
};

function resolveLocalPath(p) {
  if (!p || typeof p !== "string") return null;
  const clean = p.replace(/^file:\/\//, "");
  const relClean = clean.replace(/^\/+/, "");
  const candidates = [
    clean,
    path.resolve(clean),
    path.resolve(rootDir, relClean),
    path.resolve(rootDir, "public", relClean),
    path.resolve(rootDir, "..", "video-generation-pipeline", relClean),
    path.resolve(rootDir, "..", relClean),
  ];
  for (const cand of candidates) {
    if (fs.existsSync(cand)) {
      return cand;
    }
  }
  return null;
}

// Start micro HTTP media server for Remotion to access local audio/video files with Range seek support
const mediaServer = http.createServer((req, res) => {
  const parsedUrl = new URL(req.url, `http://${req.headers.host}`);
  const rawPath = parsedUrl.searchParams.get("path");
  const filePath = resolveLocalPath(rawPath) || rawPath;
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
      const stream = fs.createReadStream(filePath, { start, end });
      res.on("close", () => {
        try { stream.destroy(); } catch {}
      });
      stream.pipe(res);
    } else {
      res.writeHead(200, {
        "Content-Length": fileSize,
        "Content-Type": contentType,
        "Accept-Ranges": "bytes",
        "Access-Control-Allow-Origin": "*",
      });
      const stream = fs.createReadStream(filePath);
      res.on("close", () => {
        try { stream.destroy(); } catch {}
      });
      stream.pipe(res);
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
  const resolved = resolveLocalPath(p) || p.replace(/^file:\/\//, "");
  return `${mediaBaseUrl}/media?path=${encodeURIComponent(resolved)}`;
}

let fallbackCacheFile = null;
const urlToLocalFileMap = new Map();
const mediaDurationCache = new Map();

function probeMediaDuration(filePath) {
  if (!filePath || !fs.existsSync(filePath)) return null;
  if (mediaDurationCache.has(filePath)) return mediaDurationCache.get(filePath);
  try {
    const cmd = `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${filePath}"`;
    const out = execSync(cmd, { timeout: 5000, encoding: "utf8" }).trim();
    const dur = parseFloat(out);
    if (!isNaN(dur) && dur > 0) {
      mediaDurationCache.set(filePath, dur);
      return dur;
    }
  } catch (e) {}
  return null;
}

function ensureMediaDuration(filePath, requiredDuration) {
  if (!filePath || !fs.existsSync(filePath)) return filePath;
  const currentDur = probeMediaDuration(filePath);
  if (!currentDur || currentDur <= 0 || currentDur >= requiredDuration) {
    return filePath;
  }
  const ext = path.extname(filePath);
  const loopedPath = filePath.replace(new RegExp(`\\${ext}$`), `_looped_${Math.ceil(requiredDuration)}${ext}`);
  if (fs.existsSync(loopedPath) && probeMediaDuration(loopedPath) >= requiredDuration) {
    return loopedPath;
  }
  try {
    const loops = Math.ceil(requiredDuration / currentDur) + 1;
    const cmd = `ffmpeg -y -stream_loop ${loops} -i "${filePath}" -c copy "${loopedPath}"`;
    execSync(cmd, { stdio: "ignore", timeout: 10000 });
    if (fs.existsSync(loopedPath)) {
      mediaDurationCache.set(loopedPath, probeMediaDuration(loopedPath));
      console.log(
        `[Remotion] 🔄 Looped short clip '${path.basename(filePath)}' (${currentDur.toFixed(2)}s -> ${(currentDur * loops).toFixed(2)}s) to prevent EOF freeze across ${requiredDuration.toFixed(2)}s beat.`
      );
      return loopedPath;
    }
  } catch (err) {
    console.warn(`[Remotion] ⚠️ Failed to loop file ${filePath}: ${err.message}`);
  }
  return filePath;
}

async function cacheMediaLocally(url) {
  if (!url || typeof url !== "string") return url;

  // If local file path
  if (!url.startsWith("http://") && !url.startsWith("https://")) {
    const resolved = resolveLocalPath(url);
    if (resolved) {
      const httpUrl = toHttpUrl(resolved);
      urlToLocalFileMap.set(httpUrl, resolved);
      urlToLocalFileMap.set(url, resolved);
      return httpUrl;
    }
    const cleanUrl = url.replace(/^file:\/\//, "").replace(/^\/+/, "");
    const backendUrl = `http://127.0.0.1:8000/static/${cleanUrl}`;
    try {
      const checkRes = await fetch(backendUrl, { method: "HEAD" });
      if (checkRes.ok) {
        url = backendUrl;
      } else {
        return toHttpUrl(url);
      }
    } catch {
      return toHttpUrl(url);
    }
  }

  // If already served by localhost / local micro server
  if (url.startsWith("http://localhost") || url.startsWith("http://127.0.0.1") || url.startsWith(mediaBaseUrl)) {
    return url;
  }

  try {
    const hash = crypto.createHash("md5").update(url).digest("hex");
    const cleanUrl = url.split("?")[0];
    const ext = path.extname(cleanUrl) || ".mp4";
    const cacheDir = path.join(rootDir, "public", "cache", "media");
    const cacheFile = path.join(cacheDir, `${hash}${ext}`);

    if (fs.existsSync(cacheFile) && fs.statSync(cacheFile).size > 1024) {
      if (!fallbackCacheFile) fallbackCacheFile = cacheFile;
      const httpUrl = toHttpUrl(cacheFile);
      urlToLocalFileMap.set(httpUrl, cacheFile);
      urlToLocalFileMap.set(url, cacheFile);
      return httpUrl;
    }

    fs.mkdirSync(cacheDir, { recursive: true });
    console.log(`[Remotion] 📥 Pre-caching remote footage: ${url.slice(0, 70)}...`);

    const proxyUrl =
      process.env.HTTPS_PROXY ||
      process.env.HTTP_PROXY ||
      process.env.MEDIA_PROXY ||
      process.env.https_proxy ||
      process.env.http_proxy ||
      process.env.ALL_PROXY ||
      process.env.all_proxy;
    let downloaded = false;

    // 1. If proxy is configured or domain is imagekit, use curl with proxy directly (avoids fetch timeouts & 403 blocks)
    if (proxyUrl || url.includes("imagekit")) {
      try {
        const proxyArg = proxyUrl ? `--proxy "${proxyUrl}"` : "";
        const curlCmd = `curl -f -k -L -s --compressed -A "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" -H "Referer: https://www.pexels.com/" ${proxyArg} "${url}" -o "${cacheFile}"`;
        execSync(curlCmd, { timeout: 45000 });
        if (fs.existsSync(cacheFile) && fs.statSync(cacheFile).size >= 1024) {
          const head = fs.readFileSync(cacheFile, { encoding: "utf8" }).slice(0, 50);
          if (head.startsWith("<!DOC") || head.startsWith("<html") || head.startsWith('{"')) {
            try { fs.unlinkSync(cacheFile); } catch {}
          } else {
            downloaded = true;
            const sz = (fs.statSync(cacheFile).size / 1024 / 1024).toFixed(1);
            console.log(`  ✓ Cached via proxy curl (${sz} MB)`);
          }
        }
      } catch (curlErr) {
        console.warn(`  ⚠️ Proxy curl download failed: ${curlErr.message}, falling back...`);
      }
    }

    // 2. Direct fetch attempt if not already downloaded via proxy
    if (!downloaded) {
      try {
        const res = await fetch(url, {
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
            "Referer": "https://www.pexels.com/",
            "Accept": "*/*",
          },
        });
        if (res.ok) {
          const buffer = Buffer.from(await res.arrayBuffer());
          if (buffer.length >= 1024) {
            const head = buffer.subarray(0, 50).toString("utf8");
            if (!head.startsWith("<!DOC") && !head.startsWith("<html") && !head.startsWith('{"')) {
              fs.writeFileSync(cacheFile, buffer);
              downloaded = true;
              console.log(`  ✓ Cached via fetch (${(buffer.length / 1024 / 1024).toFixed(1)} MB)`);
            } else {
              console.warn(`  ⚠️ Fetch returned error body (HTML/JSON), trying curl...`);
            }
          }
        } else {
          console.warn(`  ⚠️ Fetch HTTP ${res.status}: ${res.statusText}, trying curl...`);
        }
      } catch (fetchErr) {
        console.warn(`  ⚠️ Fetch error (${fetchErr.message}), trying curl...`);
      }
    }



    if (downloaded) {
      if (!fallbackCacheFile) fallbackCacheFile = cacheFile;
      const httpUrl = toHttpUrl(cacheFile);
      urlToLocalFileMap.set(httpUrl, cacheFile);
      urlToLocalFileMap.set(url, cacheFile);
      return httpUrl;
    }

    // 3. Fallback to any already cached valid video clip so rendering never crashes
    if (fallbackCacheFile && fs.existsSync(fallbackCacheFile)) {
      console.warn(`  ⚠️ Video inaccessible (${url.slice(0, 45)}...), substituting available clip to keep render safe`);
      const httpUrl = toHttpUrl(fallbackCacheFile);
      urlToLocalFileMap.set(httpUrl, fallbackCacheFile);
      urlToLocalFileMap.set(url, fallbackCacheFile);
      return httpUrl;
    }

    return url;
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
let frameRange = null;
let noCaptions = false;

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
  } else if (args[i] === "--no-captions" || args[i] === "--no-subtitles") {
    noCaptions = true;
  } else if ((args[i] === "--frames" || args[i] === "--frame-range") && args[i + 1]) {
    frameRange = args[i + 1].split("-").map((n) => parseInt(n, 10));
    i++;
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
        let rawMedia = item.storageUrl || item.storagePath;
        if (rawMedia && typeof rawMedia === "string" && rawMedia.startsWith("file://")) {
          const testPath = resolveLocalPath(rawMedia);
          if (!testPath) {
            const sp = item.storagePath || "";
            if (sp && !sp.includes("/") && !sp.includes("\\") && sp.length > 20) {
              rawMedia = `https://drive.google.com/uc?export=download&id=${sp}`;
            }
          }
        }
        const cachedUrl = await cacheMediaLocally(rawMedia);
        const dur = Math.max(0.1, (item.trackEnd || 0) - (item.trackStart || 0));
        let safeSourceIn = item.sourceIn || 0;
        let safeSourceOut = item.sourceOut || dur;

        let finalCachedUrl = cachedUrl;
        const localFile = urlToLocalFileMap.get(cachedUrl) || urlToLocalFileMap.get(rawMedia) || resolveLocalPath(rawMedia);
        if (localFile) {
          const mediaDur = probeMediaDuration(localFile);
          if (mediaDur !== null && mediaDur > 0) {
            if (safeSourceIn >= mediaDur || safeSourceIn + 0.05 > mediaDur) {
              safeSourceIn = 0.0;
              safeSourceOut = safeSourceIn + dur;
              console.log(
                `[Remotion] 🛡️ [Sanitize] Clip '${item.id}' sourceIn (${item.sourceIn}s) exceeds file duration (${mediaDur.toFixed(2)}s). Clamped to 0.0s.`
              );
            }
            if (safeSourceIn + dur > mediaDur) {
              const loopedFile = ensureMediaDuration(localFile, safeSourceIn + dur);
              if (loopedFile !== localFile) {
                finalCachedUrl = toHttpUrl(loopedFile);
                urlToLocalFileMap.set(finalCachedUrl, loopedFile);
              }
            }
          }
        }

        videoItems.push({
          id: item.id,
          trackId: "video",
          trackStart: item.trackStart || 0,
          trackEnd: item.trackEnd || (item.trackStart || 0) + dur,
          duration: dur,
          assetType: item.assetType || "video",
          assetId: item.assetId,
          sourceIn: safeSourceIn,
          sourceOut: safeSourceOut,
          storagePath: item.storagePath,
          storageUrl: finalCachedUrl,
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
            zIndex: item.zIndex ?? 10,
            layoutRole: item.layerRole || item.layout || item.props?.display_mode || "takeover",
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

  // Ensure kinetic captions from resolved_beats for beats that don't already have textItems
  const shouldRenderCaptions = !noCaptions && !timeline.no_captions && !timeline.metadata?.no_captions;
  if (shouldRenderCaptions) {
    for (const rb of timeline.metadata?.resolved_beats || []) {
      const beatId = rb.beat?.id;
      if (!beatId) continue;
      const existing = textItems.find((t) => t.id && t.id.includes(beatId));
      if (existing) {
        if (!existing.timings && rb.timings && rb.timings.length > 0) {
          existing.timings = rb.timings;
        }
      } else if (rb.beat?.text) {
        const audio = audioItems.find((a) => a.id && a.id.includes(beatId));
        if (audio) {
          textItems.push({
            id: `caption_${beatId}`,
            trackId: "text",
            trackStart: audio.trackStart,
            trackEnd: audio.trackEnd,
            duration: audio.duration,
            content: rb.beat.text,
            timings: rb.timings || [],
            style: "kinetic",
          });
        }
      }
    }
  } else {
    // Strip any auto-generated captions if no-captions requested
    const filteredTextItems = textItems.filter(
      (t) => t.style !== "kinetic" && t.style !== "caption" && !t.id?.startsWith("caption_")
    );
    textItems.length = 0;
    textItems.push(...filteredTextItems);
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
    transitionStyle: timeline.metadata?.transition_style || "none",
    selectedClipId: null,
  };
} else if (stateFile && fs.existsSync(stateFile)) {
  state = JSON.parse(fs.readFileSync(stateFile, "utf-8"));
  for (const track of state.tracks || []) {
    for (const item of track.items || []) {
      const origSource = item.storageUrl || item.storagePath || item.assetId;
      if (item.assetId) item.assetId = await cacheMediaLocally(item.assetId);
      if (item.storageUrl) item.storageUrl = await cacheMediaLocally(item.storageUrl);
      if (item.storagePath && !item.storageUrl) item.storageUrl = await cacheMediaLocally(item.storagePath);

      if (track.type === "video") {
        const cachedTarget = item.storageUrl || item.storagePath;
        const localFile = urlToLocalFileMap.get(cachedTarget) || urlToLocalFileMap.get(origSource) || resolveLocalPath(origSource);
        if (localFile) {
          const mediaDur = probeMediaDuration(localFile);
          if (mediaDur !== null && mediaDur > 0) {
            const dur = Math.max(0.1, item.duration || (item.trackEnd || 0) - (item.trackStart || 0));
            if (item.sourceIn && (item.sourceIn >= mediaDur || item.sourceIn + 0.05 > mediaDur)) {
              const oldIn = item.sourceIn;
              item.sourceIn = 0.0;
              item.sourceOut = item.sourceIn + dur;
              console.log(
                `[Remotion] 🛡️ [Sanitize] State clip '${item.id}' sourceIn (${oldIn}s) exceeds file duration (${mediaDur.toFixed(2)}s). Clamped to 0.0s.`
              );
            }
            const sIn = item.sourceIn || 0;
            if (sIn + dur > mediaDur) {
              const loopedFile = ensureMediaDuration(localFile, sIn + dur);
              if (loopedFile !== localFile) {
                const finalUrl = toHttpUrl(loopedFile);
                urlToLocalFileMap.set(finalUrl, loopedFile);
                item.storageUrl = finalUrl;
              }
            }
          }
        }
      }
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
  browserExecutable,
  chromiumOptions,
  timeoutInMilliseconds: 120000,
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
  browserExecutable,
  chromiumOptions,
  timeoutInMilliseconds: 3600000,
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
  frameRange: frameRange && frameRange.length === 2 ? [frameRange[0], frameRange[1]] : undefined,
});

mediaServer.close();
console.log(`[Remotion] ✅ Video render complete: ${outFile}`);
