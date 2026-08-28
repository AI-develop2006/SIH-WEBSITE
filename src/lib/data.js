"use client";

const API_BASE = import.meta.env.VITE_BACKEND_URL || "";

function getAuthHeader() {
  const token = localStorage.getItem("pm_auth_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

// Refresh the access token using the stored refresh token.
// Called automatically before any authenticated request when the token is near expiry.
async function refreshAccessToken() {
  const refreshToken = localStorage.getItem("pm_refresh_token");
  if (!refreshToken) return false;
  try {
    const res = await fetch(`${API_BASE}/api/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });
    if (!res.ok) {
      // Refresh failed — clear tokens so user is prompted to log in
      localStorage.removeItem("pm_auth_token");
      localStorage.removeItem("pm_refresh_token");
      localStorage.removeItem("pm_token_expires_at");
      return false;
    }
    const json = await res.json();
    if (json.session?.access_token) {
      localStorage.setItem("pm_auth_token", json.session.access_token);
      localStorage.setItem("pm_refresh_token", json.session.refresh_token);
      // Store expiry with a 5-minute buffer so we refresh before it actually expires
      const expiresAt = Date.now() + (json.session.expires_in ?? 3600) * 1000 - 5 * 60 * 1000;
      localStorage.setItem("pm_token_expires_at", String(expiresAt));
      return true;
    }
    return false;
  } catch (_) {
    return false;
  }
}

// Returns true if the stored access token is expired or will expire within 5 minutes
function isTokenExpiredOrNearExpiry() {
  const expiresAt = localStorage.getItem("pm_token_expires_at");
  if (!expiresAt) return false; // no expiry info stored — assume valid (legacy token)
  return Date.now() >= Number(expiresAt);
}

// Call this before any authenticated fetch — silently refreshes if needed
async function ensureFreshToken() {
  if (isTokenExpiredOrNearExpiry()) {
    await refreshAccessToken();
  }
}

export async function loginUser(email, password) {
  try {
    const res = await fetch(`${API_BASE}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const json = await res.json();
    if (!res.ok) return { data: null, error: json.error || "Login failed" };

    if (json.session?.access_token) {
      localStorage.setItem("pm_auth_token", json.session.access_token);
      if (json.session.refresh_token) {
        localStorage.setItem("pm_refresh_token", json.session.refresh_token);
      }
      const expiresAt = Date.now() + (json.session.expires_in ?? 3600) * 1000 - 5 * 60 * 1000;
      localStorage.setItem("pm_token_expires_at", String(expiresAt));
    }
    return { data: json, error: null };
  } catch (err) {
    return { data: null, error: err.message };
  }
}

export async function signupUser(email, password, meta = {}) {
  try {
    const res = await fetch(`${API_BASE}/api/auth/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, meta }),
    });

    // Handle non-JSON responses (e.g. 413 Payload Too Large from Express)
    const contentType = res.headers.get("content-type") || "";
    if (!contentType.includes("application/json")) {
      return { data: null, error: `Server error (${res.status}): Request too large or server misconfiguration.` };
    }

    const json = await res.json();
    if (!res.ok) return { data: null, error: json.error || "Sign up failed" };

    if (json.session?.access_token) {
      localStorage.setItem("pm_auth_token", json.session.access_token);
      if (json.session.refresh_token) {
        localStorage.setItem("pm_refresh_token", json.session.refresh_token);
      }
      const expiresAt = Date.now() + (json.session.expires_in ?? 3600) * 1000 - 5 * 60 * 1000;
      localStorage.setItem("pm_token_expires_at", String(expiresAt));
    }
    return { data: json, error: null };
  } catch (err) {
    return { data: null, error: err.message };
  }
}

export async function logoutUser() {
  localStorage.removeItem("pm_auth_token");
  localStorage.removeItem("pm_refresh_token");
  localStorage.removeItem("pm_token_expires_at");
  return { data: true, error: null };
}

export async function resetStudentPassword(registerNo, email, newPassword) {
  try {
    const res = await fetch(`${API_BASE}/api/auth/reset-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ registerNo, email, newPassword }),
    });
    const json = await res.json();
    if (!res.ok) return { data: null, error: json.error || "Password reset failed" };
    return { data: json.data ?? true, error: null };
  } catch (err) {
    return { data: null, error: err.message };
  }
}

