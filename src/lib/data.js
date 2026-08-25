"use client";

const API_BASE = import.meta.env.VITE_BACKEND_URL || "";

function getAuthHeader() {
  const token = localStorage.getItem("admin_auth_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function loginAdmin(email, password) {
  try {
    const res = await fetch(`${API_BASE}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const json = await res.json();
    if (!res.ok) return { data: null, error: json.error || "Login failed" };

    if (json.session?.access_token) {
      localStorage.setItem("admin_auth_token", json.session.access_token);
    }
    return { data: json, error: null };
  } catch (err) {
    return { data: null, error: err.message };
  }
}

export async function logoutAdmin() {
  localStorage.removeItem("admin_auth_token");
  return { data: true, error: null };
}

export async function getCurrentProfile() {
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

export async function fetchAllProfiles() {
  try {
    const res = await fetch(`${API_BASE}/api/profiles`, {
      headers: { ...getAuthHeader() },
    });
    const json = await res.json();
    if (!res.ok) return { data: null, error: json.error };
    return { data: json.data ?? [], error: null };
  } catch (err) {
    return { data: null, error: err.message };
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

export async function upsertTimelineEvent(event) {
  try {
    const res = await fetch(`${API_BASE}/api/timeline`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...getAuthHeader() },
      body: JSON.stringify(event),
    });
    const json = await res.json();
    if (!res.ok) return { data: null, error: json.error };
    return { data: json.data, error: null };
  } catch (err) {
    return { data: null, error: err.message };
  }
}

export async function deleteTimelineEvent(eventId) {
  try {
    const res = await fetch(`${API_BASE}/api/timeline/${eventId}`, {
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

export async function upsertAnnouncement(announcement) {
  try {
    const res = await fetch(`${API_BASE}/api/announcements`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...getAuthHeader() },
      body: JSON.stringify(announcement),
    });
    const json = await res.json();
    if (!res.ok) return { data: null, error: json.error };
    return { data: json.data, error: null };
  } catch (err) {
    return { data: null, error: err.message };
  }
}

export async function fetchRegistrationSettings() {
  try {
    const res = await fetch(`${API_BASE}/api/settings/registration`);
    const json = await res.json();
    if (!res.ok) return { data: null, error: json.error };
    return { data: json.data, error: null };
  } catch (err) {
    return { data: null, error: err.message };
  }
}

export async function updateRegistrationSettings(settings) {
  try {
    const res = await fetch(`${API_BASE}/api/settings/registration`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...getAuthHeader() },
      body: JSON.stringify(settings),
    });
    const json = await res.json();
    if (!res.ok) return { data: null, error: json.error };
    return { data: json.data, error: null };
  } catch (err) {
    return { data: null, error: err.message };
  }
}

export const api = {
  toggleTeamApproval: async (teamId, approved) => {
    try {
      const res = await fetch(`${API_BASE}/api/teams/${teamId}/toggle-approval`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeader() },
        body: JSON.stringify({ approved }),
      });
      const json = await res.json();
      if (!res.ok) return { data: null, error: json.error };
      return { data: true, error: null };
    } catch (err) {
      return { data: null, error: err.message };
    }
  },

  // Create a new team
  createTeam: async ({ name, category, ministry, problem_id }) => {
    try {
      const res = await fetch(`${API_BASE}/api/teams`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeader() },
        body: JSON.stringify({ name, category, ministry, problem_id }),
      });
      const json = await res.json();
      if (!res.ok) return { data: null, error: json.error };
      return { data: json.data, error: null };
    } catch (err) {
      return { data: null, error: err.message };
    }
  },

  // Update team fields (name, ministry, problem_id, category, approved)
  updateTeam: async (teamId, patch) => {
    try {
      const res = await fetch(`${API_BASE}/api/teams/${teamId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...getAuthHeader() },
        body: JSON.stringify(patch),
      });
      const json = await res.json();
      if (!res.ok) return { data: null, error: json.error };
      return { data: true, error: null };
    } catch (err) {
      return { data: null, error: err.message };
    }
  },

  // Delete team — force=true removes even with members
  deleteTeam: async (teamId, force = false) => {
    try {
      const res = await fetch(`${API_BASE}/api/teams/${teamId}?force=${force}`, {
        method: "DELETE",
        headers: { ...getAuthHeader() },
      });
      const json = await res.json();
      if (!res.ok) return { data: null, error: json.error };
      return { data: true, error: null };
    } catch (err) {
      return { data: null, error: err.message };
    }
  },

  // Add member to team
  addMember: async (teamId, memberId) => {
    try {
      const res = await fetch(`${API_BASE}/api/teams/${teamId}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeader() },
        body: JSON.stringify({ member_id: memberId }),
      });
      const json = await res.json();
      if (!res.ok) return { data: null, error: json.error };
      return { data: true, error: null };
    } catch (err) {
      return { data: null, error: err.message };
    }
  },

  // Remove member from team
  removeMember: async (teamId, memberId) => {
    try {
      const res = await fetch(`${API_BASE}/api/teams/${teamId}/members/${memberId}`, {
        method: "DELETE",
        headers: { ...getAuthHeader() },
      });
      const json = await res.json();
      if (!res.ok) return { data: null, error: json.error };
      return { data: true, error: null };
    } catch (err) {
      return { data: null, error: err.message };
    }
  },

  // Assign ministry to team (admin — bypasses cap)
  assignMinistry: async (teamId, ministry) => {
    try {
      const res = await fetch(`${API_BASE}/api/teams/${teamId}/ministry`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...getAuthHeader() },
        body: JSON.stringify({ ministry }),
      });
      const json = await res.json();
      if (!res.ok) return { data: null, error: json.error };
      return { data: true, error: null };
    } catch (err) {
      return { data: null, error: err.message };
    }
  },

  // Assign skill to team member
  assignSkill: async (teamId, memberId, skill) => {
    try {
      const res = await fetch(`${API_BASE}/api/teams/${teamId}/members/${memberId}/skill`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...getAuthHeader() },
        body: JSON.stringify({ skill }),
      });
      const json = await res.json();
      if (!res.ok) return { data: null, error: json.error };
      return { data: true, error: null };
    } catch (err) {
      return { data: null, error: err.message };
    }
  },

  // Update profile (admin)
  updateProfile: async (profileId, patch) => {
    try {
      const res = await fetch(`${API_BASE}/api/profiles/${profileId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...getAuthHeader() },
        body: JSON.stringify(patch),
      });
      const json = await res.json();
      if (!res.ok) return { data: null, error: json.error };
      return { data: true, error: null };
    } catch (err) {
      return { data: null, error: err.message };
    }
  },

  // Toggle verified on a profile
  toggleVerified: async (profileId, verified) => {
    try {
      const res = await fetch(`${API_BASE}/api/profiles/${profileId}/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeader() },
        body: JSON.stringify({ verified }),
      });
      const json = await res.json();
      if (!res.ok) return { data: null, error: json.error };
      return { data: true, error: null };
    } catch (err) {
      return { data: null, error: err.message };
    }
  },

  // Delete profile (also removes from all teams)
  deleteProfile: async (profileId) => {
    try {
      const res = await fetch(`${API_BASE}/api/profiles/${profileId}`, {
        method: "DELETE",
        headers: { ...getAuthHeader() },
      });
      const json = await res.json();
      if (!res.ok) return { data: null, error: json.error };
      return { data: true, error: null };
    } catch (err) {
      return { data: null, error: err.message };
    }
  },

  upsertProblem: async (input = {}) => {
    try {
      const res = await fetch(`${API_BASE}/api/problems`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeader() },
        body: JSON.stringify(input),
      });
      const json = await res.json();
      if (!res.ok) return { data: null, error: json.error };
      return { data: true, error: null };
    } catch (err) {
      return { data: null, error: err.message };
    }
  },

  deleteProblem: async (problemId) => {
    try {
      const res = await fetch(`${API_BASE}/api/problems/${problemId}`, {
        method: "DELETE",
        headers: { ...getAuthHeader() },
      });
      const json = await res.json();
      if (!res.ok) return { data: null, error: json.error };
      return { data: true, error: null };
    } catch (err) {
      return { data: null, error: err.message };
    }
  },

  backfillTeamCodes: async () => {
    try {
      const res = await fetch(`${API_BASE}/api/admin/backfill-team-codes`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeader() },
      });
      const json = await res.json();
      if (!res.ok) return { data: null, error: json.error };
      return { data: json, error: null };
    } catch (err) {
      return { data: null, error: err.message };
    }
  },
};

export function isConfigured() {
  return true;
}

export async function fetchMinistrySeats() {
  try {
    const res = await fetch(`${API_BASE}/api/settings/ministry-seats`, {
      headers: { ...getAuthHeader() },
    });
    const j = await res.json();
    if (!res.ok) return { data: {}, error: j.error };
    return { data: j.data ?? {}, error: null };
  } catch (e) {
    return { data: {}, error: e.message };
  }
}

export async function saveMinistrySeats(seats) {
  try {
    const res = await fetch(`${API_BASE}/api/settings/ministry-seats`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...getAuthHeader() },
      body: JSON.stringify({ seats }),
    });
    const j = await res.json();
    if (!res.ok) return { success: false, error: j.error };
    return { success: true, error: null };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

export async function fetchFinalTeams() {
  try {
    const res = await fetch(`${API_BASE}/api/spoc/final-teams`, {
      headers: { ...getAuthHeader() },
    });
    const j = await res.json();
    if (!res.ok) return { data: [], error: j.error };
    return { data: j.data ?? [], error: null };
  } catch (e) {
    return { data: [], error: e.message };
  }
}

export async function fetchSpocMaintenance() {
  try {
    const res = await fetch(`${API_BASE}/api/settings/spoc-maintenance`, {
      headers: { ...getAuthHeader() },
    });
    const j = await res.json();
    if (!res.ok) return { enabled: false, error: j.error };
    return { enabled: j.enabled, message: j.message, error: null };
  } catch (e) {
    return { enabled: false, error: e.message };
  }
}

export async function setSpocMaintenance(enabled, message = "") {
  try {
    const res = await fetch(`${API_BASE}/api/settings/spoc-maintenance`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...getAuthHeader() },
      body: JSON.stringify({ enabled, message }),
    });
    const j = await res.json();
    if (!res.ok) return { success: false, error: j.error };
    return { success: true, enabled: j.enabled, error: null };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

// ─── SSE: subscribe to pair-team changes from the mentor backend ──────────────
// Admin portal subscribes to the mentor backend's /api/events stream so the
// teams list auto-refreshes when a mentor assigns/changes a ministry or skill,
// adds/removes a member, or renames a team.
//
// PM_API_BASE: defaults to the admin backend if VITE_PM_BACKEND_URL is not set.
// In most deployments both the admin and mentor backends are separate — set the
// env var in Vercel/Netlify to the mentor backend's public URL.
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
