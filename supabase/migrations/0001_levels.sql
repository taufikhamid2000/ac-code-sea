-- Community level sharing.
--
-- All access goes through server-side API routes using the service-role
-- key (which bypasses RLS). RLS is enabled with NO policies, so the anon
-- key cannot read or write this table directly — writes are gated by a
-- per-level edit token checked in the API layer.

create extension if not exists pgcrypto;

create table if not exists public.levels (
  id          uuid primary key default gen_random_uuid(),
  slug        text unique not null,
  title       text not null,
  chapter     text not null default '',
  author      text not null default 'anonymous',
  data        jsonb not null,
  edit_token  text not null,
  published   boolean not null default true,
  plays       integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists levels_published_created_idx
  on public.levels (published, created_at desc);

alter table public.levels enable row level security;

-- Atomic play-count increment (called by the server on level load).
create or replace function public.increment_level_plays(level_slug text)
returns void
language sql
as $$
  update public.levels set plays = plays + 1 where slug = level_slug;
$$;
