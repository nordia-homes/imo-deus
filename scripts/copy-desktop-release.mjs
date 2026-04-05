import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const sourceDir = path.join(root, "dist-desktop");
const targetDir = path.join(root, "desktop-downloads");
const packageJson = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
const version = packageJson.version;

const files = [
  `ImoDeus Desktop Setup ${version}.exe`,
  `ImoDeus Desktop Setup ${version}.exe.blockmap`,
  "latest.yml",
];

for (const file of files) {
  fs.copyFileSync(path.join(sourceDir, file), path.join(targetDir, file));
}

console.log("Copied desktop release artifacts:", files.join(", "));
