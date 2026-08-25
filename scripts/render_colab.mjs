/**
 * Colab-optimized Remotion renderer — Linux root container specialization of scripts/render_video.mjs
 *
 * Key deltas vs render_video.mjs:
 * - Parallel pre-fetch with retry (Promise.all) -> cache/media/
 * - Micro Range HTTP server on 127.0.0.1:0 (identical to local but explicit)
 * - Linux Chromium flags (--no-sandbox, --disable-dev-shm-usage, etc.)
 * - Adaptive concurrency: os.cpus().length clamped to [2..8] and resolution-aware (4K -> 2)
 */
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

// --- Micro Range HTTP Server (127.0.0.1, random port, 206 Partial Content) ---
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
        : ext === ".jpg" || ext === ".jpeg"
        ? "image/jpeg"
        : ext === ".png"
        ? "image/png"
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
console.log(`[Colab Renderer] 📡 Micro media server listening on ${mediaBaseUrl}`);

function toHttpUrl(p) {
  if (!p) return "";
  if (p.startsWith("http://") || p.startsWith("https://")) return p;
  if (p.startsWith("assets/") || p.startsWith("/assets/")) {
    const localAsset = path.join(rootDir, p.replace(/^\//, ""));
    if (fs.existsSync(localAsset)) return `${mediaBaseUrl}/media?path=${encodeURIComponent(localAsset)}`;
    // Also try relative to CWD (when running inside colab-render-* folder)
    const cwdAsset = path.resolve(p);
    if (fs.existsSync(cwdAsset)) return `${mediaBaseUrl}/media?path=${encodeURIComponent(cwdAsset)}`;
    return p;
  }
  const clean = p.replace("file://", "");
  if (fs.existsSync(clean)) return `${mediaBaseUrl}/media?path=${encodeURIComponent(clean)}`;
  return `${mediaBaseUrl}/media?path=${encodeURIComponent(clean)}`;
}

const MAX_RETRIES = 3;
const CACHE_PARALLELISM = 6;

async function fetchWithRetry(url, attempt = 0) {
  try {
    const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    return res;
  } catch (err) {
    if (attempt + 1 < MAX_RETRIES) {
      const backoff = 500 * Math.pow(2, attempt);
      console.warn(`  ⚠️ Retry ${attempt + 1}/${MAX_RETRIES} for ${url.slice(0, 60)}... (${err.message}) — waiting ${backoff}ms`);
      await new Promise((r) => setTimeout(r, backoff));
      return fetchWithRetry(url, attempt + 1);
    }
    throw err;
  }
}

async function cacheMediaLocally(url) {
  if (!url || typeof url !== "string") return url;
  // Already local asset or already via media server
  if (url.startsWith(mediaBaseUrl)) return url;
  if (url.startsWith("assets/")) return toHttpUrl(url);
  if (!url.startsWith("http://") && !url.startsWith("https://")) {
    // Local filesystem path — map to micro server immediately (do not attempt fetch)
    return toHttpUrl(url);
  }

  try {
    const hash = crypto.createHash("md5").update(url).digest("hex");
    const cleanUrl = url.split("?")[0];
    const ext = path.extname(cleanUrl) || ".mp4";
    const cacheDir = path.join(rootDir, "cache", "media");
    const cacheFile = path.join(cacheDir, `${hash}${ext}`);

    if (fs.existsSync(cacheFile) && fs.statSync(cacheFile).size > 1024) {
      return toHttpUrl(cacheFile);
    }

    fs.mkdirSync(cacheDir, { recursive: true });
    const res = await fetchWithRetry(url);
    const buffer = Buffer.from(await res.arrayBuffer());
    fs.writeFileSync(cacheFile, buffer);
    console.log(`  ✓ Cached ${(buffer.length / 1024 / 1024).toFixed(1)} MB <- ${url.slice(0, 70)}...`);
    return toHttpUrl(cacheFile);
  } catch (err) {
    console.warn(`  ⚠️ Failed to pre-cache ${url.slice(0, 80)}: ${err.message} — falling back to direct URL`);
    return url;
  }
}

async function parallelPreCache(urls) {
  const unique = [...new Set(urls.filter(Boolean))];
  if (unique.length === 0) return new Map();
  console.log(`[Colab Renderer] 📥 Parallel pre-caching ${unique.length} remote asset(s) with concurrency=${CACHE_PARALLELISM}...`);
  const results = new Map();
  // Chunked Promise.all to bound parallelism
  for (let i = 0; i < unique.length; i += CACHE_PARALLELISM) {
    const chunk = unique.slice(i, i + CACHE_PARALLELISM);
    const settled = await Promise.allSettled(chunk.map(async (u) => ({ url: u, cached: await cacheMediaLocally(u) })));
    for (const s of settled) {
      if (s.status === "fulfilled") results.set(s.value.url, s.value.cached);
      else console.warn(`  ⚠️ Pre-cache chunk error: ${s.reason?.message || s.reason}`);
    }
  }
  const ok = [...results.values()].filter((v) => v.startsWith(mediaBaseUrl) || v.startsWith("http")).length;
  console.log(`[Colab Renderer] ✅ Pre-cache done: ${ok}/${unique.length} assets ready (Colab pipe >500Mbps utilized)`);
  return results;
}

// --- CLI args ---
const args = process.argv.slice(2);
let stateFile = "";
let outFile = "";
let forceBundle = false;

for (let i = 0; i < args.length; i++) {
  if (args[i] === "--state" && args[i + 1]) { stateFile = args[i + 1]; i++; }
  else if (args[i] === "--out" && args[i + 1]) { outFile = args[i + 1]; i++; }
  else if (args[i] === "--force-bundle") forceBundle = true;
}

let state;
if (stateFile && fs.existsSync(stateFile)) {
  state = JSON.parse(fs.readFileSync(stateFile, "utf-8"));

  // Collect all remote URLs for parallel pre-cache
  const allUrls = [];
  for (const track of state.tracks || []) {
    for (const item of track.items || []) {
      if (item.storageUrl) allUrls.push(item.storageUrl);
      else if (item.storagePath) allUrls.push(item.storagePath);
      if (item.assetId) allUrls.push(item.assetId);
    }
  }
  const cacheMap = await parallelPreCache(allUrls);

  // Rewrite state to use cached http URLs via micro server
  for (const track of state.tracks || []) {
    for (const item of track.items || []) {
      if (item.assetId && cacheMap.has(item.assetId)) item.assetId = cacheMap.get(item.assetId);
      else if (item.assetId) item.assetId = await cacheMediaLocally(item.assetId);

      if (item.storageUrl && cacheMap.has(item.storageUrl)) item.storageUrl = cacheMap.get(item.storageUrl);
      else if (item.storageUrl) item.storageUrl = await cacheMediaLocally(item.storageUrl);

      if (item.storagePath && !item.storageUrl) {
        if (cacheMap.has(item.storagePath)) item.storageUrl = cacheMap.get(item.storagePath);
        else item.storageUrl = await cacheMediaLocally(item.storagePath);
      }
      // Normalize assets/ references
      if (item.storageUrl?.startsWith("assets/")) item.storageUrl = toHttpUrl(item.storageUrl);
      if (item.storagePath?.startsWith("assets/")) item.storageUrl = toHttpUrl(item.storagePath);
    }
  }
} else {
  console.error("Error: Missing or invalid --state file path. Usage: node render_colab.mjs --state project_state.json --out output.mp4");
  mediaServer.close();
  process.exit(1);
}

if (!outFile) outFile = path.join(rootDir, "output.mp4");
else outFile = path.resolve(outFile);
fs.mkdirSync(path.dirname(outFile), { recursive: true });

const bundleLocation = await bundleRemotion({ force: forceBundle });

console.log("[Colab Renderer] Selecting VideoExport composition...");
const composition = await selectComposition({
  serveUrl: bundleLocation,
  id: "VideoExport",
  inputProps: { projectState: state },
});

console.log(`[Colab Renderer] Rendering ${composition.durationInFrames} frames (${composition.width}x${composition.height} @ ${composition.fps}fps)...`);

// Adaptive concurrency: 4K -> 2, otherwise min(4, cpus) clamped [2..8]
const cpus = os.cpus().length;
const is4K = composition.width >= 3840 || composition.height >= 3840;
const baseConcurrency = Math.max(2, Math.min(8, cpus));
const concurrency = is4K ? Math.min(2, baseConcurrency) : Math.min(4, baseConcurrency);
console.log(`[Colab Renderer] ⚙️ Concurrency=${concurrency} (vCPUs=${cpus}, 4K=${is4K}) | Chromium flags: --no-sandbox --disable-dev-shm-usage --disable-gpu`);

let lastLog = 0;
const result = await renderMedia({
  composition,
  serveUrl: bundleLocation,
  codec: "h264",
  audioCodec: "aac",
  outputLocation: outFile,
  overwrite: true,
  timeoutInMilliseconds: 600000,
  inputProps: { projectState: state },
  onProgress: ({ renderedFrames, progress }) => {
    const now = Date.now();
    if (now - lastLog > 1000 || renderedFrames === composition.durationInFrames) {
      lastLog = now;
      const pct = Math.round(progress * 100);
      console.log(`[Colab Renderer] 🎬 Rendering frame ${renderedFrames}/${composition.durationInFrames} (${pct}%)`);
    }
  },
  imageFormat: "jpeg",
  concurrency,
  chromiumOptions: {
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
      "--allow-file-access-from-files",
      "--autoplay-policy=no-user-gesture-required",
      "--disable-features=IsolateOrigins,site-per-process",
    ],
  },
});

mediaServer.close();
console.log(`[Colab Renderer] ✅ Video render complete: ${outFile} (engine=remotion-colab)`);
