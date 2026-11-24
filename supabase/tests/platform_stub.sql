-- Minimal local substitutes for Supabase-managed roles and metadata tables.
-- This file is only loaded by run-postgres.sh on a disposable cluster.
create role anon nologin;
create role authenticated nologin;
create schema auth;
create schema storage;

create table auth.users (id uuid primary key, is_anonymous boolean not null default false);

create function auth.jwt() returns jsonb language sql stable as $$
  select nullif(current_setting('request.jwt.claims', true), '')::jsonb
$$;

create function auth.uid() returns uuid language sql stable as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    auth.jwt() ->> 'sub'
  )::uuid
$$;
grant usage on schema auth to authenticated, anon;
grant execute on function auth.uid() to authenticated, anon;
grant execute on function auth.jwt() to authenticated, anon;

create table storage.buckets (
  id text primary key,
  name text not null,
  public boolean not null default false,
  file_size_limit bigint,
  allowed_mime_types text[]
);
create table storage.objects (
  id uuid primary key default gen_random_uuid(),
  bucket_id text not null references storage.buckets(id),
  name text not null,
  owner_id text,
  metadata jsonb,
  unique (bucket_id, name)
);
alter table storage.objects enable row level security;
grant usage on schema storage to authenticated, anon;
grant select, insert, update, delete on storage.objects to authenticated, anon;
