# SPOC Backend

The SPOC portal **does not have a standalone backend server**.
It reuses the existing `participant_mentor/backend` (runs on port 3003).

All SPOC API endpoints (`/api/spoc/final-teams`, `/api/auth/*`, `/api/teams`) are
served by that backend. Make sure it is running before using this portal.

---

## Setup (run once, in order)

### Step 1 — Add service-role key to participant_mentor/backend/.env

The provisioning script needs Supabase admin access. Add:

```env
SUPABASE_SERVICE_KEY=your_service_role_key_here
SPOC_PHONE=9789526297
SPOC_PASSWORD=rajanspoc@smvec_sih
SPOC_NAME=Rajan SPOC
```

Get the service key from:
**Supabase Dashboard → Settings → API → service_role** (keep it secret — server-side only).

### Step 2 — Run the database migration

```bash
# From this directory (SPOC/backend)
node run-migration.js
```

Or paste `migrations/20260821_spoc_setup.sql` into the Supabase SQL Editor.

### Step 3 — Provision the SPOC user

```bash
# From this directory (SPOC/backend)
node create-spoc-user.js
```

This script:
- Creates a Supabase Auth account using an internal email derived from the phone number
  (`9789526297@spoc.smvec.ac.in` — **never shown to the user**)
- Sets the password from `SPOC_PASSWORD`
- Upserts a `profiles` row with `role = 'spoc'`
- Is safe to re-run (idempotent — updates if user already exists)

The SPOC logs in at the portal using:
- **Phone number**: `9789526297`
- **Password**: value of `SPOC_PASSWORD` env var

---

## Start the backend (participant_mentor)

```bash
cd ../../participant_mentor/backend
npm run dev   # starts on port 3003
```

---

## Security notes

- `SUPABASE_SERVICE_KEY` must **never** be in frontend code or committed to public repos
- `SPOC_PASSWORD` is stored only in `.env` (which is in `.gitignore`)
- The internal email (`phone@spoc.smvec.ac.in`) is derived at runtime — not stored or displayed
- The SPOC user is identified by phone number only from the UI perspective
