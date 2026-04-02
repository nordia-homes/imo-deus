import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const sourceDir = path.join(root, "dist-desktop");
const targetDir = path.join(root, "desktop-downloads");

const files = [
  "ImoDeus Desktop Setup 0.1.1.exe",
  "ImoDeus Desktop Setup 0.1.1.exe.blockmap",
  "latest.yml",
];

for (const file of files) {
  fs.copyFileSync(path.join(sourceDir, file), path.join(targetDir, file));
}

console.log("Copied desktop release artifacts:", files.join(", "));
