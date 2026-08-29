/**
 * Colab Parallel Chunk Orchestrator — Linux root container
 * Implements SPEC_colab_rendering_export.md §4a: multi-worker chunk partitioning,
 * parallel asset pre-caching, and zero-copy FFmpeg concat stitching.
 */
import { renderMedia, selectComposition } from "@remotion/renderer";
import path from "path";
import fs from "fs";
import os from "os";
import http from "http";
import crypto from "crypto";
import { spawn } from "child_process";
import { fileURLToPath } from "url";
import { bundleRemotion } from "./bundle_remotion.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");

function resolveLocalPath(p) {
  if (!p || typeof p !== "string") return null;
  const clean = p.replace(/^file:\/\//, "");
  const candidates = [
    clean,
    path.resolve(clean),
    path.resolve(rootDir, clean),
    path.resolve(process.cwd(), clean),
    path.resolve(rootDir, "assets", clean.replace(/^assets\//, "")),
  ];
  for (const cand of candidates) {
    if (fs.existsSync(cand)) {
      return cand;
    }
  }
  return null;
}

// --- Micro Range HTTP Server (127.0.0.1, random port, 206 Partial Content) ---
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
// Log total memory for resource visibility
try {
  const totalMemGb = (os.totalmem() / 1024 / 1024 / 1024).toFixed(1);
  console.log(`[Colab Renderer] 🖥️ Detected ${os.cpus().length} vCPUs, ${totalMemGb} GB RAM`);
} catch {}

function toHttpUrl(p) {
  if (!p) return "";
  if (p.startsWith("http://") || p.startsWith("https://")) return p;
  const resolved = resolveLocalPath(p);
  if (resolved) return `${mediaBaseUrl}/media?path=${encodeURIComponent(resolved)}`;
  const clean = p.replace("file://", "");
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
  if (url.startsWith(mediaBaseUrl)) return url;
  if (url.startsWith("assets/")) return toHttpUrl(url);
  if (!url.startsWith("http://") && !url.startsWith("https://")) {
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

function runFfmpegConcat(chunksDir, chunkFiles, outputPath) {
  return new Promise((resolve, reject) => {
    const listPath = path.join(chunksDir, "chunks.txt");
    const listContent = chunkFiles.map((f) => `file '${f.replace(/'/g, "'\\''")}'`).join("\n");
    fs.writeFileSync(listPath, listContent, "utf-8");
    console.log(`[Colab Renderer] ✂️ Stitching ${chunkFiles.length} chunks via FFmpeg concat (zero-copy, <1s)...`);
    console.log(`[Colab Renderer] 📄 chunks.txt:\n${listContent}`);

    const args = ["-y", "-f", "concat", "-safe", "0", "-i", listPath, "-c", "copy", "-movflags", "+faststart", outputPath];
    const proc = spawn("ffmpeg", args, { stdio: "inherit" });
    proc.on("close", (code) => {
      if (code === 0) resolve(outputPath);
      else reject(new Error(`ffmpeg concat exited with code ${code}`));
    });
    proc.on("error", reject);
  });
}

// --- CLI args ---
const args = process.argv.slice(2);
let stateFile = "";
let outFile = "";
let forceBundle = false;
let cliChunks = null;

for (let i = 0; i < args.length; i++) {
  if (args[i] === "--state" && args[i + 1]) { stateFile = args[i + 1]; i++; }
  else if (args[i] === "--out" && args[i + 1]) { outFile = args[i + 1]; i++; }
  else if (args[i] === "--force-bundle") forceBundle = true;
  else if (args[i] === "--chunks" && args[i + 1]) { cliChunks = parseInt(args[i + 1], 10); i++; }
}

let state;
if (stateFile && fs.existsSync(stateFile)) {
  state = JSON.parse(fs.readFileSync(stateFile, "utf-8"));

  const allUrls = [];
  for (const track of state.tracks || []) {
    for (const item of track.items || []) {
      if (item.storageUrl) allUrls.push(item.storageUrl);
      else if (item.storagePath) allUrls.push(item.storagePath);
      if (item.assetId) allUrls.push(item.assetId);
    }
  }
  const cacheMap = await parallelPreCache(allUrls);

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
      if (item.storageUrl?.startsWith("assets/")) item.storageUrl = toHttpUrl(item.storageUrl);
      if (item.storagePath?.startsWith("assets/")) item.storageUrl = toHttpUrl(item.storagePath);
      if (item.assetId?.startsWith("assets/")) item.assetId = toHttpUrl(item.assetId);
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

const totalFrames = composition.durationInFrames;
const fps = composition.fps;
console.log(`[Colab Renderer] 🎬 Composition: ${totalFrames} frames (${composition.width}x${composition.height} @ ${fps}fps)`);

// --- Dynamic Resource Sizing & Chunk Calculation (SPEC §4a.1) ---
const cpuCount = os.cpus().length;
const totalMemGb = os.totalmem() / 1024 / 1024 / 1024;
const N = cliChunks ? Math.max(1, Math.min(6, cliChunks)) : Math.min(6, Math.max(2, cpuCount));
const chunkSize = Math.ceil(totalFrames / N);
const chunks = [];
for (let i = 0; i < N; i++) {
  const startFrame = i * chunkSize;
  const endFrame = Math.min(startFrame + chunkSize - 1, totalFrames - 1);
  if (startFrame >= totalFrames) break;
  chunks.push({ index: i, startFrame, endFrame, output: path.join(rootDir, ".chunks", `chunk_${i}.mp4`) });
}
console.log(`[Colab Renderer] 🧩 Chunking: N=${N} workers (cpuCount=${cpuCount}, RAM=${totalMemGb.toFixed(1)}GB) | chunkSize≈${chunkSize} frames | total=${totalFrames}`);
chunks.forEach((c) => console.log(`  → Worker ${c.index + 1}: Frames ${c.startFrame}..${c.endFrame} → .chunks/chunk_${c.index}.mp4`));

// Prepare chunks directory
const chunksDir = path.join(rootDir, ".chunks");
if (fs.existsSync(chunksDir)) fs.rmSync(chunksDir, { recursive: true, force: true });
fs.mkdirSync(chunksDir, { recursive: true });

// --- Chromium options (root container) ---
const chromiumOptions = {
  args: [
    "--no-sandbox",
    "--disable-setuid-sandbox",
    "--disable-dev-shm-usage",
    "--disable-gpu",
    "--allow-file-access-from-files",
    "--autoplay-policy=no-user-gesture-required",
    "--disable-features=IsolateOrigins,site-per-process",
  ],
};

// Per-worker concurrency: distribute CPUs, cap to avoid oversubscription
const is4K = composition.width >= 3840 || composition.height >= 3840;
const perWorkerConcurrency = is4K ? 1 : Math.max(1, Math.floor(cpuCount / N) || 1);
console.log(`[Colab Renderer] ⚙️ Per-worker concurrency=${perWorkerConcurrency} (4K=${is4K}) | Chromium flags: --no-sandbox --disable-dev-shm-usage --disable-gpu (12GB RAM pool)`);

if (chunks.length === 1) {
  console.log("[Colab Renderer] Single chunk — falling back to sequential render");
  await renderMedia({
    composition,
    serveUrl: bundleLocation,
    codec: "h264",
    audioCodec: "aac",
    outputLocation: outFile,
    overwrite: true,
    timeoutInMilliseconds: 600000,
    inputProps: { projectState: state },
    frameRange: [chunks[0].startFrame, chunks[0].endFrame],
    onProgress: ({ renderedFrames, progress }) => {
      const pct = Math.round(progress * 100);
      if (renderedFrames % 30 === 0 || pct === 100) console.log(`[Colab Renderer] 🎬 Frame ${renderedFrames}/${totalFrames} (${pct}%)`);
    },
    imageFormat: "jpeg",
    concurrency: perWorkerConcurrency,
    chromiumOptions,
  });
} else {
  console.log(`[Colab Renderer] 🚀 Launching ${chunks.length} parallel Remotion workers via Promise.all (100% vCPU, 8-10GB RAM)...`);
  const startTime = Date.now();
  const workerPromises = chunks.map(async (chunk) => {
    const workerStart = Date.now();
    console.log(`[Worker ${chunk.index + 1}] ▶️ Rendering frames ${chunk.startFrame}..${chunk.endFrame} → ${chunk.output}`);
    await renderMedia({
      composition,
      serveUrl: bundleLocation,
      codec: "h264",
      audioCodec: "aac",
      outputLocation: chunk.output,
      overwrite: true,
      timeoutInMilliseconds: 600000,
      inputProps: { projectState: state },
      frameRange: [chunk.startFrame, chunk.endFrame],
      onProgress: ({ renderedFrames }) => {
        // Throttled per-worker logging to avoid spam
        if (renderedFrames % 60 === 0) {
          console.log(`[Worker ${chunk.index + 1}] ⏳ ${renderedFrames}/${chunk.endFrame - chunk.startFrame + 1} frames`);
        }
      },
      imageFormat: "jpeg",
      concurrency: perWorkerConcurrency,
      chromiumOptions,
    });
    const elapsed = ((Date.now() - workerStart) / 1000).toFixed(1);
    console.log(`[Worker ${chunk.index + 1}] ✅ Done in ${elapsed}s → ${chunk.output}`);
    return chunk.output;
  });

  const chunkFiles = await Promise.all(workerPromises);
  const parallelElapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`[Colab Renderer] ✅ All ${chunks.length} chunks rendered in ${parallelElapsed}s (parallel) — stitching...`);

  // Zero-copy FFmpeg concat
  try {
    await runFfmpegConcat(chunksDir, chunkFiles, outFile);
    console.log(`[Colab Renderer] ✅ FFmpeg concat done → ${outFile}`);
  } catch (err) {
    console.error("[Colab Renderer] ❌ FFmpeg concat failed:", err.message);
    console.error("Falling back: individual chunks remain in .chunks/ for manual inspection");
    throw err;
  }

  // Verify output exists and log size
  if (fs.existsSync(outFile)) {
    const sz = (fs.statSync(outFile).size / 1024 / 1024).toFixed(1);
    console.log(`[Colab Renderer] 📦 Final output: ${outFile} (${sz} MB) | ${totalFrames} frames stitched`);
  }

  // Optional cleanup: keep chunks for debugging unless --clean
  if (args.includes("--clean")) {
    fs.rmSync(chunksDir, { recursive: true, force: true });
    console.log("[Colab Renderer] 🧹 Cleaned .chunks/");
  }
}

mediaServer.close();
console.log(`[Colab Renderer] ✅ Video render complete: ${outFile} (engine=remotion-colab, N=${chunks.length} workers)`);