export async function getCurrentProfile() {
  const token = localStorage.getItem("pm_auth_token");
  if (!token) return { data: null, error: "Not signed in" };

  await ensureFreshToken();

  try {
    const res = await fetch(`${API_BASE}/api/auth/me`, {
      headers: { ...getAuthHeader() },
    });
    const json = await res.json();
    if (!res.ok) return { data: null, error: json.error || "Not signed in" };
    // profileMissing means auth user exists but profile row wasn't created yet
    if (json.profileMissing) return { data: null, error: "profile_missing" };
    return { data: json.profile, error: null };
  } catch (err) {
    return { data: null, error: err.message };
  }
}

export async function ensureProfile(uid, meta = {}) {
  try {
    const res = await fetch(`${API_BASE}/api/profiles/ensure`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...getAuthHeader() },
      body: JSON.stringify({ uid, meta }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Failed to ensure profile");
  } catch (err) {
    throw new Error(err.message);
  }
}

export async function updateProfile(uid, profileData) {
  try {
    const res = await fetch(`${API_BASE}/api/profiles/me`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...getAuthHeader() },
      body: JSON.stringify({ uid, profileData }),
    });
    const json = await res.json();
    if (!res.ok) return { error: json.error };
    return { error: null };
  } catch (err) {
    return { error: err.message };
  }
}

export async function updateRegisterNo(newRegisterNo) {
  await ensureFreshToken();
  try {
    const res = await fetch(`${API_BASE}/api/auth/update-register-no`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...getAuthHeader() },
      body: JSON.stringify({ newRegisterNo }),
    });
    const json = await res.json();
    if (!res.ok) return { error: json.error };
    return { data: json, error: null };
  } catch (err) {
    return { error: err.message };
  }
}

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

export async function fetchMyTeam(uid) {
  const { data: all, error } = await fetchEnrichedTeams();
  if (error) return { data: null, error };
  const mine = all?.find((t) => t.members.some((m) => m.id === uid)) ?? null;
  return { data: mine, error: null };
}

export async function fetchAllProfiles() {
  try {
    const res = await fetch(`${API_BASE}/api/profiles/search`, {
      headers: { ...getAuthHeader() },
    });
    const json = await res.json();
    if (!res.ok) return { data: null, error: json.error };
    return { data: json.data ?? [], error: null };
  } catch (err) {
    return { data: null, error: err.message };
  }
}

export async function searchProfiles(opts = {}) {
  try {
    const params = new URLSearchParams();
    if (opts.excludeId) params.append("excludeId", opts.excludeId);
    if (opts.stack) params.append("stack", opts.stack);
    if (opts.q) params.append("q", opts.q);

    const res = await fetch(`${API_BASE}/api/profiles/search?${params.toString()}`, {
      headers: { ...getAuthHeader() },
    });
    const json = await res.json();
    if (!res.ok) return { data: null, error: json.error };
    return { data: json.data ?? [], error: null };
  } catch (err) {
    return { data: null, error: err.message };
  }
}

export async function fetchProblems() {
  try {
    const res = await fetch(`${API_BASE}/api/problems`, {
      headers: { ...getAuthHeader() },
    });
    const json = await res.json();
    if (!res.ok) return { data: null, error: json.error };
    return { data: json.data ?? [], error: null };
  } catch (err) {
    return { data: null, error: err.message };
  }
}

export async function fetchThemes() {
  try {
    const res = await fetch(`${API_BASE}/api/themes`, {
      headers: { ...getAuthHeader() },
    });
    const json = await res.json();
    if (!res.ok) return { data: null, error: json.error };
    return { data: json.data ?? [], error: null };
  } catch (err) {
    return { data: null, error: err.message };
  }
}

export async function fetchInvites(uid) {
  try {
    const res = await fetch(`${API_BASE}/api/teams/invites?uid=${uid}`, {
      headers: { ...getAuthHeader() },
    });
    const json = await res.json();
    if (!res.ok) return { data: null, error: json.error };
    return { data: json, error: null };
  } catch (err) {
    return { data: null, error: err.message };
  }
}

async function rpc(name, params) {
  try {
    const res = await fetch(`${API_BASE}/api/rpc`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...getAuthHeader() },
      body: JSON.stringify({ name, params }),
    });
    const json = await res.json();
    if (!res.ok) return { data: null, error: json.error };
    return { data: json.data ?? true, error: null };
  } catch (err) {
    return { data: null, error: err.message };
  }
}

