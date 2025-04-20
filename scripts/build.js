import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, URL } from "node:url";
import { Parcel } from "@parcel/core";
import { $, minimist, within } from "zx";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, "..");
const distDir = path.join(rootDir, "dist");
process.env.FORCE_COLOR = '1'
$.preferLocal = true
$.verbose = false
$.cwd = rootDir

if (fs.existsSync(distDir)) {
  fs.rmSync(distDir, {
    recursive: true,
    force: true,
  });
}

/**
 * @param {import("@parcel/types").InitialParcelOptions} options
 * @returns {import("@parcel/types").InitialParcelOptions}
 */
function defineConfig(options) {
  const entries = [options.entries]
    .flat()
    .map((entry) => entry && path.join(rootDir, entry))
    .filter(Boolean);

  return {
    logLevel: "verbose",
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
    additionalReporters: [
      {
        packageName: "@parcel/reporter-cli",
        resolveFrom: __filename,
      },
    ],
    env: {
      NODE_ENV: "production",
    },
    ...options,
    ...{ entries },
  };
}

const configs = [
  defineConfig({
    entries: "apps/website/index.html",
    targets: {
      renderer: {
        context: "browser",
        distDir: path.join(distDir, "public"),
        publicUrl: ".",
        engines: {
          browsers: "chrome 87",
        },
      },
    },
  }),
];

async function main() {
  const argv = minimist(process.argv.slice(2));
  if (argv.dev) {
    const instances = new Map();
    for (let i = 0; i < configs.length; i++) {
      const config = configs[i];
      const bundler = new Parcel(config);
      bundler.watch((error, event) => {
        if (error) {
          console.info(error.name, error.message, error.stack);
          return;
        }

        if (!event) return;

        if (event.type === "buildFailure") {
          console.warn(`An error occured while building '${path.relative(rootDir, config.entries?.[0])}'.`)
          return;
        }

        within(async () => {
          let timeout = setTimeout(() => {
            console.error(`Got timeout while building '${path.relative(rootDir, config.entries?.[0])}'.`);
            instances.get(i)?.kill?.("SIGINT")
            instances.delete(i)
          }, 10_000)

          await instances.get(i)?.kill?.("SIGINT")
          instances.delete(i);

          const targets = config.targets
          if (!Array.isArray(targets) && targets) {
            const key = Object.keys(targets)?.[0];
            const target = targets[key];
            switch (target.context) {
              case "browser":
                within(async () => {
                  $.cwd = target.distDir;
                  const instance = $`serve -s -L -n -u`;
                  instances.set(i, instance);
                  instance.catch((error) => {
                    if (error?.exitCode === null) return;
                    console.info(`${key} process error`, error);
                  });

                  let url;
                  for await (const chunk of instance.stdout) {
                    const data = chunk.toString("utf8").split(" ").pop();
                    console.log(data)
                    try {
                      url = new URL(data);
                      break;
                    } catch {
                      continue
                    }
                  }

                  clearTimeout(timeout);
                  console.log(`[web][${key}] runs at port: ${url.port}`)
                })
                break;
              default:
                return
            }
          }
        });
      });
    }

    ["SIGTERM", "SIGINT"].forEach(event => process.once(event, () => {
      for (const instance of instances) instance?.kill?.("SIGINT")
    }))
  } else {
    for (const config of configs) {
      const bundler = new Parcel(config);
      await bundler.run();
    }
  }
}


main();
