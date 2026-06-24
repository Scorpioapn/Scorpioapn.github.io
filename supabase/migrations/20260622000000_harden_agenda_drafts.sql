alter table public.agenda_drafts
  add column if not exists expires_at timestamptz not null default (now() + interval '90 days');

update public.agenda_drafts
set expires_at = now() + interval '90 days'
where expires_at <= now();

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'agenda_drafts_payload_size'
      and conrelid = 'public.agenda_drafts'::regclass
  ) then
    alter table public.agenda_drafts
      add constraint agenda_drafts_payload_size
      check (pg_column_size(payload) <= 4194304) not valid;
  end if;
end;
$$;

create index if not exists agenda_drafts_expires_at_idx
  on public.agenda_drafts (expires_at);

create table if not exists public.agenda_draft_rate_limits (
  bucket_key text not null,
  action text not null,
  window_started_at timestamptz not null,
  request_count integer not null,
  primary key (bucket_key, action),
  constraint agenda_draft_rate_limits_action check (action in ('create', 'get', 'save')),
  constraint agenda_draft_rate_limits_count check (request_count > 0)
);

alter table public.agenda_draft_rate_limits enable row level security;
revoke all on table public.agenda_draft_rate_limits from public, anon, authenticated;

create or replace function public.consume_agenda_draft_rate_limit(
  p_bucket_key text,
  p_action text,
  p_limit integer,
  p_window_seconds integer
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  current_count integer;
begin
  if p_bucket_key is null or length(p_bucket_key) < 16 then
    raise exception 'invalid rate limit bucket';
  end if;
  if p_action not in ('create', 'get', 'save') or p_limit < 1 or p_window_seconds < 1 then
    raise exception 'invalid rate limit configuration';
  end if;

  delete from public.agenda_draft_rate_limits
  where window_started_at < now() - interval '2 hours';

  insert into public.agenda_draft_rate_limits as limits
    (bucket_key, action, window_started_at, request_count)
  values (p_bucket_key, p_action, now(), 1)
  on conflict (bucket_key, action) do update
  set
    window_started_at = case
      when limits.window_started_at <= now() - make_interval(secs => p_window_seconds) then now()
      else limits.window_started_at
    end,
    request_count = case
      when limits.window_started_at <= now() - make_interval(secs => p_window_seconds) then 1
      else limits.request_count + 1
    end
  returning request_count into current_count;

  return current_count <= p_limit;
end;
$$;

create or replace function public.create_agenda_draft(payload jsonb)
returns table(id text, version bigint)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  draft_id text;
begin
  delete from public.agenda_drafts where expires_at <= now();
  draft_id := rtrim(translate(encode(extensions.gen_random_bytes(18), 'base64'), '+/', '-_'), '=');

  insert into public.agenda_drafts (id, payload, expires_at)
  values (draft_id, $1, now() + interval '90 days');

  return query
  select d.id, d.version
  from public.agenda_drafts as d
  where d.id = draft_id;
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
  where d.id = $1
    and d.expires_at > now();
$$;

create or replace function public.save_agenda_draft(
  draft_id text,
  payload jsonb,
  client_id text,
  expected_version bigint
)
returns table(version bigint, updated_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  draft_exists boolean;
begin
  if expected_version is null or expected_version < 1 then
    raise exception 'expected version must be positive' using errcode = '22023';
  end if;

  return query
  update public.agenda_drafts as d
  set
    payload = $2,
    version = d.version + 1,
    updated_at = now(),
    updated_by = $3,
    expires_at = now() + interval '90 days'
  where d.id = $1
    and d.version = $4
    and d.expires_at > now()
  returning d.version, d.updated_at;

  if found then
    return;
  end if;

  select exists (
    select 1
    from public.agenda_drafts as d
    where d.id = $1
      and d.expires_at > now()
  ) into draft_exists;

  if draft_exists then
    raise exception 'agenda draft version conflict' using errcode = '40001';
  end if;

  raise exception 'agenda draft not found' using errcode = 'P0002';
end;
$$;

revoke all on function public.create_agenda_draft(jsonb) from public, anon, authenticated;
revoke all on function public.get_agenda_draft(text) from public, anon, authenticated;
revoke all on function public.save_agenda_draft(text, jsonb, text, bigint) from public, anon, authenticated;
revoke all on function public.consume_agenda_draft_rate_limit(text, text, integer, integer) from public, anon, authenticated;

grant execute on function public.create_agenda_draft(jsonb) to service_role;
grant execute on function public.get_agenda_draft(text) to service_role;
grant execute on function public.save_agenda_draft(text, jsonb, text, bigint) to service_role;
grant execute on function public.consume_agenda_draft_rate_limit(text, text, integer, integer) to service_role;
