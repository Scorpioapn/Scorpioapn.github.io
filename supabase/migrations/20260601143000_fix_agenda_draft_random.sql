create or replace function public.create_agenda_draft(payload jsonb)
returns table(id text, version bigint)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  draft_id text;
begin
  draft_id := rtrim(translate(encode(extensions.gen_random_bytes(18), 'base64'), '+/', '-_'), '=');

  insert into public.agenda_drafts (id, payload)
  values (draft_id, $1);

  return query
  select agenda_drafts.id, agenda_drafts.version
  from public.agenda_drafts
  where agenda_drafts.id = draft_id;
end;
$$;

revoke all on function public.create_agenda_draft(jsonb) from public;
grant execute on function public.create_agenda_draft(jsonb) to anon, authenticated;
