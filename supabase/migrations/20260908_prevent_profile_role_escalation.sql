begin;

-- Reproduces two trigger functions + triggers that were applied directly to
-- production via the Supabase SQL editor (SWP-007 remediation) so tracked
-- migration history matches the live database. Do not alter this to change
-- live behavior — this file documents what is already running in prod.

-- Blocks role self-escalation: an `anon`/`authenticated` session (i.e. a
-- normal user's own JWT, via PostgREST/RLS) can no longer change its own
-- `profiles.role` on UPDATE. Service-role writes (all backend registration
-- and admin routes use the service-role key) are unaffected, since
-- auth.role() returns 'service_role' for those, not 'anon'/'authenticated'.
create or replace function public.prevent_profile_role_escalation()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
begin
  if auth.role() in ('anon', 'authenticated') then

    if tg_op = 'UPDATE'
       and new.role is distinct from old.role then

      raise exception 'Changing profile role is not permitted'
        using errcode = '42501';

    end if;

  end if;

  return new;
end;
$function$;

drop trigger if exists trg_prevent_profile_role_escalation on public.profiles;

create trigger trg_prevent_profile_role_escalation
  before update on public.profiles
  for each row
  execute function public.prevent_profile_role_escalation();

-- Defense-in-depth: blocks an `anon`/`authenticated` session from ever
-- inserting a `profiles` row with role = 'super_admin'. Public signup
-- (handle_new_user) already hardcodes role to 'customer' and never reads
-- role from client-supplied metadata, so this trigger guards against any
-- future/alternate insert path, not a currently-known exploit.
create or replace function public.prevent_public_super_admin_profile()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
begin
  if auth.role() in ('anon', 'authenticated')
     and new.role::text = 'super_admin' then

    raise exception 'Public signup cannot create a super_admin account'
      using errcode = '42501';

  end if;

  return new;
end;
$function$;

drop trigger if exists trg_prevent_public_super_admin_profile on public.profiles;

create trigger trg_prevent_public_super_admin_profile
  before insert on public.profiles
  for each row
  execute function public.prevent_public_super_admin_profile();

commit;
