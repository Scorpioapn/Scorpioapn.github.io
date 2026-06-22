# Agenda draft sync deployment

This Edge Function is the only public write path for anonymous agenda sharing. Keep `SUPABASE_SERVICE_ROLE_KEY` in Supabase secrets only; never place it in the static site.

## Required environment variables

- `SUPABASE_URL`: Supabase project URL.
- `SUPABASE_SERVICE_ROLE_KEY`: server-side key used by the function to call protected RPCs.
- `AGENDA_RATE_LIMIT_SALT`: long random secret used when hashing client IP buckets.
- `AGENDA_ALLOWED_ORIGINS`: comma-separated production origins, for example `https://agenda.example.com,https://www.example.com`.

## Deploy

Run these commands from the repository root in PowerShell:

```powershell
supabase secrets set SUPABASE_URL="$env:SUPABASE_URL" SUPABASE_SERVICE_ROLE_KEY="$env:SUPABASE_SERVICE_ROLE_KEY" AGENDA_RATE_LIMIT_SALT="$env:AGENDA_RATE_LIMIT_SALT" AGENDA_ALLOWED_ORIGINS="$env:AGENDA_ALLOWED_ORIGINS"
supabase functions deploy agenda-drafts --no-verify-jwt
supabase db push
npm test
```

Deploy in this order: function code and secrets, database migration, then the updated static client. Publish the client immediately after `supabase db push`, because the migration removes direct anonymous RPC access.

`--no-verify-jwt` intentionally preserves the no-login capability-link experience. The function remains responsible for origin handling, request rate limits, the 4 MiB payload limit, capability-ID validation, draft expiry, and optimistic version checks.

After deployment, verify that creating a share link, opening it in a signed-out browser, saving, conflict recovery, and local-only use all work as expected.
