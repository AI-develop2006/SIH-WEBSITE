# Deployment Guide — SIH 2026 Portal with Profile Photos

This guide covers deploying your SIH portal to Render with Cloudinary profile photo uploads.

---

## Features Added

✅ User profile photos stored in Cloudinary  
✅ Clickable avatar in dashboard header — hover shows upload icon  
✅ Image validation (5MB max, images only)  
✅ Fallback to initials if no photo or upload fails  
✅ All avatars across dashboard show uploaded photos

---

## Prerequisites

1. **Supabase project** — Already set up with your URL and key in `.env`
2. **Cloudinary account** — Free tier works great (sign up at [cloudinary.com](https://cloudinary.com))
3. **Render account** — Free tier available at [render.com](https://render.com)

---

## Step 1: Set up Cloudinary

### Create Upload Preset (Unsigned)

1. Go to [cloudinary.com/console](https://cloudinary.com/console)
2. Navigate to **Settings → Upload**
3. Scroll to **Upload presets** → Click **Add upload preset**
4. Configure:
   - **Signing Mode**: `Unsigned` ✅ (important!)
   - **Upload preset name**: `sih_avatars`
   - **Folder**: `sih_avatars` (optional but recommended)
   - **Allowed formats**: `jpg,png,jpeg,webp,gif`
   - **Max file size**: 5 MB
5. Click **Save**

### Get Your Cloud Name

1. From the Cloudinary Dashboard, find your **Cloud name** (top-right, under your account name)
2. Copy it (e.g., `dhzg1234abc`)

---

## Step 2: Update `.env`

Open `.env` and replace `your_cloud_name` with your real Cloudinary cloud name:

```env
VITE_SUPABASE_URL=https://dhwosgynnnqepvelmjqj.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_Q8T8RoOFlFKJwz8WvpqxBg_4ElCSHIg

# Cloudinary credentials (replace your_cloud_name!)
VITE_CLOUDINARY_CLOUD_NAME=your_cloud_name_here
VITE_CLOUDINARY_UPLOAD_PRESET=sih_avatars
```

**Important**: These are **build-time** environment variables. Vite bakes them into the bundle, so if you change them, rebuild the app.

---

## Step 3: Apply Database Migration

Run the new migration to add the `avatar_url` column to your `profiles` table:

### Option A: Supabase SQL Editor (Recommended)

1. Open your Supabase project → **SQL Editor**
2. Run this migration:

```sql
-- Add avatar_url column to profiles table
alter table public.profiles
  add column if not exists avatar_url text default null;
```

### Option B: Supabase CLI

If you're using the CLI:

```bash
supabase migration up
```

This applies `supabase/migrations/20260101000003_avatar.sql`.

---

## Step 4: Deploy to Render

### Create a New Static Site

1. Go to [render.com/dashboard](https://render.com/dashboard)
2. Click **New → Static Site**
3. Connect your Git repository (GitHub/GitLab/Bitbucket)
4. Configure the build:

| Field | Value |
|---|---|
| **Name** | `sih-portal` (or your preferred name) |
| **Branch** | `main` (or your deployment branch) |
| **Build Command** | `npm install && npm run build` |
| **Publish Directory** | `dist` |

5. Add **Environment Variables** (click **Advanced** if needed):

```
VITE_SUPABASE_URL=https://dhwosgynnnqepvelmjqj.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_Q8T8RoOFlFKJwz8WvpqxBg_4ElCSHIg
VITE_CLOUDINARY_CLOUD_NAME=your_cloud_name_here
VITE_CLOUDINARY_UPLOAD_PRESET=sih_avatars
```

6. Click **Create Static Site**

Render will:
- Install dependencies
- Build your Vite app
- Deploy to a public URL like `https://sih-portal.onrender.com`

---

## Step 5: Update Supabase Redirect URLs

Once deployed, you need to tell Supabase about your production URL:

1. Open your Supabase project → **Authentication → URL Configuration**
2. Update **Site URL** to your Render URL:
   ```
   https://sih-portal.onrender.com
   ```
3. Add your Render URL to **Redirect URLs** as well:
   ```
   https://sih-portal.onrender.com/**
   ```

This allows Supabase auth to work from your deployed domain.

---

## Step 6: Test Profile Photo Upload

1. Visit your deployed site (e.g., `https://sih-portal.onrender.com`)
2. Log in with your account
3. In the dashboard header, **hover over your avatar** → you'll see an upload icon
4. Click it → select an image (JPG/PNG, max 5MB)
5. Wait for the upload → success toast appears
6. Your avatar updates instantly everywhere in the dashboard

---

## Files Changed

| File | Purpose |
|---|---|
| `.env` | Added `VITE_CLOUDINARY_CLOUD_NAME` and `VITE_CLOUDINARY_UPLOAD_PRESET` |
| `supabase/migrations/20260101000003_avatar.sql` | Adds `avatar_url` column to `profiles` table |
| `src/lib/types.ts` | Added `avatar_url: string \| null` to `Profile` type |
| `src/lib/data.ts` | Added `updateAvatarUrl(userId, url)` function |
| `src/lib/cloudinary.ts` | **New file** — `uploadToCloudinary(file)` utility |
| `src/components/unlumen-ui/avatar.tsx` | Updated to accept optional `src` prop for photos |
| `src/pages/Dashboard.tsx` | Added hidden file input, `handleAvatarChange`, clickable avatar with overlay |
| `src/components/dashboard/team-card.tsx` | Pass `src={m.avatar_url}` to Avatar |
| `src/components/dashboard/my-team-view.tsx` | Pass `src={m.avatar_url}` to Avatar (2 places) |
| `src/components/dashboard/members-view.tsx` | Pass `src={m.avatar_url}` to Avatar |
| `public/_redirects` | **New file** — Ensures React Router works on Render |

---

## How It Works

1. **User clicks their avatar** in the dashboard header
2. Hidden `<input type="file">` opens
3. User selects an image
4. `uploadToCloudinary(file)` uploads to Cloudinary via unsigned upload
5. Cloudinary returns a secure URL (e.g., `https://res.cloudinary.com/...`)
6. `updateAvatarUrl(userId, url)` saves the URL to Supabase `profiles.avatar_url`
7. `setProfile()` updates local state → avatar refreshes instantly
8. All other avatars (team cards, members list, invites) now show the photo

---

## Troubleshooting

### "Cloudinary not configured" error

- Check that `VITE_CLOUDINARY_CLOUD_NAME` and `VITE_CLOUDINARY_UPLOAD_PRESET` are set in your Render environment variables
- Rebuild the site after adding env vars (Vite bundles them at build time)

### "Upload failed" error

- Verify your upload preset is set to **Unsigned** in Cloudinary settings
- Check the file size (must be < 5MB)
- Check the file type (must be an image)

### Avatar doesn't update after upload

- Check browser console for errors
- Verify the Supabase migration ran successfully (check if `avatar_url` column exists)
- Check Supabase RLS policies — the "profiles update own" policy should allow users to update their own `avatar_url`

### Images don't load (broken image icon)

- Check that the Cloudinary URL is correct in the database
- Check browser console for CORS errors
- Verify the Cloudinary image is public (unsigned uploads are public by default)

---

## Security Notes

- **Cloudinary upload preset is unsigned** — This is safe because:
  - Users can only upload to the `sih_avatars` folder
  - 5MB size limit enforced
  - Only image formats allowed
  - Cloudinary provides abuse protection
- **Supabase RLS** — Users can only update their own `avatar_url` via the existing "profiles update own" policy
- **No API keys in client code** — The `VITE_CLOUDINARY_UPLOAD_PRESET` is meant to be public (it's for unsigned uploads)

---

## What's Next?

- **Avatar compression**: Consider using Cloudinary's transformation URL parameters (e.g., `f_auto,q_auto,w_200`) for optimized delivery
- **Profile page**: Add a dedicated profile edit page with all fields + photo
- **Image cropping**: Use a library like `react-image-crop` for avatar cropping before upload

---

## Support

- Cloudinary docs: [cloudinary.com/documentation](https://cloudinary.com/documentation)
- Render docs: [render.com/docs](https://render.com/docs)
- Supabase docs: [supabase.com/docs](https://supabase.com/docs)
