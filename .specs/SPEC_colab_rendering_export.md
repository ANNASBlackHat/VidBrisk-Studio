# SPEC — Google Colab Offloaded Video Rendering & Parallel Export Bundle

## 1. Purpose

Local video rendering with Remotion requires spinning up headless Chromium, evaluating frame-accurate spring physics and React DOM trees frame-by-frame, and piping raw frames into FFmpeg. On consumer hardware (or laptops without dedicated GPU/high-core CPUs), this process is CPU/memory intensive and time-consuming.

This specification defines the **Google Colab Parallel Render Export Mechanism**: an automated system to package an active video generation job into a self-contained, optimized standalone bundle (`.zip`) that can be uploaded to Google Colab to execute rendering using **chunk-based multi-worker parallel rendering** across free datacenter compute (>500 Mbps bandwidth, multi-core vCPUs, 12GB RAM, pre-installed FFmpeg).

---

## 2. Target Architecture & Parallel Chunking Workflow

Instead of single-threaded or low-concurrency frame evaluation, the Colab execution environment dynamically divides the total timeline into $N$ parallel time-slices (chunks), launches concurrent worker threads/processes to render each chunk simultaneously, and then stitches them via zero-copy FFmpeg concatenation in milliseconds.

```
+-----------------------------------------------------------------------------------+
| 1. LOCAL FRONTEND (video-generation-frontend)                                     |
|    ExportModal -> User selects "Export for Google Colab"                         |
|    -> Embeds local TTS audio into `assets/audio/`                                 |
|    -> Generates self-contained `colab-render-[jobId].zip`                        |
+-----------------------------------------------------------------------------------+
                                         | (User uploads zip to Colab)
                                         v
+-----------------------------------------------------------------------------------+
| 2. GOOGLE COLAB RUNTIME (Ubuntu Linux Environment: 12GB RAM + Multi-core vCPUs)   |
|                                                                                   |
|  [Step 1: Setup & Environment Init]                                               |
|    !unzip -q colab-render-*.zip && cd colab-render-* && npm install               |
|                                                                                   |
|  [Step 2: Parallel Asset Pre-Caching]                                             |
|    Concurrent fetch of all remote stock footage & media (>500 Mbps pipe)          |
|                                                                                   |
|  [Step 3: Chunk-Based Multi-Worker Parallel Render (`render_colab.mjs`)]          |
|    Total Duration (e.g. 1800 frames) split into N parallel worker chunks:        |
|     ├── Worker 1: Frames 0..449     ──> .chunks/chunk_0.mp4                      |
|     ├── Worker 2: Frames 450..899   ──> .chunks/chunk_1.mp4                      |
|     ├── Worker 3: Frames 900..1349  ──> .chunks/chunk_2.mp4                      |
|     └── Worker 4: Frames 1350..1799 ──> .chunks/chunk_3.mp4                      |
|          (All workers run simultaneously using 8-10GB RAM & 100% CPU cores)      |
|                                                                                   |
|  [Step 4: Fast Zero-Copy FFmpeg Concat & Audio Mux]                               |
|    ffmpeg -f concat -safe 0 -i chunks.txt -i master_audio.wav -c copy output.mp4 |
|                                                                                   |
|  [Step 5: Automatic Output Download & In-Notebook Video Player]                   |
|    from google.colab import files; files.download('output.mp4')                   |
+-----------------------------------------------------------------------------------+
```

---

## 3. Package Specification (`colab-render-[jobId].zip`)

The generated `.zip` file is self-contained and runnable with zero manual configuration:

```
colab-render-[jobId]/
├── project_state.json         # Complete EditorProjectState (tracks, clips, motion props, durations)
├── render_colab.mjs           # Parallel chunk orchestrator & Colab runner
├── bundle_remotion.mjs        # Webpack/Tailwind bundler for the Remotion composition
├── package.json               # Minimal dependencies with exact pinned versions from frontend
├── tailwind.config.ts         # Tailwind configuration for styled motion components
├── postcss.config.mjs         # PostCSS config
├── tsconfig.json              # TypeScript path aliases (@/* -> src/*)
├── Colab_Video_Renderer.ipynb # 1-Click Jupyter Notebook tailored for Colab UI
├── assets/                    # Embedded local audio / assets
│   └── audio/                 # Local TTS voiceovers (.wav / .mp3)
└── src/                       # Scoped Remotion source tree
    ├── remotion/index.tsx     # Composition root (VideoExport)
    ├── components/
    │   ├── editor/VideoComposition.tsx
    │   └── motion/            # All registry motion components (StatCard, ChatBubbles, etc.)
    └── lib/ & adapters/       # Helper utilities & data interfaces
```

