import { NextRequest, NextResponse } from "next/server";
import path from "path";
import fs from "fs";
import JSZip from "jszip";

export const dynamic = "force-dynamic";

function getDimensions(
  orientation: string | undefined,
  quality: string | undefined
): { width: number; height: number } {
  const q = quality || "720p";
  const o = orientation || "horizontal";
  if (o === "square") {
    const dim = q === "720p" ? 720 : q === "4k" ? 2160 : 1080;
    return { width: dim, height: dim };
  }
  if (q === "1080p") {
    return o === "vertical" ? { width: 1080, height: 1920 } : { width: 1920, height: 1080 };
  }
  if (q === "4k") {
    return o === "vertical" ? { width: 2160, height: 3840 } : { width: 3840, height: 2160 };
  }
  return o === "vertical" ? { width: 720, height: 1280 } : { width: 1280, height: 720 };
}

function collectScopedFiles(rootDir: string): { abs: string; rel: string }[] {
  const files: { abs: string; rel: string }[] = [];
  const pushFile = (rel: string) => {
    const abs = path.join(rootDir, rel);
    if (fs.existsSync(abs) && fs.statSync(abs).isFile()) files.push({ abs, rel });
  };
  const pushDir = (relDir: string) => {
    const absDir = path.join(rootDir, relDir);
    if (!fs.existsSync(absDir)) return;
    const walk = (dir: string) => {
      for (const entry of fs.readdirSync(dir)) {
        const abs = path.join(dir, entry);
        const stat = fs.statSync(abs);
        if (stat.isDirectory()) walk(abs);
        else {
          const rel = path.relative(rootDir, abs);
          files.push({ abs, rel });
        }
      }
    };
    walk(absDir);
  };

  pushFile("tailwind.config.ts");
  pushFile("postcss.config.mjs");
  pushFile("tsconfig.json");
  pushFile("scripts/bundle_remotion.mjs");
  pushFile("scripts/render_colab.mjs");
  pushFile("src/app/globals.css");
  pushFile("src/remotion/index.tsx");
  pushFile("src/lib/types.ts");
  pushFile("src/lib/utils.ts");
  pushFile("src/adapters/timelineToEditorState.ts");
  pushFile("src/components/editor/VideoComposition.tsx");
  pushDir("src/components/motion");

  return files;
}

function buildMinimalPackageJson(rootDir: string, warnings: string[]): string {
  const raw = JSON.parse(fs.readFileSync(path.join(rootDir, "package.json"), "utf-8"));
  const keepDeps = [
    "remotion",
    "@remotion/bundler",
    "@remotion/renderer",
    "@remotion/player",
    "@remotion/tailwind",
    "react",
    "react-dom",
    "clsx",
    "tailwind-merge",
    "tailwindcss",
    "lucide-react",
  ];
  const dependencies: Record<string, string> = {};
  for (const k of keepDeps) {
    if (raw.dependencies?.[k]) dependencies[k] = raw.dependencies[k];
    else if (raw.devDependencies?.[k]) dependencies[k] = raw.devDependencies[k];
    else warnings.push(`Dependency ${k} not found in root package.json — omitted from colab bundle`);
  }
  if (!dependencies["tailwindcss"] && raw.devDependencies?.["tailwindcss"]) {
    dependencies["tailwindcss"] = raw.devDependencies["tailwindcss"];
  }

  const minimal = {
    name: `colab-render-${Date.now()}`,
    version: "1.0.0",
    private: true,
    type: "module",
    scripts: {
      render: "node scripts/render_colab.mjs --state project_state.json --out output.mp4",
    },
    dependencies,
  };
  return JSON.stringify(minimal, null, 2);
}

function buildNotebookJson(jobId: string): string {
  const nb = {
    nbformat: 4,
    nbformat_minor: 0,
    metadata: {
      colab: { provenance: [] },
      kernelspec: { name: "python3", display_name: "Python 3" },
    },
    cells: [
      {
        cell_type: "markdown",
        source: [`# 🎬 Colab Video Renderer — ${jobId.slice(0, 8)}\n`, `One-click Remotion render using datacenter GPU/CPU + >500Mbps pipe.\n`, `Upload the companion \`colab-render-*.zip\` when prompted, then Run All.\n`],
        metadata: {},
      },
      {
        cell_type: "code",
        source: [
          "# Step 1: Check Environment\n",
          "!node -v && echo \"---\" && nproc && echo \"vCPUs\" && echo \"---\" && ffmpeg -version | head -n1\n",
        ],
        metadata: {},
        execution_count: null,
        outputs: [],
      },
      {
        cell_type: "code",
        source: [
          "# Step 2: Upload & Install (if zip already uploaded, this unzips in place)\n",
          "import os, glob, json, textwrap, pathlib\n",
          "!ls -lh colab-render-*.zip 2>/dev/null || echo \"Please upload colab-render-*.zip via Files panel, then re-run this cell\"\n",
          "!unzip -q -o colab-render-*.zip 2>/dev/null && echo \"✅ Unzipped\" || echo \"No zip found yet\"\n",
          "!ls -d colab-render-*/ 2>/dev/null | head -n1\n",
        ],
        metadata: {},
        execution_count: null,
        outputs: [],
      },
      {
        cell_type: "code",
        source: [
          "# Step 2b: Install Dependencies\n",
          "!cd $(ls -d colab-render-*/ 2>/dev/null | head -n1 || echo .) && npm install --no-audit --prefer-offline\n",
        ],
        metadata: {},
        execution_count: null,
        outputs: [],
      },
      {
        cell_type: "code",
        source: [
          "# Step 3: Render Video (frame-accurate Remotion + FFmpeg H.264/AAC)\n",
          "BUNDLE_DIR=$(ls -d colab-render-*/ 2>/dev/null | head -n1); BUNDLE_DIR=${BUNDLE_DIR:-.}\n",
          "!cd $BUNDLE_DIR 2>/dev/null || cd .; echo \"Bundle dir: $(pwd)\" && ls -lh project_state.json scripts/render_colab.mjs 2>&1 | head\n",
        ],
        metadata: {},
        execution_count: null,
        outputs: [],
      },
      {
        cell_type: "code",
        source: [
          "# Step 3b: Execute Render (parallel asset cache → range server → Chromium → FFmpeg H.264/AAC)\n",
          "BUNDLE_DIR=$(ls -d colab-render-*/ 2>/dev/null | head -n1); BUNDLE_DIR=${BUNDLE_DIR:-.}\n",
          "!cd $BUNDLE_DIR 2>/dev/null || cd .; node scripts/render_colab.mjs --state project_state.json --out output.mp4\n",
        ],
        metadata: {},
        execution_count: null,
        outputs: [],
      },
      {
        cell_type: "code",
        source: [
          "# Step 4: Preview & Download\n",
          "from IPython.display import Video as IPVideo, display\n",
          "import pathlib\n",
          "cand = list(pathlib.Path('.').rglob('output.mp4'))\n",
          "p = str(cand[0]) if cand else 'output.mp4'\n",
          "print(f\"Preview: {p}\")\n",
          "try:\n",
          "    display(IPVideo(p, width=640))\n",
          "except Exception as e:\n",
          "    print(f\"Preview unavailable: {e}\")\n",
          "from google.colab import files\n",
          "try:\n",
          "    files.download(p)\n",
          "except Exception as e:\n",
          "    print(f\"Download trigger failed (use Files panel): {e}\")\n",
        ],
        metadata: {},
        execution_count: null,
        outputs: [],
      },
    ],
  };
  return JSON.stringify(nb, null, 2);
}

