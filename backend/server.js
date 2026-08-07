import express from "express";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { runMigrations } from "./database.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
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
