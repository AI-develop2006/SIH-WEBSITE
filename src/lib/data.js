const API_BASE = import.meta.env.VITE_BACKEND_URL || "";

function getAuthHeader() {
  const token = localStorage.getItem("spoc_auth_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/**
 * Converts a phone number to the internal Supabase auth email used for SPOC accounts.
 * Never exposed to the user — only used internally for auth calls.
 */
function phoneToEmail(phone) {
  const digits = phone.replace(/\D/g, "");
  return `${digits}@spoc.smvec.ac.in`;
}

// ─── Auth ────────────────────────────────────────────────────────────────────

export async function loginSpoc(phone, password) {
  try {
    const email = phoneToEmail(phone);
    const res = await fetch(`${API_BASE}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const json = await res.json();
    if (!res.ok) return { data: null, error: json.error || "Login failed" };
    if (json.session?.access_token) {
      localStorage.setItem("spoc_auth_token", json.session.access_token);
    }
    return { data: json, error: null };
  } catch (err) {
    return { data: null, error: err.message };
  }
}

export async function logoutSpoc() {
  localStorage.removeItem("spoc_auth_token");
  return { data: true, error: null };
}

export async function getCurrentProfile() {
  const token = localStorage.getItem("spoc_auth_token");
  if (!token) return { data: null, error: "Not signed in" };
  try {
    const res = await fetch(`${API_BASE}/api/auth/me`, {
      headers: { ...getAuthHeader() },
    });
    const json = await res.json();
    if (!res.ok) return { data: null, error: json.error || "Not signed in" };
    return { data: json.profile, error: null };
  } catch (err) {
    return { data: null, error: err.message };
  }
}

// ─── Data ────────────────────────────────────────────────────────────────────

export async function fetchEnrichedTeams() {
  try {
    const res = await fetch(`${API_BASE}/api/teams`, {
      headers: { ...getAuthHeader() },
    });
    const json = await res.json();
    if (!res.ok) return { data: null, error: json.error };
    return { data: json.data ?? [], error: null };
  } catch (err) {
    return { data: null, error: err.message };
  }
}

// ─── SPOC Final Teams (stored in spoc_final_teams table) ─────────────────────

export async function fetchFinalTeams() {
  try {
    const res = await fetch(`${API_BASE}/api/spoc/final-teams`, {
      headers: { ...getAuthHeader() },
    });
    const json = await res.json();
    if (!res.ok) return { data: null, error: json.error };
    return { data: json.data ?? [], error: null };
  } catch (err) {
    return { data: null, error: err.message };
  }
}

export async function saveFinalTeam(payload) {
  // payload: { name, ministry, member_ids: string[] }
  try {
    const res = await fetch(`${API_BASE}/api/spoc/final-teams`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...getAuthHeader() },
      body: JSON.stringify(payload),
    });
    const json = await res.json();
    if (!res.ok) return { data: null, error: json.error };
    return { data: json.data, error: null };
  } catch (err) {
    return { data: null, error: err.message };
  }
}

export async function updateFinalTeam(id, payload) {
  try {
    const res = await fetch(`${API_BASE}/api/spoc/final-teams/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...getAuthHeader() },
      body: JSON.stringify(payload),
    });
    const json = await res.json();
    if (!res.ok) return { data: null, error: json.error };
    return { data: json.data, error: null };
  } catch (err) {
    return { data: null, error: err.message };
  }
}

export async function deleteFinalTeam(id) {
  try {
    const res = await fetch(`${API_BASE}/api/spoc/final-teams/${id}`, {
      method: "DELETE",
      headers: { ...getAuthHeader() },
    });
    const json = await res.json();
    if (!res.ok) return { data: null, error: json.error };
    return { data: true, error: null };
  } catch (err) {
    return { data: null, error: err.message };
  }
}
