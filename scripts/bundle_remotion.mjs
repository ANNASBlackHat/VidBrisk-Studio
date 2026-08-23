import { bundle } from "@remotion/bundler";
import { enableTailwind } from "@remotion/tailwind";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const bundleDir = path.join(rootDir, ".remotion-bundle");

export async function bundleRemotion({ force = false, silent = false } = {}) {
  const indexHtml = path.join(bundleDir, "index.html");

  if (!force && fs.existsSync(indexHtml)) {
    if (!silent) {
      console.log(`[Remotion Bundler] ⚡ Found existing pre-built bundle at ${bundleDir}`);
    }
    return bundleDir;
  }

  if (!silent) {
    console.log("[Remotion Bundler] 📦 Pre-bundling composition entrypoint with Tailwind & path aliases...");
  }

  fs.mkdirSync(bundleDir, { recursive: true });

  const start = Date.now();
  const bundleLocation = await bundle({
    entryPoint: path.join(rootDir, "src", "remotion", "index.tsx"),
    outDir: bundleDir,
    webpackOverride: (config) => {
      return enableTailwind({
        ...config,
        resolve: {
          ...(config.resolve || {}),
          alias: {
            ...(config.resolve?.alias || {}),
            "@": path.join(rootDir, "src"),
          },
        },
      });
    },
  });

  const duration = ((Date.now() - start) / 1000).toFixed(2);
  if (!silent) {
    console.log(`[Remotion Bundler] ✅ Bundle ready in ${duration}s -> ${bundleLocation}`);
  }

  return bundleLocation;
}

// Allow direct execution: node scripts/bundle_remotion.mjs [--force]
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const force = process.argv.includes("--force");
  bundleRemotion({ force })
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("[Remotion Bundler] ❌ Bundling failed:", err);
      process.exit(1);
    });
}
