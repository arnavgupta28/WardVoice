-- WardVoice schema. Run once in the Supabase SQL editor (safe to re-run).

-- Whole ward state as one jsonb snapshot. Only the backend (service role) touches it:
-- RLS is on and there are no policies, so anon/authenticated clients get nothing.
create table if not exists public.ward_state (
  id text primary key,
  state jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.ward_state enable row level security;

create or replace function public.touch_ward_state_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists ward_state_updated_at on public.ward_state;
create trigger ward_state_updated_at
  before update on public.ward_state
  for each row execute function public.touch_ward_state_updated_at();

-- Sign-in profiles: which role (and, for family, which patient) a Supabase user has.
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role text not null check (role in ('doctor', 'family')),
  display_name text,
  patient_id text
);

alter table public.profiles enable row level security;

drop policy if exists "user can read own profile" on public.profiles;
create policy "user can read own profile"
  on public.profiles for select
  to authenticated
  using (auth.uid() = id);
