import { copyFile, mkdir, rm, stat } from "node:fs/promises";
import { resolve } from "node:path";

const MAX_FILE_SIZE = 25 * 1024 * 1024;
const mediaFiles = ["liang-evolution.webm", "liang-evolution.mp4"];
const projectRoot = process.cwd();
const sourceDirectory = resolve(projectRoot, "media");
const targetDirectory = resolve(projectRoot, "dist-pages/video");

await rm(targetDirectory, { recursive: true, force: true });
await mkdir(targetDirectory, { recursive: true });

for (const filename of mediaFiles) {
  const source = resolve(sourceDirectory, filename);
  const file = await stat(source);
  if (!file.isFile()) throw new Error(`${filename} 不是文件`);
  if (file.size >= MAX_FILE_SIZE) {
    throw new Error(`${filename} 必须小于 25 MiB`);
  }
  await copyFile(source, resolve(targetDirectory, filename));
}