export const api = {
  createTeam: (name, problemId) => rpc("create_team", { p_name: name, p_problem_id: problemId ?? null }),
  requestToJoin: (teamId) => rpc("request_to_join", { p_team_id: teamId }),
  sendInvite: (teamId, inviteeId) => rpc("send_invite", { p_team_id: teamId, p_invitee_id: inviteeId }),
  acceptInvite: (inviteId) => rpc("accept_invite", { p_invite_id: inviteId }),
  leaveTeam: (teamId) => rpc("leave_team", { p_team_id: teamId }),
  promoteAdmin: (phone) => rpc("promote_admin", { p_phone: phone }),
  verifyStudent: (userId, verified) => rpc("verify_student", { p_user_id: userId, p_verified: verified }),
  deleteTeam: async (teamId) => {
    try {
      const res = await fetch(`${API_BASE}/api/teams/${teamId}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json", ...getAuthHeader() },
      });
      const json = await res.json();
      if (!res.ok) return { data: null, error: json.error };
      return { data: true, error: null };
    } catch (err) {
      return { data: null, error: err.message };
    }
  },
  removeMember: async (teamId, memberId) => {
    try {
      const res = await fetch(`${API_BASE}/api/teams/${teamId}/members/${memberId}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json", ...getAuthHeader() },
      });
      const json = await res.json();
      if (!res.ok) return { data: null, error: json.error };
      return { data: true, error: null };
    } catch (err) {
      return { data: null, error: err.message };
    }
  },
  addMemberDirectMentor: async (teamId, memberId) => {
    try {
      const res = await fetch(`${API_BASE}/api/teams/${teamId}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeader() },
        body: JSON.stringify({ memberId }),
      });
      const json = await res.json();
      if (!res.ok) return { data: null, error: json.error };
      return { data: true, error: null };
    } catch (err) {
      return { data: null, error: err.message };
    }
  },
  updateStudentCategory: async (studentId, category) => {
    try {
      const res = await fetch(`${API_BASE}/api/profiles/${studentId}/category`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...getAuthHeader() },
        body: JSON.stringify({ category }),
      });
      const json = await res.json();
      if (!res.ok) return { data: null, error: json.error };
      return { data: json, error: null };
    } catch (err) {
      return { data: null, error: err.message };
    }
  },
  removeMemberDirectMentor: async (teamId, memberId) => {
    try {
      const res = await fetch(`${API_BASE}/api/teams/${teamId}/members/${memberId}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json", ...getAuthHeader() },
      });
      const json = await res.json();
      if (!res.ok) return { data: null, error: json.error };
      return { data: true, error: null };
    } catch (err) {
      return { data: null, error: err.message };
    }
  },
  assignMemberSkill: async (teamId, memberId, skill) => {
    try {
      const res = await fetch(`${API_BASE}/api/teams/${teamId}/members/${memberId}/skill`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...getAuthHeader() },
        body: JSON.stringify({ skill }),
      });
      const json = await res.json();
      if (!res.ok) return { data: null, error: json.error };
      return { data: json, error: null };
    } catch (err) {
      return { data: null, error: err.message };
    }
  },
  assignTeamMinistry: async (teamId, ministry) => {
    try {
      const res = await fetch(`${API_BASE}/api/teams/${teamId}/ministry`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...getAuthHeader() },
        body: JSON.stringify({ ministry }),
      });
      const json = await res.json();
      if (!res.ok) return { data: null, error: json.error };
      return { data: json, error: null };
    } catch (err) {
      return { data: null, error: err.message };
    }
  },
  renameTeam: async (teamId, name) => {
    try {
      const res = await fetch(`${API_BASE}/api/teams/${teamId}/name`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...getAuthHeader() },
        body: JSON.stringify({ name }),
      });
      const json = await res.json();
      if (!res.ok) return { data: null, error: json.error };
      return { data: json, error: null };
    } catch (err) {
      return { data: null, error: err.message };
    }
  },
  createEmptyTeamMentor: async (name, category = "Pairs", created_by_dept = null) => {
    try {
      const res = await fetch(`${API_BASE}/api/teams/empty`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeader() },
        body: JSON.stringify({ name, category, created_by_dept }),
      });
      const json = await res.json();
      if (!res.ok) return { data: null, error: json.error };
      return { data: json.data, error: null };
    } catch (err) {
      return { data: null, error: err.message };
    }
  },
  createTeamDirectMentor: (name, problemId, leaderId) => rpc("create_team_direct_mentor", { p_team_name: name, p_problem_id: problemId, p_leader_id: leaderId }),
  toggleTeamApproval: (teamId, approved) => rpc("toggle_team_approval", { p_team_id: teamId, p_approved: approved }),
  upsertProblem: (input = {}) =>
    rpc("upsert_problem_admin", {
      p_id: input.id ?? null,
      p_title: input.title,
      p_category: input.category ?? null,
      p_description: input.description ?? null,
      p_theme_id: input.themeId ?? null,
    }),
  deleteProblem: (problemId) => rpc("delete_problem_admin", { p_problem_id: problemId }),
};

