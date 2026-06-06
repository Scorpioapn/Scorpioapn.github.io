drop function if exists public.save_agenda_draft(text, jsonb, text);

create or replace function public.save_agenda_draft(
  draft_id text,
  payload jsonb,
  client_id text,
  expected_version bigint default null
)
returns table(version bigint, updated_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  draft_exists boolean;
begin
  return query
  update public.agenda_drafts as d
  set
    payload = $2,
    version = d.version + 1,
    updated_at = now(),
    updated_by = $3
  where d.id = $1
    and ($4 is null or d.version = $4)
  returning d.version, d.updated_at;

  if found then
    return;
  end if;

  select exists (
    select 1
    from public.agenda_drafts as d
    where d.id = $1
  ) into draft_exists;

  if draft_exists then
    raise exception 'agenda draft version conflict' using errcode = '40001';
  end if;

  raise exception 'agenda draft not found' using errcode = 'P0002';
end;
$$;

revoke all on function public.save_agenda_draft(text, jsonb, text, bigint) from public;
grant execute on function public.save_agenda_draft(text, jsonb, text, bigint) to anon, authenticated;
