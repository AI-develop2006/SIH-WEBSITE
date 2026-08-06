-- ============================================================
-- SIH 2026 · expose email on profiles for admin views/exports
-- ============================================================

alter table public.profiles
  add column if not exists email text;

update public.profiles p
set email = u.email
from auth.users u
where p.id = u.id and (p.email is null or p.email = '');

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
    tech_stack, role, register_no, year, languages, linkedin, project_type, email
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
    nullif(meta->>'project_type', ''),
    coalesce(new.email, meta->>'email', '')
  )
  on conflict (id) do update
    set email = excluded.email;
  return new;
end;
$$;
