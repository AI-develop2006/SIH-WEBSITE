-- ============================================================
-- SIH 2026 · Registration blueprint transformation
-- Mirrors the official SIH internal registration form fields:
-- Name, Register No, Phone, Email, Department, Year, Section,
-- Gender, Languages, LinkedIn, Project Type.
-- Adds admin control RPCs (verify students, manage teams/problems).
-- ============================================================

-- ---------- New profile columns ----------

alter table public.profiles
  add column if not exists register_no text,
  add column if not exists year text check (year in ('I', 'II', 'III', 'IV')),
  add column if not exists languages text[] not null default '{}',
  add column if not exists linkedin text,
  add column if not exists project_type text check (project_type in ('Hardware', 'Software', 'Both')),
  add column if not exists verified boolean not null default false;

-- ---------- Updated auto-profile trigger ----------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  meta jsonb := new.raw_user_meta_data;
begin
  insert into public.profiles (
    id, name, section, department, domain, language, gender, github, phone,
    tech_stack, role, register_no, year, languages, linkedin, project_type
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
    coalesce(meta->>'role', 'student'),
    nullif(meta->>'register_no', ''),
    nullif(meta->>'year', ''),
    coalesce(string_to_array(coalesce(meta->>'languages', ''), ','), '{}')::text[],
    nullif(meta->>'linkedin', ''),
    nullif(meta->>'project_type', '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- ---------- Admin helpers ----------

create or replace function public.is_admin()
returns boolean
language plpgsql
security definer set search_path = public
as $$
declare
  v_role text;
begin
  select role into v_role from public.profiles where id = auth.uid();
  return coalesce(v_role, '') = 'admin';
end;
$$;

-- ---------- Admin RPC: verify a registration ----------

create or replace function public.verify_student(p_user_id uuid, p_verified boolean)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Admins only';
  end if;
  update public.profiles set verified = p_verified where id = p_user_id;
  if not found then raise exception 'No student found'; end if;
end;
$$;

-- ---------- Admin RPC: delete any team ----------

create or replace function public.delete_team_admin(p_team_id uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Admins only';
  end if;
  delete from public.teams where id = p_team_id;
  if not found then raise exception 'Team not found'; end if;
end;
$$;

-- ---------- Admin RPC: upsert a problem statement ----------

create or replace function public.upsert_problem_admin(
  p_id uuid default null,
  p_title text default null,
  p_category text default null,
  p_description text default null,
  p_theme_id uuid default null
)
returns uuid
language plpgsql
security definer set search_path = public
as $$
declare
  v_id uuid;
begin
  if not public.is_admin() then
    raise exception 'Admins only';
  end if;
  if p_title is null or trim(p_title) = '' then
    raise exception 'Problem title is required';
  end if;

  if p_id is null then
    insert into public.problems (title, category, description, theme_id)
    values (trim(p_title), p_category, p_description, p_theme_id)
    returning id into v_id;
  else
    update public.problems
    set title = trim(p_title), category = p_category, description = p_description, theme_id = p_theme_id
    where id = p_id
    returning id into v_id;
    if v_id is null then raise exception 'Problem not found'; end if;
  end if;

  return v_id;
end;
$$;

-- ---------- Admin RPC: delete a problem statement ----------

create or replace function public.delete_problem_admin(p_problem_id uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Admins only';
  end if;
  delete from public.problems where id = p_problem_id;
  if not found then raise exception 'Problem not found'; end if;
end;
$$;

-- ---------- Permissions ----------

grant execute on function public.is_admin() to authenticated;
grant execute on function public.verify_student(uuid, boolean) to authenticated;
grant execute on function public.delete_team_admin(uuid) to authenticated;
grant execute on function public.upsert_problem_admin(uuid, text, text, text, uuid) to authenticated;
grant execute on function public.delete_problem_admin(uuid) to authenticated;

revoke all on function public.is_admin() from public;
revoke all on function public.verify_student(uuid, boolean) from public;
revoke all on function public.delete_team_admin(uuid) from public;
revoke all on function public.upsert_problem_admin(uuid, text, text, text, uuid) from public;
revoke all on function public.delete_problem_admin(uuid) from public;
