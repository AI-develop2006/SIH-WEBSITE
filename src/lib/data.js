"use client";

const API_BASE = import.meta.env.VITE_BACKEND_URL || "";

function getAuthHeader() {
  const token = localStorage.getItem("pm_auth_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
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
    const json = await res.json();
    if (!res.ok) return { data: null, error: json.error || "Sign up failed" };

    if (json.session?.access_token) {
      localStorage.setItem("pm_auth_token", json.session.access_token);
    }
    return { data: json, error: null };
  } catch (err) {
    return { data: null, error: err.message };
  }
}

export async function logoutUser() {
  localStorage.removeItem("pm_auth_token");
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
  createEmptyTeamMentor: async (name, category = "Pairs") => {
    try {
      const res = await fetch(`${API_BASE}/api/teams/empty`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeader() },
        body: JSON.stringify({ name, category }),
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
