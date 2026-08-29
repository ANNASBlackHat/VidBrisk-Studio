import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { Readable } from "stream";

/**
 * Media streaming and proxy endpoint with Range support and permissive CORS.
 * Resolves local file paths (such as synthesized WAVs or cached videos) and remote media URLs.
 */
function resolveLocalPath(p: string): string | null {
  const rootDir = process.cwd();
  const clean = p.replace(/^file:\/\//, "");
  const candidates = [
    clean,
    path.resolve(clean),
    path.resolve(rootDir, clean),
    path.resolve(rootDir, "..", "video-generation-pipeline", clean),
    path.resolve(rootDir, "..", clean),
    path.resolve(rootDir, "public", clean),
  ];
  for (const cand of candidates) {
    if (fs.existsSync(cand)) {
      return cand;
    }
  }
  return null;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const rawPath = searchParams.get("path");
  const remoteUrl = searchParams.get("url");

  if (remoteUrl) {
    // Redirect to direct remote URL so browser streams directly with native range support
    return NextResponse.redirect(remoteUrl, {
      headers: {
        "Access-Control-Allow-Origin": "*",
      },
    });
  }

  if (!rawPath) {
    return new NextResponse("Missing 'path' or 'url' query parameter", {
      status: 400,
    });
  }

  // Handle local filesystem paths
  try {
    const filePath = resolveLocalPath(rawPath);
    if (!filePath || !fs.existsSync(filePath)) {
      // If not on disk, check if it can be redirected to the backend static server
      const clean = rawPath.replace(/^file:\/\//, "").replace(/^\/+/, "");
      const backendUrl = `${process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") || "http://127.0.0.1:8000"}/static/${clean}`;
      return NextResponse.redirect(backendUrl, {
        headers: {
          "Access-Control-Allow-Origin": "*",
        },
      });
    }

    const stat = fs.statSync(filePath);
    const fileSize = stat.size;
    const range = request.headers.get("range");

    const ext = path.extname(filePath).toLowerCase();
    let contentType = "application/octet-stream";
    if (ext === ".wav") contentType = "audio/wav";
    else if (ext === ".mp3") contentType = "audio/mpeg";
    else if (ext === ".mp4") contentType = "video/mp4";
    else if (ext === ".webm") contentType = "video/webm";
    else if (ext === ".jpg" || ext === ".jpeg") contentType = "image/jpeg";
    else if (ext === ".png") contentType = "image/png";

    // Handle range request for seeking
    if (range) {
      const parts = range.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunksize = end - start + 1;

      const fileStream = fs.createReadStream(filePath, { start, end });
      const webStream = Readable.toWeb(fileStream);

      return new NextResponse(webStream as unknown as BodyInit, {
        status: 206,
        headers: {
          "Content-Range": `bytes ${start}-${end}/${fileSize}`,
          "Accept-Ranges": "bytes",
          "Content-Length": chunksize.toString(),
          "Content-Type": contentType,
          "Access-Control-Allow-Origin": "*",
        },
      });
    }

    // Full file stream
    const fileStream = fs.createReadStream(filePath);
    const webStream = Readable.toWeb(fileStream);

    return new NextResponse(webStream as unknown as BodyInit, {
      status: 200,
      headers: {
        "Content-Length": fileSize.toString(),
        "Content-Type": contentType,
        "Accept-Ranges": "bytes",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (err) {
    console.error("Failed to stream local media:", err);
    return new NextResponse("Internal server error streaming media", {
      status: 500,
    });
  }
}
