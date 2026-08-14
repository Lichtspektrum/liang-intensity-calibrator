import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { loadEnvFile } from "node:process";

import { handleApiRequest } from "./api/app";
import { handleScheduled } from "./api/scheduled";
import type { Env } from "./api/shared";
import { runStructuredAi } from "./ai-runtime";
import { LocalDatabase } from "./database";

try { loadEnvFile(".env.local"); } catch {}

const host = process.env.API_HOST?.trim() || "127.0.0.1";
const port = Number(process.env.API_PORT || 8787);
const dataDirectory = resolve(process.env.DATA_DIRECTORY || ".data");
mkdirSync(dataDirectory, { recursive: true });

const database = new LocalDatabase(
  resolve(dataDirectory, "liang.sqlite"),
  resolve("migrations"),
);
const env: Env = {
  DB: database,
  AI_RUNNER: runStructuredAi,
  VOTER_HASH_SECRET: process.env.VOTER_HASH_SECRET || "local-development-secret-change-me-now",
  ALLOWED_ORIGINS: process.env.ALLOWED_ORIGINS
    || "http://127.0.0.1:5173,http://localhost:5173",
};

async function bodyOf(request: IncomingMessage): Promise<Buffer | undefined> {
  if (request.method === "GET" || request.method === "HEAD") return undefined;
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks);
}

async function serve(request: IncomingMessage, response: ServerResponse): Promise<void> {
  const url = new URL(request.url || "/", `http://${host}:${port}`);
  if (url.pathname === "/health") {
    response.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
    response.end(JSON.stringify({ ok: true, storage: "sqlite", model: "opencode-cli-on-demand" }));
    return;
  }

  const headers = new Headers();
  for (const [name, value] of Object.entries(request.headers)) {
    if (Array.isArray(value)) value.forEach((item) => headers.append(name, item));
    else if (value !== undefined) headers.set(name, value);
  }
  const remoteAddress = request.socket.remoteAddress?.replace(/^::ffff:/, "") || "127.0.0.1";
  headers.set("X-Client-IP", remoteAddress);
  const fetchRequest = new Request(url, {
    method: request.method,
    headers,
    body: await bodyOf(request) as BodyInit | undefined,
  });
  const fetchResponse = await handleApiRequest(fetchRequest, env);
  const responseHeaders: Record<string, string> = {};
  fetchResponse.headers.forEach((value, name) => { responseHeaders[name] = value; });
  response.writeHead(fetchResponse.status, responseHeaders);
  response.end(Buffer.from(await fetchResponse.arrayBuffer()));
}

const server = createServer((request, response) => {
  void serve(request, response).catch((error) => {
    console.error(error);
    if (!response.headersSent) response.writeHead(500, { "Content-Type": "application/json" });
    response.end(JSON.stringify({ error: "internal server error" }));
  });
});

server.once("error", (error: NodeJS.ErrnoException) => {
  if (error.code === "EADDRINUSE") {
    console.error(`Port ${port} is already in use. The API may already be running.`);
  } else {
    console.error(error);
  }
  database.close();
  process.exit(1);
});

server.listen(port, host, () => {
  console.log(`Local API listening on http://${host}:${port}`);
});

const scheduler = setInterval(() => {
  void handleScheduled(env).catch(console.error);
}, 60 * 60 * 1_000);
scheduler.unref();

function shutdown(): void {
  clearInterval(scheduler);
  server.close(() => {
    database.close();
    process.exit(0);
  });
}
process.once("SIGINT", shutdown);
process.once("SIGTERM", shutdown);
