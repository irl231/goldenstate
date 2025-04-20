import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, URL } from "node:url";
import { Parcel } from "@parcel/core";
import { $, minimist, within } from "zx";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, "..");
const distDir = path.join(rootDir, "dist");

process.env.FORCE_COLOR = "1";
Object.assign($, { preferLocal: true, verbose: false, cwd: rootDir });
fs.existsSync(distDir) && fs.rmSync(distDir, { recursive: true, force: true });

/**
 * @param {import("@parcel/types").InitialParcelOptions} options
 * @returns {import("@parcel/types").InitialParcelOptions}
 */
const defineConfig = (options = {}) => {
  const entries = [options.entries]
    .flat()
    .map(entry => entry && path.join(rootDir, entry))
    .filter(Boolean);

  return {
    logLevel: "none",
    cacheDir: path.join(distDir, ".parcel-cache"),
    shouldDisableCache: true,
    defaultConfig: path.join(rootDir, "parcel.config.json"),
    mode: "production",
    defaultTargetOptions: {
      distDir,
      sourceMaps: false,
      shouldOptimize: true,
      shouldScopeHoist: true,
      outputFormat: "esmodule",
    },
    additionalReporters: [{
      packageName: "@parcel/reporter-cli",
      resolveFrom: __filename,
    }],
    env: { NODE_ENV: "production" },
    ...options,
    entries,
  };
};

const configs = [
  defineConfig({
    entries: "apps/website/index.html",
    targets: {
      renderer: {
        context: "browser",
        distDir: path.join(distDir, "public"),
        publicUrl: ".",
        engines: { browsers: "chrome 87" },
      },
    },
  }),
];

const handleBrowserTarget = async (target, key) => {
  within(async () => {
    $.cwd = target.distDir;
    const instance = $`serve -s -L -n -u`;

    ["SIGTERM", "SIGINT"].forEach(event =>
      process.once(event, () => instance.kill("SIGINT"))
    );

    instance.catch(err => {
      err?.exitCode !== null && console.info(`${key} process error`, err);
    });

    const url = await new Promise(resolve => {
      (async () => {
        for await (const chunk of instance.stdout) {
          for (const token of chunk.toString().trim().split(/\s+/)) {
            try { resolve(new URL(token)); } catch { continue; }
          }
        }
        resolve(null);
      })();
    });

    url && console.log(`[web][${key}] runs at port: ${url.port}`);
  });
};

async function main() {
  const { dev, build } = minimist(process.argv.slice(2));

  switch (true) {
    case dev:
      for (const [i, config] of configs.entries()) {
        const entryPath = path.relative(rootDir, `${config.entries?.[0]}`);
        const bundler = new Parcel(config);

        bundler.watch((error, event) => {
          if (error) return console.info(error.name, error.message, error.stack);
          if (!event) return;

          if (event.type === "buildFailure") {
            return console.warn(`An error occurred while building '${entryPath}'.`);
          }

          const { targets } = config;
          if (!Array.isArray(targets) && targets) {
            const [key] = Object.keys(targets);
            const target = targets[key];

            switch (target.context) {
              case "browser":
                handleBrowserTarget(target, key);
                break;
              case "node":
                // node-specific logic
                break;
              case "electron-main":
                // electron-main-specific logic
                break;
            }
          }
        });
      }
      break;

    case build:
      await Promise.all(configs.map(config => new Parcel(config).run()));
      break;
  }
}

main().catch(console.error);
