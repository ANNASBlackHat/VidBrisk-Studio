import { bundle } from "@remotion/bundler";
import { enableTailwind } from "@remotion/tailwind";
import webpack from "webpack";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const bundleDir = path.join(rootDir, ".remotion-bundle");

// Load .env.local if present
const envLocalPath = path.join(rootDir, ".env.local");
if (fs.existsSync(envLocalPath)) {
  const content = fs.readFileSync(envLocalPath, "utf-8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx > 0) {
      const key = trimmed.slice(0, eqIdx).trim();
      const val = trimmed.slice(eqIdx + 1).trim();
      if (!process.env[key]) {
        process.env[key] = val;
      }
    }
  }
}

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
      const modifiedConfig = enableTailwind({
        ...config,
        resolve: {
          ...(config.resolve || {}),
          alias: {
            ...(config.resolve?.alias || {}),
            "@": path.join(rootDir, "src"),
          },
        },
      });

      const maptilerKey = process.env.REMOTION_MAPTILER_KEY || "";
      modifiedConfig.plugins.push(
        new webpack.DefinePlugin({
          "process.env.REMOTION_MAPTILER_KEY": JSON.stringify(maptilerKey),
        })
      );

      return modifiedConfig;
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
