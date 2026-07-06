drop function if exists public.save_agenda_draft(text, jsonb, text, bigint);

create or replace function public.save_agenda_draft(
  draft_id text,
  payload jsonb,
  client_id text,
  expected_version bigint
)
returns table(version bigint, updated_at timestamptz, status text)
language plpgsql
security definer
set search_path = public
as $$
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
  returning d.version, d.updated_at, 'saved'::text;

  if found then
    return;
  end if;

  return query
  select d.version, d.updated_at, 'version_conflict'::text
  from public.agenda_drafts as d
  where d.id = $1
    and d.expires_at > now();

  if found then
    return;
  end if;

  return query
  select null::bigint, null::timestamptz, 'not_found'::text;
end;
$$;

revoke all on function public.save_agenda_draft(text, jsonb, text, bigint) from public, anon, authenticated;
grant execute on function public.save_agenda_draft(text, jsonb, text, bigint) to service_role;