export function isConfigured() {
  return true;
}

export async function updateAvatarUrl(userId, url) {
  try {
    const res = await fetch(`${API_BASE}/api/profiles/avatar`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...getAuthHeader() },
      body: JSON.stringify({ uid: userId, url }),
    });
    const json = await res.json();
    if (!res.ok) return { data: null, error: json.error };
    return { data: null, error: null };
  } catch (err) {
    return { data: null, error: err.message };
  }
}

export async function fetchTimelineEvents() {
  try {
    const res = await fetch(`${API_BASE}/api/timeline`, {
      headers: { ...getAuthHeader() },
    });
    const json = await res.json();
    if (!res.ok) return { data: null, error: json.error };
    return { data: json.data ?? [], error: null };
  } catch (err) {
    return { data: null, error: err.message };
  }
}

export async function fetchAnnouncements() {
  try {
    const res = await fetch(`${API_BASE}/api/announcements`, {
      headers: { ...getAuthHeader() },
    });
    const json = await res.json();
    if (!res.ok) return { data: null, error: json.error };
    return { data: json.data ?? [], error: null };
  } catch (err) {
    return { data: null, error: err.message };
  }
}

export async function getEmailByRegisterNo(registerNo) {
  try {
    const res = await fetch(`${API_BASE}/api/lookup/email-by-regno?registerNo=${encodeURIComponent(registerNo)}`, {
      headers: { ...getAuthHeader() },
    });
    const json = await res.json();
    if (!res.ok) return { email: null, error: json.error };
    return { email: json.email ?? null, error: null };
  } catch (err) {
    return { email: null, error: err.message };
  }
}

export async function getEmailByMentorPhone(phone) {
  try {
    const res = await fetch(`${API_BASE}/api/lookup/email-by-phone?phone=${encodeURIComponent(phone)}`, {
      headers: { ...getAuthHeader() },
    });
    const json = await res.json();
    if (!res.ok) return { email: null, error: json.error };
    return { email: json.email ?? null, error: null };
  } catch (err) {
    return { email: null, error: err.message };
  }
}

export async function checkRegisterNoExists(registerNo) {
  try {
    const res = await fetch(`${API_BASE}/api/lookup/check-regno?registerNo=${encodeURIComponent(registerNo)}`, {
      headers: { ...getAuthHeader() },
    });
    const json = await res.json();
    if (!res.ok) return { exists: false, error: json.error };
    return { exists: !!json.exists, error: null };
  } catch (err) {
    return { exists: false, error: err.message };
  }
}

export async function checkEmailExists(email) {
  try {
    const res = await fetch(`${API_BASE}/api/lookup/check-email?email=${encodeURIComponent(email)}`, {
      headers: { ...getAuthHeader() },
    });
    const json = await res.json();
    if (!res.ok) return { exists: false, error: json.error };
    return { exists: !!json.exists, error: null };
  } catch (err) {
    return { exists: false, error: err.message };
  }
}

export async function checkPhoneExists(phone) {
  try {
    const res = await fetch(`${API_BASE}/api/lookup/check-phone?phone=${encodeURIComponent(phone)}`, {
      headers: { ...getAuthHeader() },
    });
    const json = await res.json();
    if (!res.ok) return { exists: false, error: json.error };
    return { exists: !!json.exists, error: null };
  } catch (err) {
    return { exists: false, error: err.message };
  }
}

export async function fetchRegistrationStatus() {
  try {
    const res = await fetch(`${API_BASE}/api/settings/registration`);
    const json = await res.json();
    if (!res.ok) return { data: null, error: json.error };
    return { data: json.data, error: null };
  } catch (err) {
    return { data: null, error: err.message };
  }
}

// ─── Ministry Seat Caps ───────────────────────────────────────────────────────
// Fetches admin-configured per-(ministry, dept) seat caps.
// Returns { data: { "Ministry|||Dept": N, ... }, error }
// Falls back to {} on any error so callers can use DEFAULT_CAP safely.
export async function fetchMinistrySeats() {
  try {
    const res = await fetch(`${API_BASE}/api/settings/ministry-seats`);
    const json = await res.json();
    if (!res.ok) return { data: {}, error: json.error };
    return { data: json.data ?? {}, error: null };
  } catch (err) {
    return { data: {}, error: err.message };
  }
}