---

## 4. Key Components & Implementation Details

### 4a. Parallel Chunk Orchestrator (`render_colab.mjs`)

1. **Dynamic Resource Sizing & Chunk Calculation**:
   - Detects CPU core count (`os.cpus().length`) and total memory.
   - Sets chunk count $N = \min(6, \max(2, \text{cpuCount}))$.
   - Divides total frames evenly across workers:
     `Worker[i] -> frameRange: [startFrame_i, endFrame_i]`.

2. **Parallel Asset Pre-Caching**:
   - Parses all remote footage URLs (`storageUrl`, `storagePath`).
   - Executes parallel downloads with `Promise.all()` to `./cache/media/`.
   - Re-routes URLs to the local micro HTTP range server (`127.0.0.1:<port>`).

3. **Multi-Worker Execution (`Promise.all`)**:
   - Concurrently renders each chunk to `.chunks/chunk_${i}.mp4` using Remotion’s `renderMedia({ frameRange, ... })`.
   - Passes root container Chromium flags:
     ```js
     chromiumOptions: {
       args: [
         "--no-sandbox",
         "--disable-setuid-sandbox",
         "--disable-dev-shm-usage", // Utilizes Colab's 12GB RAM directly
         "--allow-file-access-from-files",
         "--autoplay-policy=no-user-gesture-required",
         "--disable-features=IsolateOrigins,site-per-process"
       ]
     }
     ```

4. **Zero-Copy FFmpeg Stitching**:
   - Generates `chunks.txt` listing all rendered chunk MP4s.
   - Runs `ffmpeg -y -f concat -safe 0 -i chunks.txt -c copy -movflags +faststart output.mp4` to merge in < 1 second.
   - Master voiceover audio track is muxed cleanly during final assembly.

---

### 4b. One-Click Jupyter Notebook (`Colab_Video_Renderer.ipynb`)

Contains pre-written cells with real-time feedback:
- **Cell 1 — Environment Check**: Verifies Node.js, CPU cores, RAM, and FFmpeg.
- **Cell 2 — Install Dependencies**: Runs `npm install --no-audit --prefer-offline`.
- **Cell 3 — Parallel Render**: Executes `node render_colab.mjs --state project_state.json --out output.mp4`. Displays live per-chunk progress bars.
- **Cell 4 — In-Notebook Preview & Download**: Uses `IPython.display.Video` to preview the rendered video and triggers `files.download('output.mp4')`.

---

### 4c. Frontend Export UI & API Route (`ExportModal.tsx` & `/api/export-colab`)

1. **Export Route (`POST /api/export-colab`)**:
   - Receives `EditorProjectState`, quality (`720p`, `1080p`, `4k`), and framerate (`30`, `60`).
   - Dynamically builds a minimal `package.json` with pinned versions from the active project.
   - Scans the audio track (`item.assetId`); if an audio file exists locally on disk, copies it into `assets/audio/` inside the zip and updates references to relative paths.
   - Streams the `.zip` archive to the client with `Content-Type: application/zip`.

2. **Frontend UI (`ExportModal.tsx`)**:
   - Adds a distinct **"Export for Google Colab"** mode.
   - Allows resolution & FPS selection.
   - Downloads `colab-render-[jobId].zip` and provides a direct link to open Google Colab (`https://colab.research.google.com`).

---

### 5. Success Criteria

1. **High Resource Utilization**: Colab execution utilizes 6–10 GB RAM and 100% of all vCPU cores during chunk rendering.
2. **Speedup**: A 60-second video renders in **30–45 seconds** on free-tier Colab (vs 3–4 minutes locally).
3. **Zero Configuration**: Notebook runs out-of-the-box in Colab without modifying scripts.
4. **Exact Parity**: The final video has identical visual motion, font rendering, spring physics, and audio sync as the direct Remotion player.
