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
  project_type: "Hardware" | "Software" | "Both" | null;
  verified: boolean;
  avatar_url: string | null;
  created_at: string;
};

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
