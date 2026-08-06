# SIH 2026 · Team Builder

Team-formation portal for the Smart India Hackathon 2026. Built with **Vite + React 19**, **Supabase** (auth + Postgres), **anime.js** for animations, and **next-themes** for dark/light mode.

## Stack

- Vite 7 + React 19 (TypeScript, Tailwind v4, react-router-dom)
- Supabase Auth (phone + password) + Postgres (profiles, teams, invites, problems, themes)
- anime.js v4 (aurora background, reveal animations, toast entrances)
- next-themes (class-based theming)

## Setup

1. **Install Node** (18+). Portable option: download the `win-x64.zip` from nodejs.org and extract.

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Configure Supabase**
   - Create a project at [supabase.com](https://supabase.com).
   - Open **SQL Editor** and run the whole file `supabase/schema.sql`. This creates tables, RLS policies, the team-rule RPC functions, seed themes/problems, and the auto-profile trigger.
   - Enable phone auth: **Authentication → Sign In / Sign Up → Providers → Phone → ON**.
   - Turn **off** “Confirm phone” (and email confirmations) for instant login, or keep them on for the OTP flow.
   - Set **Authentication → URL Configuration → Site URL → `http://localhost:5173`**.
   - Copy `.env.local.example` → `.env.local` and fill in your project URL + anon key (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`).

4. **Run**

   ```bash
   npm run dev
   ```

   Open http://localhost:5173.

5. **First admin** — register a student account from the app, then in the SQL editor run:

   ```sql
   select public.promote_admin('<phone-number>');
   ```

   The admin overview is at `/admin`.

## Features

- Register with ordered profile fields (name → section → department → domain → language → gender → GitHub → phone → tech stack) and sign in with phone + password.
- Browse all teams with live rule badges (`valid` / reasons like “needs 2 departments”).
- Create a team (become leader), request to join, send invites, accept/reject join requests.
- Find members by tech stack, name, department, section or language and invite them.
- Server-side (Postgres RPC) enforcement of team rules: **max 6 members, ≥ 2 female members, ≥ 2 distinct departments** — violations are rejected with a clear message.
- Admin page: student list with new fields, stats, and one-click admin promotion.
- Dark-first UI with glowing badges, animated aurora background, staggered reveals, and themed toasts.

## Rules

| Rule | Value |
| --- | --- |
| Max team size | 6 members |
| Minimum female members | 2 |
| Minimum departments | 2 |

Rules are validated inside `public.accept_invite` (via `team_rules_violation`), so they hold regardless of the client.

## Project structure

```
index.html            Vite entry (fonts, favicon, #root)
src/
  main.tsx            BrowserRouter + ThemeProvider + ToastProvider + aurora bg
  pages/              Landing, Dashboard, Admin
  components/
    unlumen-ui/       Button, Input/Select, Card, GlowingBadge, Avatar, Toast
    dashboard/        TeamCard + per-tab views
    aurora-background.tsx   anime.js animated backdrop
  lib/
    supabase/client.ts      Browser Supabase client (graceful when unconfigured)
    data.ts                 Queries + RPC wrappers
    types.ts, utils.ts      Types + rule/format helpers
supabase/schema.sql       Full database schema, RLS, RPCs, seeds
```

## Notes

- The repository also contains the original Python (`server.py` + `data/`) prototype — the React app lives in `sih-portal/` and does not depend on it.
- The anon key is public by design; all write paths are gated by RLS policies and `security definer` RPC functions.
