-- ============================================================
-- SIH 2026 · Team Builder — Supabase schema
-- Run this in: Supabase Dashboard → SQL Editor → New query → Run
-- ============================================================

-- ---------- Tables ----------

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null default '',
  section text,
  department text,
  domain text,
  language text,
  gender text check (gender in ('Male', 'Female', 'Other')),
  github text,
  phone text unique,
  tech_stack text[] not null default '{}',
  role text not null default 'student' check (role in ('student', 'admin')),
  created_at timestamptz not null default now()
);

create table if not exists public.themes (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique
);

create table if not exists public.problems (
  id uuid primary key default gen_random_uuid(),
  theme_id uuid references public.themes(id) on delete set null,
  title text not null,
  category text,
  description text
);

create table if not exists public.teams (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  leader_id uuid not null references auth.users(id) on delete cascade,
  problem_id uuid references public.problems(id) on delete set null,
  theme_id uuid references public.themes(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.team_members (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  member_id uuid not null references auth.users(id) on delete cascade,
  joined_at timestamptz not null default now(),
  unique (team_id, member_id)
);

create table if not exists public.invites (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  invitee_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('invite', 'request')),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'rejected')),
  created_at timestamptz not null default now()
);

-- ---------- Auto-create profile on signup ----------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  meta jsonb := new.raw_user_meta_data;
begin
  insert into public.profiles (
    id, name, section, department, domain, language, gender, github, phone, tech_stack, role
  )
  values (
    new.id,
    coalesce(meta->>'name', ''),
    nullif(meta->>'section', ''),
    coalesce(meta->>'department', ''),
    nullif(meta->>'domain', ''),
    nullif(meta->>'language', ''),
    coalesce(meta->>'gender', ''),
    nullif(meta->>'github', ''),
    coalesce(new.phone, meta->>'phone', ''),
    coalesce(string_to_array(coalesce(meta->>'tech_stack', ''), ','), '{}')::text[],
    coalesce(meta->>'role', 'student')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- Team stats view ----------

create or replace view public.team_stats as
select
  t.id as team_id,
  count(tm.member_id) as member_count,
  count(*) filter (where p.gender = 'Female') as girl_count,
  count(distinct p.department) as dept_count
from public.teams t
join public.team_members tm on tm.team_id = t.id
join public.profiles p on p.id = tm.member_id
group by t.id;

-- ---------- Row Level Security ----------

alter table public.profiles enable row level security;
alter table public.teams enable row level security;
alter table public.team_members enable row level security;
alter table public.invites enable row level security;
alter table public.problems enable row level security;
alter table public.themes enable row level security;

drop policy if exists "profiles select" on public.profiles;
create policy "profiles select" on public.profiles
  for select using (auth.uid() is not null);

drop policy if exists "profiles insert own" on public.profiles;
create policy "profiles insert own" on public.profiles
  for insert with check (auth.uid() = id);

drop policy if exists "profiles update own" on public.profiles;
create policy "profiles update own" on public.profiles
  for update using (auth.uid() = id);

drop policy if exists "teams select" on public.teams;
create policy "teams select" on public.teams
  for select using (auth.uid() is not null);

drop policy if exists "teams insert" on public.teams;
create policy "teams insert" on public.teams
  for insert with check (auth.uid() = leader_id);

drop policy if exists "teams update leader" on public.teams;
create policy "teams update leader" on public.teams
  for update using (auth.uid() = leader_id);

drop policy if exists "teams delete leader" on public.teams;
create policy "teams delete leader" on public.teams
  for delete using (auth.uid() = leader_id);

drop policy if exists "team_members select" on public.team_members;
create policy "team_members select" on public.team_members
  for select using (auth.uid() is not null);

drop policy if exists "invites select" on public.invites;
create policy "invites select" on public.invites
  for select using (
    auth.uid() = invitee_id
    or auth.uid() = sender_id
    or auth.uid() in (select leader_id from public.teams where id = team_id)
  );

drop policy if exists "problems select" on public.problems;
create policy "problems select" on public.problems
  for select using (auth.uid() is not null);

drop policy if exists "themes select" on public.themes;
create policy "themes select" on public.themes
  for select using (auth.uid() is not null);

-- ---------- Team rule validation ----------

create or replace function public.team_rules_violation(
  p_team_id uuid,
  p_new_gender text,
  p_new_dept text
) returns text
language plpgsql
security definer set search_path = public
as $$
declare
  v_count int;
  v_girls int;
  v_depts int;
begin
  select count(*) into v_count from public.team_members where team_id = p_team_id;
  if v_count + 1 > 6 then
    return 'Team would exceed the 6 member limit';
  end if;

  select count(*) filter (where p.gender = 'Female')
    into v_girls
  from public.team_members tm
  join public.profiles p on p.id = tm.member_id
  where tm.team_id = p_team_id;

  select count(distinct p.department)
    into v_depts
  from public.team_members tm
  join public.profiles p on p.id = tm.member_id
  where tm.team_id = p_team_id;

  if v_girls + (p_new_gender = 'Female')::int < 2 then
    return 'Team would have fewer than 2 female members';
  end if;

  if v_depts < 2 then
    if p_new_dept is null then
      return 'Team would have members from fewer than 2 departments';
    end if;
    if exists (
      select 1
      from public.team_members tm
      join public.profiles p on p.id = tm.member_id
      where tm.team_id = p_team_id and p.department = p_new_dept
    ) then
      return 'Team would have members from fewer than 2 departments';
    end if;
  end if;

  return null;
end;
$$;

-- ---------- RPC functions ----------

create or replace function public.create_team(p_name text, p_problem_id uuid default null)
returns uuid
language plpgsql
security definer set search_path = public
as $$
declare
  v_team_id uuid;
begin
  if exists (select 1 from public.team_members where member_id = auth.uid()) then
    raise exception 'You are already in a team';
  end if;
  if p_name is null or trim(p_name) = '' then
    raise exception 'Team name is required';
  end if;

  insert into public.teams (name, leader_id, problem_id)
  values (trim(p_name), auth.uid(), p_problem_id)
  returning id into v_team_id;

  insert into public.team_members (team_id, member_id)
  values (v_team_id, auth.uid());

  return v_team_id;
end;
$$;

create or replace function public.request_to_join(p_team_id uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_leader uuid;
begin
  if exists (select 1 from public.team_members where member_id = auth.uid()) then
    raise exception 'You are already in a team';
  end if;

  select leader_id into v_leader from public.teams where id = p_team_id;
  if v_leader is null then raise exception 'Team not found'; end if;

  if exists (
    select 1 from public.invites
    where team_id = p_team_id and sender_id = auth.uid() and kind = 'request' and status = 'pending'
  ) then
    raise exception 'You already requested to join this team';
  end if;

  insert into public.invites (team_id, sender_id, invitee_id, kind)
  values (p_team_id, auth.uid(), v_leader, 'request');
end;
$$;

create or replace function public.send_invite(p_team_id uuid, p_invitee_id uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  if not exists (select 1 from public.team_members where team_id = p_team_id and member_id = auth.uid()) then
    raise exception 'You must be in the team to invite';
  end if;
  if p_invitee_id = auth.uid() then
    raise exception 'You cannot invite yourself';
  end if;
  if exists (select 1 from public.team_members where member_id = p_invitee_id) then
    raise exception 'That person is already in a team';
  end if;
  if exists (
    select 1 from public.invites
    where team_id = p_team_id and invitee_id = p_invitee_id and kind = 'invite' and status = 'pending'
  ) then
    raise exception 'An invite is already pending for that person';
  end if;

  insert into public.invites (team_id, sender_id, invitee_id, kind)
  values (p_team_id, auth.uid(), p_invitee_id, 'invite');
end;
$$;

create or replace function public.accept_invite(p_invite_id uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_invite record;
  v_leader uuid;
  v_added uuid;
  v_gender text;
  v_dept text;
  v_violation text;
begin
  select * into v_invite from public.invites where id = p_invite_id;
  if v_invite.id is null then raise exception 'Invite not found'; end if;
  if v_invite.status <> 'pending' then raise exception 'This invite was already processed'; end if;

  select leader_id into v_leader from public.teams where id = v_invite.team_id;

  if v_invite.kind = 'invite' then
    if auth.uid() <> v_invite.invitee_id then raise exception 'This invite is not addressed to you'; end if;
    v_added := auth.uid();
  else
    if auth.uid() <> v_leader then raise exception 'Only the team leader can accept this request'; end if;
    v_added := v_invite.sender_id;
  end if;

  if exists (select 1 from public.team_members where member_id = v_added) then
    raise exception 'That user is already in a team';
  end if;

  select gender, department into v_gender, v_dept from public.profiles where id = v_added;
  v_violation := public.team_rules_violation(v_invite.team_id, v_gender, v_dept);
  if v_violation is not null then raise exception '%', v_violation; end if;

  insert into public.team_members (team_id, member_id) values (v_invite.team_id, v_added);
  update public.invites set status = 'accepted' where id = p_invite_id;
end;
$$;

create or replace function public.reject_invite(p_invite_id uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_invite record;
  v_leader uuid;
begin
  select * into v_invite from public.invites where id = p_invite_id;
  if v_invite.id is null then raise exception 'Invite not found'; end if;

  select leader_id into v_leader from public.teams where id = v_invite.team_id;

  if v_invite.kind = 'invite' and auth.uid() <> v_invite.invitee_id then
    raise exception 'This invite is not addressed to you';
  end if;
  if v_invite.kind = 'request' and auth.uid() <> v_leader then
    raise exception 'Only the team leader can reject this request';
  end if;

  update public.invites set status = 'rejected' where id = p_invite_id;
end;
$$;

create or replace function public.leave_team(p_team_id uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_leader uuid;
begin
  select leader_id into v_leader from public.teams where id = p_team_id;
  if v_leader is null then raise exception 'Team not found'; end if;

  if not exists (select 1 from public.team_members where team_id = p_team_id and member_id = auth.uid()) then
    raise exception 'You are not a member of this team';
  end if;

  if v_leader = auth.uid() then
    delete from public.teams where id = p_team_id; -- cascades members + invites
  else
    delete from public.team_members where team_id = p_team_id and member_id = auth.uid();
    update public.invites set status = 'rejected'
    where team_id = p_team_id and (sender_id = auth.uid() or invitee_id = auth.uid()) and status = 'pending';
  end if;
end;
$$;

create or replace function public.remove_member(p_team_id uuid, p_member_id uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_leader uuid;
begin
  select leader_id into v_leader from public.teams where id = p_team_id;
  if v_leader is null then raise exception 'Team not found'; end if;
  if v_leader <> auth.uid() then raise exception 'Only the team leader can remove members'; end if;
  if p_member_id = auth.uid() then raise exception 'Leaders cannot remove themselves — use Leave team'; end if;

  delete from public.team_members where team_id = p_team_id and member_id = p_member_id;
  update public.invites set status = 'rejected'
  where team_id = p_team_id and invitee_id = p_member_id and status = 'pending';
end;
$$;

create or replace function public.promote_admin(p_phone text)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_role text;
begin
  select role into v_role from public.profiles where id = auth.uid();
  if v_role is null or v_role <> 'admin' then
    raise exception 'Only an existing admin can promote users';
  end if;

  update public.profiles set role = 'admin' where phone = p_phone;
  if not found then raise exception 'No student found with that phone number'; end if;
end;
$$;

-- ---------- Permissions ----------

grant execute on function public.create_team(text, uuid) to authenticated;
grant execute on function public.request_to_join(uuid) to authenticated;
grant execute on function public.send_invite(uuid, uuid) to authenticated;
grant execute on function public.accept_invite(uuid) to authenticated;
grant execute on function public.reject_invite(uuid) to authenticated;
grant execute on function public.leave_team(uuid) to authenticated;
grant execute on function public.remove_member(uuid, uuid) to authenticated;
grant execute on function public.promote_admin(text) to authenticated;
grant execute on function public.team_rules_violation(uuid, text, text) to authenticated;

revoke all on function public.create_team(text, uuid) from public;
revoke all on function public.request_to_join(uuid) from public;
revoke all on function public.send_invite(uuid, uuid) from public;
revoke all on function public.accept_invite(uuid) from public;
revoke all on function public.reject_invite(uuid) from public;
revoke all on function public.leave_team(uuid) from public;
revoke all on function public.remove_member(uuid, uuid) from public;
revoke all on function public.promote_admin(text) from public;
revoke all on function public.team_rules_violation(uuid, text, text) from public;

-- ---------- Seed: themes + problems ----------

insert into public.themes (name, slug) values
  ('Healthcare', 'healthcare'),
  ('Agriculture and FoodTech', 'agritech'),
  ('Waste Management', 'waste'),
  ('Education and Skill Development', 'education'),
  ('Smart Governance', 'governance'),
  ('Disaster Management', 'disaster'),
  ('Heritage and Culture', 'heritage')
on conflict (slug) do nothing;

insert into public.problems (theme_id, title, category, description)
select t.id, p.title, p.category, p.description
from (values
  ('healthcare', 'Early disease detection using rural health data', 'ML / AI', 'Build a model that flags likely outbreaks or chronic cases from village-level health records.'),
  ('agritech', 'Crop advisory chatbot for small farmers', 'Chatbot', 'Voice-first assistant giving sowing, irrigation and market-price advice in local languages.'),
  ('waste', 'Smart segregation bins with reward system', 'IoT', 'IoT bins that sort waste categories and reward citizens for correct disposal.'),
  ('education', 'Adaptive learning platform for vernacular students', 'EdTech', 'Personalised practice tests that adapt to a students level in regional languages.'),
  ('governance', 'Single-window grievance tracker for civic issues', 'Web Platform', 'Public complaint filing with status tracking and auto-escalation to the right department.'),
  ('disaster', 'Flood early-warning broadcast network', 'IoT', 'Sensor + SMS network that warns villages before a flood reaches them.'),
  ('heritage', 'AR-guided heritage site explorer', 'AR / VR', 'Augmented-reality tour companion for monuments with historical storytelling.')
) as p(slug, title, category, description)
join public.themes t on t.slug = p.slug;

-- ---------- Getting started ----------
-- 1. Enable phone auth:  Authentication → Sign In / Sign Up → Providers → Phone → ON.
--    Set  Authentication → Sign In / Sign Up → Phone → "Confirm phone" → OFF (for instant login).
-- 2. Set  Authentication → URL Configuration → Site URL → http://localhost:3000
-- 3. Copy .env.local.example → .env.local and fill NEXT_PUBLIC_SUPABASE_URL + ANON key.
-- 4. Register a student from the app, then promote them to admin:
--    select public.promote_admin('9876500001');
