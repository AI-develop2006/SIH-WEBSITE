/**
 * Frontend is decoupled from direct Supabase SDK connections.
 * All database and authentication operations are processed via the Express backend REST API.
 */

export function isSupabaseConfigured() {
  return true;
}

export const supabase = null;

export function assertSupabase() {
  return null;
}
