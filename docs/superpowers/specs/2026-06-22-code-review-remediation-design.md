# Code Review Remediation Design

## Goal

Fix all seven confirmed review findings without changing the product's no-login sharing model. Preserve the current agenda-builder and timekeeper workflows while making cloud sync conflict-safe, server writes abuse-resistant, local persistence honest, imported data structurally safe, and CSV exports inert.

## Non-goals

- No visual redesign beyond a compact conflict-action row inside the existing cloud-sync card.
- No account system or visible sign-in flow.
- No unrelated refactor of the two large HTML applications.
- No change to the random capability-link format.

## Architecture

### Public capability links behind an Edge Function

The browser will keep using the public Supabase publishable key and the existing random `draft` URL parameter. Database RPCs will no longer be executable by `anon` or `authenticated`; only `service_role` may call them. A public Supabase Edge Function named `agenda-drafts` becomes the only create/get/save gateway.

The function will:

- validate request method, action, draft ID, client ID, version, and payload;
- reject payloads larger than 4 MiB before database work;
- hash the caller IP with `AGENDA_RATE_LIMIT_SALT` and consume a database-backed rate-limit bucket;
- allow at most 10 creates per IP per hour, 120 reads per IP per minute, and 30 saves per IP-and-draft per minute;
- call the existing security-definer draft RPCs with the service-role client;
- return stable JSON error codes for validation, rate limits, missing drafts, and version conflicts;
- opportunistically purge expired rate buckets and drafts.

Drafts gain an `expires_at` column. Creation and successful saves set it to 90 days in the future. Reads ignore expired rows. Existing rows receive a 90-day expiry during migration.

Required Edge Function secrets are `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and `AGENDA_RATE_LIMIT_SALT`. `AGENDA_ALLOWED_ORIGINS` optionally restricts browser origins; when omitted, the function still relies on capability IDs and server-side rate limits rather than treating CORS as authentication.

### Cloud-sync state machine

`js/agenda-cloud-sync.js` will use an injectable transport backed by `supabase.functions.invoke("agenda-drafts")`; realtime broadcast remains on the existing random draft channel.

The controller tracks these independent facts:

- whether an existing remote draft has loaded successfully;
- the last known positive remote version;
- whether local edits exist after the last successful load/save;
- whether a conflict is awaiting user resolution.

For an existing `draft` URL, saves are forbidden until the first remote load succeeds. A save for an existing draft always includes a positive `expectedVersion`; `null` is never used to bypass optimistic concurrency.

Local edits increment a revision counter when `scheduleSave()` is called. If a newer broadcast arrives while local edits are pending, the controller keeps the local payload and reports a conflict instead of clearing the timer or applying remote state. If there are no local edits, the remote version is loaded normally.

The cloud-sync card exposes two conflict actions:

- **载入云端** discards the unsynced local cloud changes only after explicit confirmation and loads the latest remote payload.
- **本机另存为新草稿** creates a new capability draft from the current local payload, updates the URL, and leaves the original remote draft unchanged.

Version-conflict save errors enter the same conflict state. A failed initial load keeps local editing available but cloud saving disabled until the user reloads remote data or forks the local payload.

## Local application safety

### Timekeeper transitions

Selecting another agenda item is blocked whenever the current timer is running, paused, has nonzero elapsed time, or has a post-record completion action. The UI instructs the user to record, complete, or explicitly reset first.

Completing an agenda item is also blocked while unrecorded elapsed time exists. When a legitimate switch occurs, any previous `active` item is demoted to `pending` before the new item can become active, ensuring there is at most one active item.

### Durable record writes

`saveRecords()` returns the storage result. `addRecord()` rolls back the in-memory append if persistence fails. `stopTimer()` preserves the timer, elapsed value, and inputs when the record cannot be stored; it must not show a success toast or reset the stopwatch.

### Agenda payload schema

A focused browser/CommonJS module will normalize agenda data using an explicit allowlist:

- all known scalar fields must be strings;
- image fields may contain only supported data-image URLs or the repository's known asset paths;
- `items` must be an array of plain objects and is capped at 250 entries;
- agenda item fields are normalized to strings, valid kinds, and stable IDs;
- unknown fields are dropped;
- the serialized normalized payload must not exceed 4 MiB.

Strict import and cloud paths reject invalid data before mutating `state` or localStorage. Local startup uses the same normalization defensively and falls back to defaults without persisting corrupt values. Rendering never calls string methods on unchecked values.

### CSV export

Every CSV cell is converted to text and escaped in one helper. After leading whitespace, values beginning with `=`, `+`, `-`, or `@` receive an apostrophe prefix before normal CSV quoting. This prevents spreadsheet formula evaluation while preserving readable content.

## Error handling

- Edge errors use machine-readable codes and safe user-facing messages; service-role details are never returned.
- Rate-limit responses include HTTP 429 and `Retry-After`.
- Initial cloud-load failure cannot transition to a writable remote state.
- Conflicts never destroy local state automatically.
- Storage failures retain recoverable in-memory timer data.
- Invalid imports leave the previous valid state untouched.

## Testing

Implementation follows red-green-refactor for each finding.

- Cloud unit tests cover failed/pending initial loads, positive expected versions, dirty broadcasts, remote resolution, and fork resolution.
- Edge policy tests cover payload size, identifiers, action limits, stable errors, and migration contracts that revoke public RPC execution.
- Timekeeper behavior tests execute the extracted live functions to verify paused/unrecorded switches are blocked, only one active item remains, and failed record persistence preserves elapsed time.
- Agenda-data tests cover null/wrong-type fields, unknown fields, malformed items, external image URLs, item limits, and payload limits.
- CSV tests cover all four formula prefixes, leading whitespace, quotes, commas, and ordinary Unicode text.
- The existing complete `npm test` suite must remain green.

## Deployment order

1. Configure Edge Function secrets and deploy `agenda-drafts` while the current client still uses the existing RPC path.
2. Deploy the new migration, which adds expiry/rate-limit storage and revokes direct public RPC access.
3. Deploy the updated static client.

The Edge Function is dormant until the updated client ships, so deploying its code first is safe even though its new database dependencies do not exist until step 2. Steps 1 and 2 must both complete before the static client, because the hardened client intentionally has no direct-RPC fallback.
