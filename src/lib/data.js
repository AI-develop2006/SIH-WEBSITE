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

  deleteTeam: async (teamId) => {
    try {
      const res = await fetch(`${API_BASE}/api/teams/${teamId}`, {
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
};

export function isConfigured() {
  return true;
}
