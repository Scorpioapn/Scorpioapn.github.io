# Agenda draft sync deployment

This Edge Function is the only public write path for anonymous agenda sharing. Keep `SUPABASE_SERVICE_ROLE_KEY` in Supabase secrets only; never place it in the static site.

## Two deployment targets

GitHub Pages and Supabase are separate production systems:

- GitHub Pages publishes `agenda_generator.html`, `index.html`, and static `js/**` assets.
- Supabase deploys database migrations, Edge Functions, and function runtime secrets.

Pushing to GitHub does not deploy Supabase unless the GitHub Actions workflow succeeds.

## Automatic deployment

`.github/workflows/deploy-supabase.yml` runs on every push to `main` and on manual dispatch. It:

1. Runs `npm test`.
2. Links the Supabase project.
3. Dry-runs pending database migrations.
4. Deploys the `agenda-drafts` Edge Function with `--no-verify-jwt`.
5. Pushes database migrations.
6. Runs `npm run smoke:supabase` against the live project.

Required GitHub repository secrets:

- `SUPABASE_ACCESS_TOKEN`: Supabase personal access token for CLI deployment.

The workflow uses project ref `nixguazietjzvcztbueh` and production origin `https://scorpioapn.github.io`.

## Function runtime secrets

Verify these in Supabase Dashboard or with `supabase secrets list --project-ref nixguazietjzvcztbueh`:

- `SUPABASE_URL`: Supabase-provided project URL.
- `SUPABASE_SERVICE_ROLE_KEY`: Supabase-provided server-side key used by the function to call protected RPCs.
- `AGENDA_RATE_LIMIT_SALT`: long random app secret used when hashing client IP buckets.
- `AGENDA_ALLOWED_ORIGINS`: comma-separated production origins, currently `https://scorpioapn.github.io`.

Set only the app-owned secrets manually when needed:

```powershell
$bytes = New-Object byte[] 32
$rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
$rng.GetBytes($bytes)
$env:AGENDA_RATE_LIMIT_SALT = [Convert]::ToBase64String($bytes)
$env:AGENDA_ALLOWED_ORIGINS = "https://scorpioapn.github.io"

supabase secrets set `
  AGENDA_RATE_LIMIT_SALT="$env:AGENDA_RATE_LIMIT_SALT" `
  AGENDA_ALLOWED_ORIGINS="$env:AGENDA_ALLOWED_ORIGINS" `
  --project-ref nixguazietjzvcztbueh
```

## Manual fallback

Run these commands from the repository root only if GitHub Actions is unavailable:

```powershell
npm test
supabase link --project-ref nixguazietjzvcztbueh --yes
supabase db push --linked --dry-run --yes
supabase functions deploy agenda-drafts --project-ref nixguazietjzvcztbueh --no-verify-jwt
supabase db push --linked --yes
npm run smoke:supabase
```

Deploy in this order: function code and secrets, database migration, then the updated static client. Publish the client immediately after `supabase db push`, because the migration removes direct anonymous RPC access.

`--no-verify-jwt` intentionally preserves the no-login capability-link experience. The function remains responsible for origin handling, request rate limits, the 4 MiB payload limit, capability-ID validation, draft expiry, and optimistic version checks.

## Smoke test

`npm run smoke:supabase` verifies the production path that failed previously:

- Browser CORS preflight returns `204`.
- `access-control-allow-headers` includes `x-client-info`.
- `create` returns a draft id and version `1`.
- `get` reads the created draft.
- `save` advances the version to `2`.

After deployment, also verify in the browser that creating a share link, opening it in a signed-out browser, saving, conflict recovery, and local-only use all work as expected.
