# SIH Portal (Vite + React SPA)

- Run dev server: `npm run dev` (Vite, http://localhost:5173).
- Build/typecheck: `npm run build` (runs `tsc` then `vite build`).
- Aliases: `@/*` → `./src/*`.
- Routing uses `react-router-dom` (BrowserRouter in `src/main.tsx`).
- Env vars are prefixed `VITE_` (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`), see `.env.local.example`.
