-- Auth + ownership. Levels become owned by a Supabase Auth user; access
-- is enforced by RLS (client talks to the DB directly with the anon key).

-- Owner column (the edit-token model is retired).
alter table public.levels
  add column if not exists user_id uuid references auth.users (id) on delete cascade;
alter table public.levels alter column edit_token drop not null;

create index if not exists levels_user_idx on public.levels (user_id);

-- Table privileges (RLS still restricts which rows each role may touch).
grant select on public.levels to anon;
grant select, insert, update, delete on public.levels to authenticated;

-- Policies ----------------------------------------------------------------
drop policy if exists "read published" on public.levels;
create policy "read published"
  on public.levels for select
  using (published = true);

drop policy if exists "read own" on public.levels;
create policy "read own"
  on public.levels for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "insert own" on public.levels;
create policy "insert own"
  on public.levels for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "update own" on public.levels;
create policy "update own"
  on public.levels for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "delete own" on public.levels;
create policy "delete own"
  on public.levels for delete
  to authenticated
  using (auth.uid() = user_id);

-- Play count: SECURITY DEFINER so anon can bump it without write access.
create or replace function public.increment_level_plays(level_slug text)
returns void
language sql
security definer
set search_path = public
as $$
  update public.levels set plays = plays + 1
  where slug = level_slug and published = true;
$$;

grant execute on function public.increment_level_plays(text) to anon, authenticated;
