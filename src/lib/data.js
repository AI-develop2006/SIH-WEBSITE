const API_BASE = import.meta.env.VITE_BACKEND_URL || "";

// ─── Session helpers ──────────────────────────────────────────────────────────
// SESSION_TIMEOUT_MS must match the server. Default 8 hours.
export const SESSION_TIMEOUT_MS = 8 * 60 * 60 * 1000;

function getAuthHeader() {
  const token     = localStorage.getItem("spoc_auth_token");
  const loginTime = localStorage.getItem("spoc_login_time");
  const headers   = {};
  if (token)     headers["Authorization"]  = `Bearer ${token}`;
  if (loginTime) headers["X-Login-Time"]   = loginTime;
  return headers;
}

/** Returns true only when the active session was authenticated with the master password. */
export function isMasterSession() {
  return localStorage.getItem("spoc_auth_token") === "master";
}

/** Returns ms remaining in the current session, or 0 if expired / not logged in. */
export function sessionMsRemaining() {
  const loginTime = parseInt(localStorage.getItem("spoc_login_time") ?? "0", 10);
  if (!loginTime) return 0;
  return Math.max(0, loginTime + SESSION_TIMEOUT_MS - Date.now());
}

/**
 * Log in as SPOC using name and password.
 * The internal email derivation happens server-side — never exposed here.
 */
export async function loginSpoc(name, password) {
  try {
    const res = await fetch(`${API_BASE}/api/auth/login-by-name`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim(), password }),
    });
    const json = await res.json();
    if (!res.ok) return { data: null, error: json.error || "Login failed" };
    if (json.session?.access_token) {
      localStorage.setItem("spoc_auth_token", json.session.access_token);
      localStorage.setItem("spoc_login_time", String(Date.now()));
    }
    return { data: json, error: null };
  } catch (err) {
    return { data: null, error: err.message };
  }
}

export async function logoutSpoc() {
  localStorage.removeItem("spoc_auth_token");
  localStorage.removeItem("spoc_login_time");
  return { data: true, error: null };
}

