import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");

async function run() {
  console.log("Creating test project state for Colab export...");

  const testState = {
    jobId: "colab-test-job",
    fps: 30,
    totalDuration: 6.0,
    width: 1280,
    height: 720,
    orientation: "horizontal",
    transitionStyle: "flash",
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
            storageUrl: "https://cdn.pixabay.com/video/2015/08/10/228-135860602_medium.mp4",
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
            storageUrl: "https://cdn.pixabay.com/video/2024/08/13/226200_medium.mp4",
            sourceIn: 0,
            sourceOut: 3.0,
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
            id: "txt_1",
            trackStart: 0.5,
            trackEnd: 2.8,
            duration: 2.3,
            content: "Colab Cloud Rendering Test (Flash Transition)",
            style: "standard",
          },
          {
            id: "txt_2",
            trackStart: 3.2,
            trackEnd: 5.8,
            duration: 2.6,
            content: "Scene 2 - Rendered via Google Colab GPU",
            style: "standard",
          },
        ],
      },
    ],
  };

  console.log("Calling POST http://localhost:3000/api/export-colab...");
  const res = await fetch("http://localhost:3000/api/export-colab", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      projectState: testState,
      quality: "720p",
      fps: 30,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Export failed (${res.status}): ${errText}`);
  }

  const outZipPath = path.join(rootDir, "public", "renders", "colab_export_test.zip");
  const buffer = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(outZipPath, buffer);
  console.log(`✅ Saved export package (${(buffer.length / 1024).toFixed(1)} KB) to: ${outZipPath}`);
}

run().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
