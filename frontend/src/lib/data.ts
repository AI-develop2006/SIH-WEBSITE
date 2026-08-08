"use client";

import { assertSupabase, isSupabaseConfigured } from "@/lib/supabase/client";
import { computeStats } from "@/lib/utils";
import type { ApiResult, EnrichedTeam, Invite, Profile, Problem, Team, TeamMember, Theme, TimelineEvent, Announcement } from "@/lib/types";

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
  const { error } = await supabase.from("profiles").upsert(
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
      project_title: (meta.project_title as string) ?? null,
      project_description: (meta.project_description as string) ?? null,
      youtube_link: (meta.youtube_link as string) ?? null,
      google_drive_ppt: (meta.google_drive_ppt as string) ?? null,
      software_domain: (meta.software_domain as string) ?? null,
      hardware_domain: (meta.hardware_domain as string) ?? null,
      domain_interests: Array.isArray(meta.domain_interests) ? meta.domain_interests : [],
      github_repo: (meta.github_repo as string) ?? null,
      resume_link: (meta.resume_link as string) ?? null,
      sih_participant: (meta.sih_participant as boolean) ?? false,
      sih_num_participations: (meta.sih_num_participations as number) ?? null,
      sih_participation_year: (meta.sih_participation_year as number) ?? null,
      sih_problem_statement: (meta.sih_problem_statement as string) ?? null,
      sih_project_domain: (meta.sih_project_domain as string) ?? null,
      sih_project_role: (meta.sih_project_role as string) ?? null,
      sih_position_reached: (meta.sih_position_reached as string) ?? null,
      sih_nodal_center: (meta.sih_nodal_center as string) ?? null,
    },
    { onConflict: "id" }
  );
  if (error) throw new Error(error.message);
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

export async function updateAvatarUrl(userId: string, url: string): Promise<ApiResult<null>> {
  const supabase = assertSupabase();
  const { error } = await supabase
    .from("profiles")
    .update({ avatar_url: url })
    .eq("id", userId);
  if (error) return { data: null, error: error.message };
  return { data: null, error: null };
}

export async function fetchTimelineEvents(): Promise<ApiResult<TimelineEvent[]>> {
  const supabase = assertSupabase();
  const { data, error } = await supabase
    .from("timeline_events")
    .select("*")
    .order("sort_order", { ascending: true });
  if (error) return { data: null, error: error.message };
  return { data: data as TimelineEvent[], error: null };
}

export async function fetchAnnouncements(): Promise<ApiResult<Announcement[]>> {
  const supabase = assertSupabase();
  const { data, error } = await supabase
    .from("announcements")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) return { data: null, error: error.message };
  return { data: data as Announcement[], error: null };
}

export async function upsertTimelineEvent(event: Partial<TimelineEvent>): Promise<ApiResult<TimelineEvent>> {
  const supabase = assertSupabase();
  const { data, error } = await supabase
    .from("timeline_events")
    .upsert(event)
    .select()
    .single();
  if (error) return { data: null, error: error.message };
  return { data: data as TimelineEvent, error: null };
}

export async function deleteTimelineEvent(eventId: string): Promise<ApiResult<null>> {
  const supabase = assertSupabase();
  const { error } = await supabase
    .from("timeline_events")
    .delete()
    .eq("id", eventId);
  if (error) return { data: null, error: error.message };
  return { data: null, error: null };
}

export async function upsertAnnouncement(announcement: Partial<Announcement>): Promise<ApiResult<Announcement>> {
  const supabase = assertSupabase();
  const { data, error } = await supabase
    .from("announcements")
    .upsert(announcement)
    .select()
    .single();
  if (error) return { data: null, error: error.message };
  return { data: data as Announcement, error: null };
}

export async function getEmailByRegisterNo(registerNo: string): Promise<{ email: string | null; error: string | null }> {
  const supabase = assertSupabase();
  const { data, error } = await supabase
    .from("profiles")
    .select("email")
    .ilike("register_no", registerNo.trim())
    .maybeSingle();

  if (error) return { email: null, error: error.message };
  return { email: data?.email ?? null, error: null };
}

export async function checkRegisterNoExists(registerNo: string): Promise<{ exists: boolean; error: string | null }> {
  const supabase = assertSupabase();
  const { data, error } = await supabase
    .from("profiles")
    .select("id")
    .ilike("register_no", registerNo.trim())
    .maybeSingle();

  if (error) return { exists: false, error: error.message };
  return { exists: !!data, error: null };
}

export async function checkEmailExists(email: string): Promise<{ exists: boolean; error: string | null }> {
  const supabase = assertSupabase();
  const { data, error } = await supabase
    .from("profiles")
    .select("id")
    .ilike("email", email.trim())
    .maybeSingle();

  if (error) return { exists: false, error: error.message };
  return { exists: !!data, error: null };
}

export async function checkPhoneExists(phone: string): Promise<{ exists: boolean; error: string | null }> {
  const supabase = assertSupabase();
  const { data, error } = await supabase
    .from("profiles")
    .select("id")
    .eq("phone", phone.trim())
    .maybeSingle();

  if (error) return { exists: false, error: error.message };
  return { exists: !!data, error: null };
}
