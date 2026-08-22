import { NextRequest, NextResponse } from "next/server";
import { execFile } from "child_process";
import path from "path";
import fs from "fs";
import os from "os";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const projectState = body.projectState;
    const quality = body.quality || "720p";
    const fps = body.fps || 30;

    if (!projectState) {
      return NextResponse.json(
        { error: "Missing 'projectState' in request body" },
        { status: 400 }
      );
    }

    let width = 1280;
    let height = 720;
    if (quality === "1080p") {
      width = projectState.orientation === "vertical" ? 1080 : 1920;
      height = projectState.orientation === "vertical" ? 1920 : 1080;
    } else if (quality === "4k") {
      width = projectState.orientation === "vertical" ? 2160 : 3840;
      height = projectState.orientation === "vertical" ? 3840 : 2160;
    } else {
      width = projectState.orientation === "vertical" ? 720 : 1280;
      height = projectState.orientation === "vertical" ? 1280 : 720;
    }

    if (projectState.orientation === "square") {
      const dim = quality === "720p" ? 720 : quality === "4k" ? 2160 : 1080;
      width = dim;
      height = dim;
    }

    const updatedState = {
      ...projectState,
      width,
      height,
      fps,
    };

    // Write temp state JSON
    const tempDir = os.tmpdir();
    const statePath = path.join(tempDir, `state-${Date.now()}.json`);
    fs.writeFileSync(statePath, JSON.stringify(updatedState, null, 2), "utf-8");

    const outDir = path.join(process.cwd(), "public", "renders");
    fs.mkdirSync(outDir, { recursive: true });
    const filename = `render-${(projectState.jobId || "video").slice(0, 8)}-${width}x${height}-${Date.now()}.mp4`;
    const outputPath = path.join(outDir, filename);

    const scriptPath = path.join(process.cwd(), "scripts", "render_video.mjs");

    await new Promise<void>((resolve, reject) => {
      const child = execFile(
        "node",
        [scriptPath, "--state", statePath, "--out", outputPath],
        { maxBuffer: 1024 * 1024 * 50 }
      );

      child.stdout?.on("data", (data) => {
        process.stdout.write(data.toString());
      });

      child.stderr?.on("data", (data) => {
        process.stderr.write(data.toString());
      });

      child.on("close", (code) => {
        try {
          if (fs.existsSync(statePath)) fs.unlinkSync(statePath);
        } catch {}

        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`Remotion renderer exited with code ${code}`));
        }
      });
    });

    const videoUrl = `/renders/${filename}`;
    return NextResponse.json({
      status: "complete",
      render_engine: "remotion-native",
      video_url: videoUrl,
      filename,
      width,
      height,
      fps,
    });
  } catch (err) {
    console.error("Remotion render route error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Render failed" },
      { status: 500 }
    );
  }
}
