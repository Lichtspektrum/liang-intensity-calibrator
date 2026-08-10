import { access, copyFile, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = process.cwd();
const dist = resolve(root, "dist");
const clientDir = resolve(dist, "client");
const indexHtml = resolve(clientDir, "index.html");
const serverDir = resolve(dist, "server");
const hostingDir = resolve(dist, ".openai");
const workerDir = resolve(dist, "liang_slider");
const workerEntry = resolve(workerDir, "index.js");
const workerConfig = resolve(workerDir, "wrangler.json");

await access(indexHtml);
await access(workerEntry);
await access(workerConfig);
await mkdir(serverDir, { recursive: true });
await mkdir(hostingDir, { recursive: true });
await copyFile(resolve(root, ".openai", "hosting.json"), resolve(hostingDir, "hosting.json"));
await copyFile(workerEntry, resolve(serverDir, "index.js"));

const config = JSON.parse(await readFile(workerConfig, "utf8"));
config.main = "./server/index.js";
config.assets.directory = "./client";
await writeFile(
  resolve(dist, "wrangler.json"),
  `${JSON.stringify(config, null, 2)}\n`,
);

await Promise.all(
  ["assets", "frames", "portraits", "index.html"].map((path) =>
    rm(resolve(dist, path), { force: true, recursive: true }),
  ),
);