// Fetches seat caps + current usage for a specific department.
// Returns { data: [{ ministry, cap, usage }], seats: {...}, error }
// Used by the mentor dashboard to show capacity alerts for their department.
export async function fetchMinistrySeatsForDept(dept) {
  try {
    const res = await fetch(
      `${API_BASE}/api/settings/ministry-seats-for-dept?dept=${encodeURIComponent(dept)}`
    );
    const json = await res.json();
    if (!res.ok) return { data: [], seats: {}, error: json.error };
    return { data: json.data ?? [], seats: json.seats ?? {}, error: null };
  } catch (err) {
    return { data: [], seats: {}, error: err.message };
  }
}

// ─── SPOC Final Team ─────────────────────────────────────────────────────────
// Returns the SPOC final team the logged-in participant belongs to,
// with all member profiles resolved. Returns { data: null } if not in a team.
export async function fetchMyFinalTeam() {
  await ensureFreshToken();
  try {
    const res = await fetch(`${API_BASE}/api/spoc/my-final-team`, {
      headers: { ...getAuthHeader() },
    });
    const json = await res.json();
    if (!res.ok) return { data: null, error: json.error };
    return { data: json.data ?? null, error: null };
  } catch (err) {
    return { data: null, error: err.message };
  }
}

// Any team member can call this to set (or clear) the problem statement
// their final team is working on. ps_number = null clears the selection.
export async function selectFinalTeamPs(psNumber) {
  await ensureFreshToken();
  try {
    const res = await fetch(`${API_BASE}/api/spoc/select-ps`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...getAuthHeader() },
      body: JSON.stringify({ ps_number: psNumber ?? null }),
    });
    const json = await res.json();
    if (!res.ok) return { data: null, error: json.error };
    return { data: json.data, error: null };
  } catch (err) {
    return { data: null, error: err.message };
  }
}

// AICTE (Open Innovation) teams use this instead of selectFinalTeamPs.
// Submits a custom problem statement title written by the team.
// Once confirmed it cannot be changed.
export async function submitCustomPs(customTitle) {
  await ensureFreshToken();
  try {
    const res = await fetch(`${API_BASE}/api/spoc/submit-custom-ps`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...getAuthHeader() },
      body: JSON.stringify({ custom_title: customTitle }),
    });
    const json = await res.json();
    if (!res.ok) return { data: null, error: json.error };
    return { data: json.data, error: null };
  } catch (err) {
    return { data: null, error: err.message };
  }
}

// ─── Personal Notifications ───────────────────────────────────────────────────

export async function fetchNotifications() {
  try {
    const res = await fetch(`${API_BASE}/api/notifications`, {
      headers: { ...getAuthHeader() },
    });
    const json = await res.json();
    if (!res.ok) return { data: [], error: json.error };
    return { data: json.data ?? [], error: null };
  } catch (err) {
    return { data: [], error: err.message };
  }
}

export async function markNotificationRead(id) {
  try {
    const res = await fetch(`${API_BASE}/api/notifications/${id}/read`, {
      method: "PATCH",
      headers: { ...getAuthHeader() },
    });
    const json = await res.json();
    return { success: json.success ?? false, error: null };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

export async function markAllNotificationsRead() {
  try {
    const res = await fetch(`${API_BASE}/api/notifications/read-all`, {
      method: "PATCH",
      headers: { ...getAuthHeader() },
    });
    const json = await res.json();
    return { success: json.success ?? false, error: null };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// ─── SSE: subscribe to pair-team change events ────────────────────────────────
// Connects to the mentor backend's /api/events SSE stream.
// Calls `onUpdate` whenever the server broadcasts a `pair_teams_updated` event
// (ministry assigned/changed, skill updated, member added/removed, team renamed).
// Returns a cleanup function — call it on unmount.
//
// Used by:
//   • Participant Dashboard  — to refresh myTeam when mentor edits the team
//   • Any component that needs live pair-team sync
export function subscribeToPairTeamEvents(onUpdate) {
  const url = `${API_BASE}/api/events`;
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
        // Back off 3 s before reconnecting to avoid hammering the server
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

// ─── SSE: subscribe to final-team changes from the SPOC backend ───────────────
// Connects to the SPOC backend's /api/spoc/events stream.
// Calls `onUpdate` whenever the SPOC creates, edits, or deletes a final team.
// Used by the participant Dashboard to instantly show/hide the final team card
// when the SPOC adds or removes the participant from a team.
//
// SPOC_API_BASE: configure via VITE_SPOC_BACKEND_URL in .env.
// Falls back to the same host as the participant backend if not set.
const SPOC_API_BASE = import.meta.env.VITE_SPOC_BACKEND_URL || API_BASE;

export function subscribeToFinalTeamEvents(onUpdate) {
  const url = `${SPOC_API_BASE}/api/spoc/events`;
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
