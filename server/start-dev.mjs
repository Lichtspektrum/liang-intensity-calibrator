import { spawn } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const apiEntry = join(root, "node_modules", "tsx", "dist", "cli.mjs");
const viteEntry = join(root, "node_modules", "vite", "bin", "vite.js");

async function isRunning(url, validate) {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(1_000) });
    return response.ok && await validate(response);
  } catch {
    return false;
  }
}

const [apiRunning, pageRunning] = await Promise.all([
  isRunning("http://127.0.0.1:8787/health", async (response) => {
    const body = await response.json();
    return body?.ok === true && body?.storage === "sqlite";
  }),
  isRunning("http://127.0.0.1:5173/", async (response) =>
    (await response.text()).includes('id="app"'),
  ),
]);

if (apiRunning && pageRunning) {
  console.log("Liang calibrator is already running at http://127.0.0.1:5173/");
} else if (apiRunning || pageRunning) {
  console.error(
    "Only part of the app is already running. Stop the old process with Ctrl+C, then run npm start again.",
  );
  process.exitCode = 1;
} else {
const children = [
  spawn(process.execPath, [apiEntry, "src/server.ts"], {
    cwd: root,
    env: { ...process.env, NODE_NO_WARNINGS: "1" },
    stdio: "inherit",
    windowsHide: true,
  }),
  spawn(process.execPath, [viteEntry, "--host", "127.0.0.1", "--port", "5173"], {
    cwd: root,
    env: { ...process.env, VITE_API_BASE_URL: "http://127.0.0.1:8787" },
    stdio: "inherit",
    windowsHide: true,
  }),
];

let stopping = false;
function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of children) child.kill();
  process.exitCode = code;
}

for (const child of children) {
  child.once("error", (error) => {
    console.error(error);
    stop(1);
  });
  child.once("exit", (code, signal) => {
    if (!stopping) {
      console.error(`Development process stopped (${signal ?? code ?? "unknown"})`);
      stop(code ?? 1);
    }
  });
}

process.once("SIGINT", () => stop());
process.once("SIGTERM", () => stop());
}
