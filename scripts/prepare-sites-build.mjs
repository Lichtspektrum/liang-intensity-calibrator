import { access, copyFile, mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = process.cwd();
const dist = resolve(root, "dist");
const indexHtml = resolve(dist, "index.html");
const serverDir = resolve(dist, "server");
const hostingDir = resolve(dist, ".openai");

await access(indexHtml);
await mkdir(serverDir, { recursive: true });
await mkdir(hostingDir, { recursive: true });
await copyFile(resolve(root, ".openai", "hosting.json"), resolve(hostingDir, "hosting.json"));

await writeFile(
  resolve(serverDir, "index.js"),
  `export default {
  async fetch(request, env) {
    const response = await env.ASSETS.fetch(request);
    if (response.status !== 404 || new URL(request.url).pathname !== "/") {
      return response;
    }

    return env.ASSETS.fetch(new Request(new URL("/index.html", request.url), request));
  },
};
`,
);
