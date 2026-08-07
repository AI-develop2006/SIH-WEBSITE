import express from "express";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { existsSync } from "node:fs";
import dotenv from "dotenv";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load environment variables locally
if (existsSync(join(__dirname, ".env.local"))) {
  dotenv.config({ path: join(__dirname, ".env.local") });
} else if (existsSync(join(__dirname, "../frontend/.env.local"))) {
  dotenv.config({ path: join(__dirname, "../frontend/.env.local") });
} else if (existsSync(join(__dirname, ".env"))) {
  dotenv.config({ path: join(__dirname, ".env") });
} else {
  dotenv.config();
}

import { runMigrations } from "./database.js";
const app = express();
const PORT = process.env.PORT || 3000;

// Serve static files from the Vite build output
app.use(express.static(join(__dirname, "dist")));

// Catch-all: send index.html for any route so React Router works
app.get("*", (_req, res) => {
  res.sendFile(join(__dirname, "dist", "index.html"));
});

// Run migrations and then start the server listener
async function startServer() {
  try {
    await runMigrations();
  } catch (err) {
    console.error("Critical database migration failure. Continuing startup...", err);
  }

  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();
