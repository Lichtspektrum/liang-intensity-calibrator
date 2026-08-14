import { defineConfig } from "vite";
import { localMediaPlugin } from "./scripts/vite-local-media.ts";

export default defineConfig({
  plugins: [localMediaPlugin()],
});
