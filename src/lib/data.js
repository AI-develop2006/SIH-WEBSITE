const API_BASE = import.meta.env.VITE_BACKEND_URL || "";

function getAuthHeader() {
  const token = localStorage.getItem("spoc_auth_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
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
    if (!res.ok) return { data: null, error: json.error };
    return { data: json.data, error: null };
  } catch (err) {
    return { data: null, error: err.message };
  }
}

// ─── Real-time: claimed members ───────────────────────────────────────────────
// Returns the flat list of member IDs already assigned to any final team.
export async function fetchClaimedMembers() {
  try {
    const res = await fetch(`${API_BASE}/api/spoc/claimed-members`, {
      headers: { ...getAuthHeader() },
    });
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
export function subscribeToTeamEvents(onUpdate) {
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
