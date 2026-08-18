import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const backendDist = path.join(rootDir, "backend", "dist");
const frontendDist = path.join(rootDir, "frontend", "dist");

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

if (fs.existsSync(backendDist)) {
  fs.rmSync(backendDist, { recursive: true, force: true });
}

if (fs.existsSync(frontendDist)) {
  copyDir(frontendDist, backendDist);
  console.log("Successfully synced admin frontend build to backend/dist");
} else {
  console.warn("Warning: frontend/dist does not exist. Please build frontend first.");
}
