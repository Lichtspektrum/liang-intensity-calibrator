import type { Env } from "./api/shared";

const MEDIA_PATHS = new Map([
  ["/video/liang-evolution.webm", "video/liang-evolution.webm"],
  ["/video/liang-evolution.mp4", "video/liang-evolution.mp4"],
]);

interface ByteRange {
  offset: number;
  length: number;
}

function parseRangeHeader(header: string, size: number): ByteRange | null {
  const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!match || (match[1] === "" && match[2] === "")) {
    return null;
  }

  if (match[1] === "") {
    const suffix = Number(match[2]);
    if (!Number.isInteger(suffix) || suffix <= 0) return null;
    const length = Math.min(suffix, size);
    return { offset: size - length, length };
  }

  const offset = Number(match[1]);
  const requestedEnd = match[2] === "" ? size - 1 : Number(match[2]);
  if (
    !Number.isInteger(offset) ||
    !Number.isInteger(requestedEnd) ||
    offset < 0 ||
    offset >= size ||
    requestedEnd < offset
  ) {
    return null;
  }

  const end = Math.min(requestedEnd, size - 1);
  return { offset, length: end - offset + 1 };
}

function rangeNotSatisfiable(size: number): Response {
  return new Response(null, {
    status: 416,
    headers: {
      "Accept-Ranges": "bytes",
      "Content-Range": `bytes */${size}`,
    },
  });
}

export function getMediaKey(pathname: string): string | null {
  return MEDIA_PATHS.get(pathname) ?? null;
}

export async function handleMediaRequest(
  request: Request,
  env: Env,
  key: string,
): Promise<Response> {
  if (request.method !== "GET" && request.method !== "HEAD") {
    return new Response("Method Not Allowed", {
      status: 405,
      headers: { Allow: "GET, HEAD" },
    });
  }

  const metadata = await env.MEDIA.head(key);
  if (!metadata) {
    return new Response("Not Found", { status: 404 });
  }

  const headers = new Headers();
  metadata.writeHttpMetadata(headers);
  headers.set("Accept-Ranges", "bytes");
  headers.set("Cache-Control", "public, max-age=31536000, immutable");
  headers.set("ETag", metadata.httpEtag);

  const rangeHeader = request.headers.get("Range");
  if (!rangeHeader) {
    headers.set("Content-Length", String(metadata.size));
    if (request.method === "HEAD") {
      return new Response(null, { status: 200, headers });
    }

    const object = await env.MEDIA.get(key);
    if (!object || !("body" in object)) {
      return new Response("Not Found", { status: 404 });
    }
    return new Response(object.body, { status: 200, headers });
  }

  const range = parseRangeHeader(rangeHeader, metadata.size);
  if (!range) {
    return rangeNotSatisfiable(metadata.size);
  }

  headers.set(
    "Content-Range",
    `bytes ${range.offset}-${range.offset + range.length - 1}/${metadata.size}`,
  );
  headers.set("Content-Length", String(range.length));

  if (request.method === "HEAD") {
    return new Response(null, { status: 206, headers });
  }

  const object = await env.MEDIA.get(key, { range });
  if (!object || !("body" in object)) {
    return new Response("Not Found", { status: 404 });
  }
  return new Response(object.body, { status: 206, headers });
}
