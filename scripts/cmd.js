import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { setTimeout } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import { Parcel } from "@parcel/core";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, "..");
const distDir = path.join(rootDir, "dist");

if (fs.existsSync(distDir)) {
  fs.rmSync(distDir, { recursive: true, force: true });
}

/**
 * @param {import("@parcel/types").InitialParcelOptions} options
 * @returns {import("@parcel/types").InitialParcelOptions}
 */
function defineConfig(options = {}) {
  const entries = [options.entries]
    .flat()
    .map((entry) => entry && path.join(rootDir, entry))
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
    additionalReporters: [
      {
        packageName: "@parcel/reporter-cli",
        resolveFrom: __filename,
      },
    ],
    env: { NODE_ENV: "production" },
    ...options,
    entries,
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
        engines: { browsers: "chrome 87" },
      },
    },
  }),
];

async function startServer(targetDir) {
  return new Promise((resolve) => {
    const server = spawn("serve", ["-s", "-L", "-n", "-u"], {
      shell: true,
      cwd: targetDir,
      stdio: ["inherit", "pipe", "inherit"],
    });

    // Cleanup on exit
    const cleanup = () => {
      server.kill();
      process.off("SIGQUIT", cleanup);
      process.off("SIGTERM", cleanup);
      process.off("SIGINT", cleanup);
    };
    process.on("SIGQUIT", cleanup);
    process.on("SIGTERM", cleanup);
    process.on("SIGINT", cleanup);

    server.stdout.on("data", (data) => {
      const output = data.toString();
      const urls = output.split(/\s+/).filter((chunk) => {
        try {
          new URL(chunk);
          return true;
        } catch {
          return false;
        }
      });

      if (urls.length > 0) {
        const url = new URL(urls[0]);
        console.log(`[web] Server running at port: ${url.port}`);
        resolve({ server, port: url.port });
      }
    });

    server.on("error", (err) => {
      console.error("Server error:", err);
      resolve(null);
    });
  });
}

async function killServer(server) {
  return new Promise((resolve) => {
    if (!server || server.killed) {
      return resolve(true);
    }

    server.once("exit", () => {
      resolve(true);
    });

    server.once("error", () => {
      resolve(false);
    });

    server.kill();
  });
}

async function handleDev() {
  const servers = new Map();

  for (const [i, config] of configs.entries()) {
    const entryPath = path.relative(rootDir, config.entries[0]);
    const bundler = new Parcel(config);

    bundler.watch(async (error, event) => {
      if (error) {
        console.error("Build error:", error);
        return;
      }

      if (!event || event.type === "buildFailure") {
        console.warn(`Build failed for '${entryPath}'`);
        return;
      }

      const { targets } = config;
      if (targets && !Array.isArray(targets)) {
        const [targetName, target] = Object.entries(targets)[0];
        const key = `${targetName}-${i}`;

        switch (target.context) {
          case "browser":
            {
              if (servers.has(key)) {
                const { server } = servers.get(i);
                console.clear();
                console.log(
                  `[web] Files changed for ${targetName}... restart!`,
                );
                const killed = await killServer(server);
                await setTimeout(1_000);
                if (killed) {
                  servers.delete(key);
                  console.log(
                    `[web] Successfully stopped server for ${targetName}`,
                  );
                } else {
                  console.warn(`[web] Failed to stop server for ${targetName}`);
                  return;
                }
              }

              console.log(`[web] Starting new server for ${targetName}...`);
              const serverInfo = await startServer(target.distDir);
              if (serverInfo) {
                servers.set(key, serverInfo);
                console.log(
                  `[web] Successfully started server for ${targetName}`,
                );
              }
            }
            break;
        }
      }
    });
  }

  return servers;
}

async function handleBuild() {
  await Promise.all(configs.map((config) => new Parcel(config).run()));
}

async function main() {
  const args = new Set(process.argv.slice(2));
  const isDev = args.has("--dev");
  const isBuild = args.has("--build");

  try {
    if (isDev) {
      await handleDev();
    } else if (isBuild) {
      await handleBuild();
    } else {
      console.log("Usage: node script.js [--dev|--build]");
      process.exit(1);
    }
  } catch (err) {
    console.error("Error:", err);
    process.exit(1);
  }
}

main();
