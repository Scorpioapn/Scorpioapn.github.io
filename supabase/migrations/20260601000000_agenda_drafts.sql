create extension if not exists pgcrypto;

create table if not exists public.agenda_drafts (
  id text primary key,
  payload jsonb not null,
  version bigint not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by text,
  constraint agenda_drafts_id_format check (id ~ '^[A-Za-z0-9_-]{20,80}$')
);

alter table public.agenda_drafts enable row level security;

revoke all on table public.agenda_drafts from anon, authenticated;

create or replace function public.create_agenda_draft(payload jsonb)
returns table(id text, version bigint)
language plpgsql
security definer
set search_path = public
as $$
declare
  draft_id text;
begin
  draft_id := rtrim(translate(encode(gen_random_bytes(18), 'base64'), '+/', '-_'), '=');

  insert into public.agenda_drafts (id, payload)
  values (draft_id, $1);

  return query
  select agenda_drafts.id, agenda_drafts.version
  from public.agenda_drafts
  where agenda_drafts.id = draft_id;
end;
$$;

create or replace function public.get_agenda_draft(draft_id text)
returns table(payload jsonb, version bigint, updated_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select d.payload, d.version, d.updated_at
  from public.agenda_drafts as d
  where d.id = $1;
$$;

create or replace function public.save_agenda_draft(draft_id text, payload jsonb, client_id text)
returns table(version bigint, updated_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  update public.agenda_drafts as d
  set
    payload = $2,
    version = d.version + 1,
    updated_at = now(),
    updated_by = $3
  where d.id = $1
  returning d.version, d.updated_at;

  if not found then
    raise exception 'agenda draft not found';
  end if;
end;
$$;

revoke all on function public.create_agenda_draft(jsonb) from public;
revoke all on function public.get_agenda_draft(text) from public;
revoke all on function public.save_agenda_draft(text, jsonb, text) from public;

grant usage on schema public to anon, authenticated;
grant execute on function public.create_agenda_draft(jsonb) to anon, authenticated;
grant execute on function public.get_agenda_draft(text) to anon, authenticated;
grant execute on function public.save_agenda_draft(text, jsonb, text) to anon, authenticated;