/** Master-only: invalidate all active SPOC sessions server-side. */
export async function logoutAllSessions() {
  try {
    const res = await fetch(`${API_BASE}/api/spoc/logout-all`, {
      method: "POST",
      headers: { ...getAuthHeader() },
    });
    const json = await res.json();
    if (!res.ok) return { ok: false, error: json.error };
    return { ok: true, error: null };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

export async function checkSpocMaintenance() {
  try {
    const res = await fetch(`${API_BASE}/api/settings/spoc-maintenance`);
    const json = await res.json();
    return { enabled: json.enabled ?? false, message: json.message ?? "", error: null };
  } catch (e) {
    // If the backend is unreachable, don't block the SPOC portal
    return { enabled: false, message: "", error: e.message };
  }
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

export async function fetchAllProfiles() {
  try {
    const res = await fetch(`${API_BASE}/api/profiles`, {
      headers: { ...getAuthHeader() },
    });
    const json = await res.json();
    if (!res.ok) return { data: [], error: json.error };
    return { data: json.data ?? [], error: null };
  } catch (err) {
    return { data: [], error: err.message };
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
    if (!res.ok) return { data: null, error: json.error, conflict: res.status === 409 };
    return { data: json.data, error: null, conflict: false };
  } catch (err) {
    return { data: null, error: err.message, conflict: false };
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
    if (!res.ok) return { data: null, error: json.error, conflict: res.status === 409 };
    return { data: json.data, error: null, conflict: false };
  } catch (err) {
    return { data: null, error: err.message, conflict: false };
  }
}

export async function deleteFinalTeam(id) {
  try {
    const res = await fetch(`${API_BASE}/api/spoc/final-teams/${id}`, {
      method: "DELETE",
      headers: { ...getAuthHeader() },
    });
    const json = await res.json();
    if (!res.ok) return { success: false, error: json.error };
    return { success: true, error: null };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// ─── Real-time: claimed members ───────────────────────────────────────────────
// Returns the flat list of member IDs already assigned to any final team.
// Pass excludeTeamId when editing a team so its own members aren't marked taken.
export async function fetchClaimedMembers(excludeTeamId = null) {
  try {
    const url = excludeTeamId
      ? `${API_BASE}/api/spoc/claimed-members?excludeTeamId=${encodeURIComponent(excludeTeamId)}`
      : `${API_BASE}/api/spoc/claimed-members`;
    const res = await fetch(url, { headers: { ...getAuthHeader() } });
    const json = await res.json();
    if (!res.ok) return { data: [], error: json.error };
    return { data: json.data ?? [], error: null };
  } catch (err) {
    return { data: [], error: err.message };
  }
}

// ─── SSE: subscribe to live final-team updates ────────────────────────────────
// Calls `onUpdate` whenever the server broadcasts a final_teams_updated event.
// Returns a cleanup function — call it on unmount.
export function subscribeToTeamEvents(onUpdate, onSessionInvalidated) {
  const url = `${API_BASE}/api/spoc/events`;
  let es;
  let retryTimer;
  let active = true;

  function connect() {
    if (!active) return;
    es = new EventSource(url);

    es.addEventListener("final_teams_updated", () => {
      onUpdate();
    });

    es.addEventListener("session_invalidated", () => {
      if (onSessionInvalidated) onSessionInvalidated();
    });

    es.onerror = () => {
      es.close();
      if (active) {
        // Reconnect after 3 s on error
        retryTimer = setTimeout(connect, 3000);
      }
    };
  }

  connect();

  return function cleanup() {
    active = false;
    clearTimeout(retryTimer);
    if (es) es.close();
  };
}


// ─── SSE: subscribe to pair-team changes from the mentor backend ──────────────
// The mentor portal emits `pair_teams_updated` events whenever a ministry is
// assigned, a skill is changed, a member is added/removed, or a team is renamed.
// SPOC needs to react to these so the pairTeams list stays current without a
// manual refresh.
//
// PM_API_BASE falls back to the same host as the SPOC backend if the env var
// is not set (safe for monorepo deployments where both backends are on one host).
const PM_API_BASE = import.meta.env.VITE_PM_BACKEND_URL || API_BASE;

export function subscribeToPairTeamEvents(onUpdate) {
  const url = `${PM_API_BASE}/api/events`;
  let es;
  let retryTimer;
  let active = true;

  function connect() {
    if (!active) return;
    es = new EventSource(url);

    es.addEventListener("pair_teams_updated", () => {
      onUpdate();
    });

    es.onerror = () => {
      es.close();
      if (active) {
        retryTimer = setTimeout(connect, 3000);
      }
    };
  }

  connect();

  return function cleanup() {
    active = false;
    clearTimeout(retryTimer);
    if (es) es.close();
  };
}

// ─── Access Log ───────────────────────────────────────────────────────────────
export async function fetchAccessLog(limit = 200) {
  try {
    const res = await fetch(`${API_BASE}/api/spoc/access-log?limit=${limit}`, {
      headers: { ...getAuthHeader() },
    });
    const json = await res.json();
    if (!res.ok) return { data: [], error: json.error };
    return { data: json.data ?? [], error: null };
  } catch (err) {
    return { data: [], error: err.message };
  }
}

// ─── Audit Log ────────────────────────────────────────────────────────────────
export async function fetchAuditLog(limit = 200) {
  try {
    const res = await fetch(`${API_BASE}/api/spoc/audit-log?limit=${limit}`, {
      headers: { ...getAuthHeader() },
    });
    const json = await res.json();
    if (!res.ok) return { data: [], error: json.error };
    return { data: json.data ?? [], error: null };
  } catch (err) {
    return { data: [], error: err.message };
  }
}

// ─── PS Change Requests (SPOC) ────────────────────────────────────────────────

export async function fetchPsChangeRequests() {
  try {
    const res = await fetch(`${API_BASE}/api/spoc/ps-change-requests`, {
      headers: { ...getAuthHeader() },
    });
    const json = await res.json();
    if (!res.ok) return { data: [], error: json.error };
    return { data: json.data ?? [], error: null };
  } catch (err) {
    return { data: [], error: err.message };
  }
}

export async function reviewPsChangeRequest(id, action, reviewNote = "") {
  try {
    const res = await fetch(`${API_BASE}/api/spoc/ps-change-requests/${id}/review`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...getAuthHeader() },
      body: JSON.stringify({ action, review_note: reviewNote }),
    });
    const json = await res.json();
    if (!res.ok) return { ok: false, error: json.error };
    return { ok: true, error: null };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}