export async function POST(request: NextRequest) {
  const warnings: string[] = [];
  try {
    const body = await request.json();
    const projectState = body.projectState || body.state || body.editorState;
    const quality: string = body.quality || "720p";
    const fps: number = body.fps || 30;

    if (!projectState) {
      return NextResponse.json({ error: "Missing 'projectState' in request body" }, { status: 400 });
    }

    const jobId: string = projectState.jobId || body.jobId || "job";
    const rootDir = process.cwd();
    const { width, height } = getDimensions(projectState.orientation, quality);

    const updatedState = {
      ...projectState,
      width,
      height,
      fps,
      render_engine: "remotion-colab",
    };

    const embeddedAssets: { original: string; zippedAs: string }[] = [];
    const tracks = updatedState.tracks || [];
    for (const track of tracks) {
      for (const item of track.items || []) {
        for (const key of ["storageUrl", "storagePath", "assetId"] as const) {
          const val: string | undefined = (item as Record<string, unknown>)[key] as string | undefined;
          if (!val || typeof val !== "string") continue;
          if (val.startsWith("http://") || val.startsWith("https://") || val.startsWith("assets/")) continue;
          const clean = val.replace("file://", "");
          const tryPaths = [
            clean,
            path.join(rootDir, clean),
            path.join(rootDir, "public", clean.replace(/^\//, "")),
            path.resolve(rootDir, clean),
          ];
          const found = tryPaths.find((p) => fs.existsSync(p) && fs.statSync(p).isFile());
          if (found) {
            const basename = path.basename(found);
            const zippedAs = `assets/${basename}`;
            if (!embeddedAssets.some((a) => a.zippedAs === zippedAs)) {
              embeddedAssets.push({ original: found, zippedAs });
            }
            (item as Record<string, unknown>)[key] = zippedAs;
            if (key === "storagePath" && !item.storageUrl) item.storageUrl = zippedAs;
          } else {
            warnings.push(`Local asset not found on server and will fail on Colab: ${val} (item ${item.id})`);
          }
        }
      }
    }

    const zip = new JSZip();
    const scopedFiles = collectScopedFiles(rootDir);
    if (scopedFiles.length < 8) warnings.push(`Only ${scopedFiles.length} scoped files found — some src files may be missing`);

    const bundleDir = `colab-render-${jobId.slice(0, 8)}`;
    for (const f of scopedFiles) {
      const content = fs.readFileSync(f.abs);
      zip.file(`${bundleDir}/${f.rel}`, content);
    }
    zip.file(`${bundleDir}/project_state.json`, JSON.stringify(updatedState, null, 2));
    zip.file(`${bundleDir}/package.json`, buildMinimalPackageJson(rootDir, warnings));
    zip.file(`${bundleDir}/Colab_Video_Renderer.ipynb`, buildNotebookJson(jobId));

    for (const a of embeddedAssets) {
      const content = fs.readFileSync(a.original);
      zip.file(`${bundleDir}/${a.zippedAs}`, content);
    }

    const buffer = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE", compressionOptions: { level: 9 } });
    const filename = `colab-render-${jobId.slice(0, 8)}.zip`;
    const warningsHeader = warnings.length > 0 ? encodeURIComponent(warnings.slice(0, 10).join(" | ").slice(0, 8000)) : "";

    return new NextResponse(new Uint8Array(buffer) as unknown as BodyInit, {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": buffer.length.toString(),
        "X-Colab-Warnings": warningsHeader,
        "X-Colab-Asset-Count": embeddedAssets.length.toString(),
        "X-Colab-File-Count": (scopedFiles.length + 3 + embeddedAssets.length).toString(),
      },
    });
  } catch (err) {
    console.error("[export-colab] Failed:", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Export failed" }, { status: 500 });
  }
}
