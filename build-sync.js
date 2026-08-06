import fs from "node:fs";
import path from "node:path";

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

// Remove old dist in backend if it exists
if (fs.existsSync("backend/dist")) {
  fs.rmSync("backend/dist", { recursive: true, force: true });
}

// Copy frontend/dist to backend/dist
if (fs.existsSync("frontend/dist")) {
  copyDir("frontend/dist", "backend/dist");
  console.log("Successfully synced frontend build to backend/dist");
} else {
  console.error("frontend/dist does not exist! Please run frontend build first.");
  process.exit(1);
}
