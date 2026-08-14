import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

const ERROR_MESSAGE =
  "VITE_API_BASE_URL must be an absolute HTTPS origin without credentials, path, query, hash, or trailing slash.";

export function validateApiBaseUrl(value) {
  if (typeof value !== "string" || value.length === 0 || value !== value.trim()) {
    throw new Error(ERROR_MESSAGE);
  }

  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error(ERROR_MESSAGE);
  }

  if (
    url.protocol !== "https:" ||
    url.username !== "" ||
    url.password !== "" ||
    value.includes("@") ||
    url.pathname !== "/" ||
    url.search !== "" ||
    url.hash !== "" ||
    value.endsWith("/") ||
    value !== url.origin
  ) {
    throw new Error(ERROR_MESSAGE);
  }

  return value;
}

const isCommand =
  process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isCommand) {
  try {
    validateApiBaseUrl(process.env.VITE_API_BASE_URL);
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : ERROR_MESSAGE}\n`);
    process.exitCode = 1;
  }
}
