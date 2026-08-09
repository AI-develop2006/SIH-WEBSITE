export type Profile = {
  id: string;
  name: string;
  section: string | null;
  department: string | null;
  domain: string | null;
  language: string | null;
  gender: string | null;
  github: string | null;
  phone: string | null;
  email: string | null;
  tech_stack: string[];
  role: "student" | "admin";
  register_no: string | null;
  year: string | null;
  languages: string[];
  linkedin: string | null;
  project_type: "Hardware" | "Software" | "Hardware & Software" | null;
  verified: boolean;
  avatar_url: string | null;
  created_at: string;
  project_title: string | null;
  project_description: string | null;
  youtube_link: string | null;
  google_drive_ppt: string | null;
  software_domain: string | null;
  hardware_domain: string | null;
  domain_interests: string[];
  github_repo: string | null;
  resume_link: string | null;
  sih_participant: boolean;
  sih_num_participations: number | null;
  sih_participation_year: number | null;
  sih_problem_statement: string | null;
  sih_project_domain: string | null;
  sih_project_role: string | null;
  sih_position_reached: string | null;
  sih_nodal_center: string | null;
  sih_history?: SihHistoryEntry[] | null;
};

export interface SihHistoryEntry {
  year: string;
  problem_statement: string;
  project_domain: string;
  project_role: string;
  position_reached: string;
}

export type Team = {
  id: string;
  name: string;
  leader_id: string;
  problem_id: string | null;
  theme_id: string | null;
  created_at: string;
};

export type TeamMember = {
  id: string;
  team_id: string;
  member_id: string;
  joined_at: string;
};

export type Invite = {
  id: string;
  team_id: string;
  sender_id: string;
  invitee_id: string;
  kind: "invite" | "request";
  status: "pending" | "accepted" | "rejected";
  created_at: string;
};

export type Problem = {
  id: string;
  title: string;
  theme_id: string | null;
  category: string | null;
  description: string | null;
};

export type Theme = {
  id: string;
  name: string;
  slug: string;
};

export type EnrichedTeam = {
  team: Team;
  leader: Profile | null;
  members: Profile[];
  stats: ReturnType<typeof import("./utils").computeStats>;
};

export type ApiResult<T> = { data: T | null; error: string | null };

export type TimelineEvent = {
  id: string;
  step: string;
  date: string;
  label: string;
  description: string;
  status: "done" | "active" | "upcoming";
  sort_order: number;
  created_at?: string;
};

export type Announcement = {
  id: string;
  content: string;
  active: boolean;
  created_at: string;
};
