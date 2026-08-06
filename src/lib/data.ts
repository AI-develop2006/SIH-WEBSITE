"use client";

import { assertSupabase, isSupabaseConfigured } from "@/lib/supabase/client";
import { computeStats } from "@/lib/utils";
import type { ApiResult, EnrichedTeam, Invite, Profile, Problem, Team, TeamMember, Theme } from "@/lib/types";

export async function getCurrentProfile(): Promise<ApiResult<Profile>> {
  const supabase = assertSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { data: null, error: "Not signed in" };

  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  if (error) return { data: null, error: error.message };
  return { data: data as Profile | null, error: null };
}

export async function ensureProfile(uid: string, meta: Record<string, unknown>): Promise<void> {
  const supabase = assertSupabase();
  const phone = (meta.phone as string) ?? "";
  await supabase.from("profiles").upsert(
    {
      id: uid,
      name: (meta.name as string) ?? "",
      section: (meta.section as string) ?? null,
      department: (meta.department as string) ?? "",
      domain: (meta.domain as string) ?? null,
      language: (meta.language as string) ?? null,
      gender: (meta.gender as string) ?? "",
      github: (meta.github as string) ?? null,
      phone,
      email: (meta.email as string) ?? "",
      tech_stack: Array.isArray(meta.tech_stack) ? meta.tech_stack : [],
      role: (meta.role as string) ?? "student",
      register_no: (meta.register_no as string) ?? null,
      year: (meta.year as string) ?? null,
      languages: Array.isArray(meta.languages) ? meta.languages : [],
      linkedin: (meta.linkedin as string) ?? null,
      project_type: (meta.project_type as string) ?? null,
    },
    { onConflict: "id" }
  );
}

export async function fetchEnrichedTeams(): Promise<ApiResult<EnrichedTeam[]>> {
  const supabase = assertSupabase();
  const [{ data: teams, error: e1 }, { data: members, error: e2 }, { data: profiles, error: e3 }] =
    await Promise.all([
      supabase.from("teams").select("*").order("created_at", { ascending: true }),
      supabase.from("team_members").select("*"),
      supabase.from("profiles").select("*"),
    ]);

  const err = e1?.message || e2?.message || e3?.message;
  if (err) return { data: null, error: err };

  const profileMap = new Map<string, Profile>((profiles as Profile[]).map((p) => [p.id, p]));

  const enriched: EnrichedTeam[] = (teams as Team[]).map((team) => {
    const teamMembers = (members as TeamMember[]).filter((m) => m.team_id === team.id);
    const memberProfiles = teamMembers
      .map((m) => profileMap.get(m.member_id))
      .filter((p): p is Profile => Boolean(p));
    const leader = profileMap.get(team.leader_id) ?? null;
    return {
      team,
      leader,
      members: memberProfiles,
      stats: computeStats(memberProfiles),
    };
  });

  return { data: enriched, error: null };
}

export async function fetchMyTeam(uid: string): Promise<ApiResult<EnrichedTeam | null>> {
  const { data: all, error } = await fetchEnrichedTeams();
  if (error) return { data: null, error };
  const mine = all?.find((t) => t.members.some((m) => m.id === uid)) ?? null;
  return { data: mine, error: null };
}

export async function fetchAllProfiles(): Promise<ApiResult<Profile[]>> {
  const supabase = assertSupabase();
  const { data, error } = await supabase.from("profiles").select("*").order("name");
  if (error) return { data: null, error: error.message };
  return { data: (data as Profile[]) ?? [], error: null };
}

export async function searchProfiles(opts: {
  q?: string;
  stack?: string;
  excludeId?: string;
}): Promise<ApiResult<Profile[]>> {
  const supabase = assertSupabase();
  let query = supabase.from("profiles").select("*").order("name");

  if (opts.excludeId) query = query.neq("id", opts.excludeId);
  if (opts.stack) query = query.contains("tech_stack", [opts.stack]);
  if (opts.q) {
    query = query.or(`name.ilike.%${opts.q}%,department.ilike.%${opts.q}%,section.ilike.%${opts.q}%,language.ilike.%${opts.q}%`);
  }

  const { data, error } = await query;
  if (error) return { data: null, error: error.message };
  return { data: (data as Profile[]) ?? [], error: null };
}

export async function fetchProblems(): Promise<ApiResult<Problem[]>> {
  const supabase = assertSupabase();
  const { data, error } = await supabase.from("problems").select("*").order("title");
  if (error) return { data: null, error: error.message };
  return { data: (data as Problem[]) ?? [], error: null };
}

export async function fetchThemes(): Promise<ApiResult<Theme[]>> {
  const supabase = assertSupabase();
  const { data, error } = await supabase.from("themes").select("*").order("name");
  if (error) return { data: null, error: error.message };
  return { data: (data as Theme[]) ?? [], error: null };
}

export async function fetchInvites(uid: string): Promise<ApiResult<{ incoming: Invite[]; sent: Invite[] }>> {
  const supabase = assertSupabase();
  const { data: all, error } = await supabase
    .from("invites")
    .select("*")
    .eq("status", "pending")
    .order("created_at", { ascending: false });

  if (error) return { data: null, error: error.message };
  const invites = (all as Invite[]) ?? [];
  return {
    data: {
      incoming: invites.filter((i) => i.invitee_id === uid),
      sent: invites.filter((i) => i.sender_id === uid),
    },
    error: null,
  };
}

type RpcResult = { data: unknown; error: string | null };

async function rpc(name: string, params: Record<string, unknown>): Promise<RpcResult> {
  const supabase = assertSupabase();
  const { error } = await supabase.rpc(name, params);
  if (error) return { data: null, error: error.message };
  return { data: true, error: null };
}

export const api = {
  createTeam: (name: string, problemId?: string) =>
    rpc("create_team", { p_name: name, p_problem_id: problemId ?? null }),
  requestToJoin: (teamId: string) => rpc("request_to_join", { p_team_id: teamId }),
  sendInvite: (teamId: string, inviteeId: string) =>
    rpc("send_invite", { p_team_id: teamId, p_invitee_id: inviteeId }),
  acceptInvite: (inviteId: string) => rpc("accept_invite", { p_invite_id: inviteId }),
  rejectInvite: (inviteId: string) => rpc("reject_invite", { p_invite_id: inviteId }),
  leaveTeam: (teamId: string) => rpc("leave_team", { p_team_id: teamId }),
  removeMember: (teamId: string, memberId: string) =>
    rpc("remove_member", { p_team_id: teamId, p_member_id: memberId }),
  promoteAdmin: (phone: string) => rpc("promote_admin", { p_phone: phone }),
  verifyStudent: (userId: string, verified: boolean) =>
    rpc("verify_student", { p_user_id: userId, p_verified: verified }),
  deleteTeam: (teamId: string) => rpc("delete_team_admin", { p_team_id: teamId }),
  upsertProblem: (input: {
    id?: string | null;
    title: string;
    category?: string | null;
    description?: string | null;
    themeId?: string | null;
  }) =>
    rpc("upsert_problem_admin", {
      p_id: input.id ?? null,
      p_title: input.title,
      p_category: input.category ?? null,
      p_description: input.description ?? null,
      p_theme_id: input.themeId ?? null,
    }),
  deleteProblem: (problemId: string) =>
    rpc("delete_problem_admin", { p_problem_id: problemId }),
};

export function isConfigured(): boolean {
  return isSupabaseConfigured();
}
