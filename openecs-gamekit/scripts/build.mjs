import { mkdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const packageDir = path.resolve(scriptDir, "..");
const sourcePath = path.join(packageDir, "src", "index.js");
const distDir = path.join(packageDir, "dist");
const distPath = path.join(distDir, "index.js");

const source = await readFile(sourcePath, "utf8");
const banner = "// Generated from src/index.js by scripts/build.mjs\n";

await mkdir(distDir, { recursive: true });
await writeFile(distPath, `${banner}${source}`, "utf8");
