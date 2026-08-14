import { createReadStream, statSync } from "node:fs";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { Plugin } from "vite";

const mediaFiles = new Map([
  [
    "/video/liang-evolution.webm",
    { path: new URL("../media/liang-evolution.webm", import.meta.url), type: "video/webm" },
  ],
  [
    "/video/liang-evolution.mp4",
    { path: new URL("../media/liang-evolution.mp4", import.meta.url), type: "video/mp4" },
  ],
]);

function parseRange(range: string, size: number): { start: number; end: number } | null {
  const match = /^bytes=(\d*)-(\d*)$/u.exec(range);
  if (!match || (!match[1] && !match[2])) return null;

  const start = match[1] ? Number(match[1]) : Math.max(0, size - Number(match[2]));
  const requestedEnd = match[2] && match[1] ? Number(match[2]) : size - 1;
  const end = Math.min(requestedEnd, size - 1);

  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || start > end || start >= size) {
    return null;
  }

  return { start, end };
}

function sendMedia(
  request: IncomingMessage,
  response: ServerResponse,
  media: { path: URL; type: string },
): void {
  const { size } = statSync(media.path);
  const rangeHeader = request.headers.range;
  const range = rangeHeader ? parseRange(rangeHeader, size) : undefined;

  response.setHeader("Accept-Ranges", "bytes");
  response.setHeader("Cache-Control", "no-store");
  response.setHeader("Content-Type", media.type);

  if (rangeHeader && !range) {
    response.statusCode = 416;
    response.setHeader("Content-Range", `bytes */${size}`);
    response.end();
    return;
  }

  if (range) {
    response.statusCode = 206;
    response.setHeader("Content-Range", `bytes ${range.start}-${range.end}/${size}`);
    response.setHeader("Content-Length", String(range.end - range.start + 1));
  } else {
    response.statusCode = 200;
    response.setHeader("Content-Length", String(size));
  }

  if (request.method === "HEAD") {
    response.end();
    return;
  }

  const stream = createReadStream(media.path, range);
  const destroyStream = (): void => stream.destroy();
  const handleError = (error: Error): void => {
    if (response.headersSent) {
      response.destroy(error);
      return;
    }

    response.statusCode = 500;
    response.end();
  };
  const removeLifecycleListeners = (): void => {
    request.off("aborted", destroyStream);
    response.off("close", destroyStream);
    stream.off("error", handleError);
  };

  request.once("aborted", destroyStream);
  response.once("close", destroyStream);
  stream.once("error", handleError);
  stream.once("close", removeLifecycleListeners);
  stream.pipe(response);
}

export function localMediaPlugin(): Plugin {
  return {
    name: "local-video-media",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        if (request.method !== "GET" && request.method !== "HEAD") {
          next();
          return;
        }

        const pathname = new URL(request.url ?? "/", "http://localhost").pathname;
        const media = mediaFiles.get(pathname);
        if (!media) {
          next();
          return;
        }

        try {
          sendMedia(request, response, media);
        } catch (error) {
          next(error);
        }
      });
    },
  };
}
