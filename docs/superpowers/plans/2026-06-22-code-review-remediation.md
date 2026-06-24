# Code Review Remediation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix all seven confirmed code-review findings while preserving no-login capability-link sharing.

**Architecture:** Route draft persistence through a rate-limited Supabase Edge Function and make the browser sync controller explicitly track readiness, dirtiness, and conflicts. Add small UMD/CommonJS safety modules for agenda payload normalization, timekeeper transitions, and CSV output so the live HTML applications and Node tests execute the same logic.

**Tech Stack:** Static HTML/CSS/JavaScript, Node.js built-in test runner, Supabase Postgres migrations, Supabase Edge Functions on Deno.

---

### Task 1: Strict agenda payload normalization

**Files:**
- Create: `js/agenda-data.js`
- Create: `tests/agenda_data.test.mjs`
- Modify: `agenda_generator.html:3810-3873, 4804-4813, 5537-5568`

- [ ] **Step 1: Write the failing agenda-data tests**

```js
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { test } from "node:test";

const require = createRequire(import.meta.url);
const AgendaData = require("../js/agenda-data.js");

const defaults = {
  clubName: "畅言中文国际演讲会",
  theme: "主题",
  logoData: "",
  wechatQrData: "",
  joinQrData: "",
  items: [{ id: "item-1", kind: "item", title: "主持", duration: "3", time: "19:30", person: "", detail: "" }]
};

test("strict agenda normalization rejects wrong scalar types before persistence", () => {
  assert.throws(
    () => AgendaData.normalizeAgendaData({ ...defaults, clubName: null }, defaults),
    /clubName must be a string/
  );
});

test("agenda normalization drops unknown fields and normalizes item shape", () => {
  const result = AgendaData.normalizeAgendaData({
    ...defaults,
    unknown: "drop-me",
    items: [{ id: 7, kind: "wrong", title: "主持", injected: true }]
  }, defaults);
  assert.equal(Object.hasOwn(result, "unknown"), false);
  assert.deepEqual(result.items[0], {
    id: "7",
    kind: "item",
    time: "",
    title: "主持",
    detail: "",
    duration: "",
    person: ""
  });
});

test("agenda normalization rejects external image URLs and excessive payloads", () => {
  assert.throws(
    () => AgendaData.normalizeAgendaData({ ...defaults, logoData: "https://tracker.test/pixel" }, defaults),
    /logoData contains an unsupported image source/
  );
  assert.throws(
    () => AgendaData.assertPayloadSize({ value: "x".repeat(AgendaData.MAX_PAYLOAD_BYTES) }),
    /payload exceeds 4 MiB/
  );
});

test("tolerant startup falls back to defaults instead of preserving corrupt values", () => {
  const result = AgendaData.normalizeAgendaData({ ...defaults, clubName: null }, defaults, { strict: false });
  assert.equal(result.clubName, defaults.clubName);
});
```

- [ ] **Step 2: Run the new test and verify RED**

Run: `node --test tests/agenda_data.test.mjs`

Expected: FAIL because `js/agenda-data.js` does not exist.

- [ ] **Step 3: Implement the agenda-data module**

Create a UMD/CommonJS module with these public members and behavior:

```js
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.TMAgendaData = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function () {
  const MAX_PAYLOAD_BYTES = 4 * 1024 * 1024;
  const MAX_ITEMS = 250;
  const IMAGE_FIELDS = new Set(["logoData", "wechatQrData", "joinQrData"]);
  const ITEM_FIELDS = ["id", "time", "title", "detail", "duration", "durationNote", "person"];

  function byteLength(value) {
    const text = JSON.stringify(value);
    return typeof TextEncoder === "function" ? new TextEncoder().encode(text).length : Buffer.byteLength(text, "utf8");
  }

  function assertPayloadSize(value) {
    if (byteLength(value) > MAX_PAYLOAD_BYTES) throw new Error("agenda payload exceeds 4 MiB");
    return value;
  }

  function validImageSource(value) {
    return value === "" || /^data:image\/(?:png|jpeg|webp|gif);base64,/i.test(value) || /^assets\/[A-Za-z0-9._/-]+$/.test(value);
  }

  function normalizeItem(item, index, strict) {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      if (strict) throw new Error(`items[${index}] must be an object`);
      return null;
    }
    const normalized = { id: String(item.id || `item-${index + 1}`), kind: item.kind === "section" ? "section" : "item" };
    ITEM_FIELDS.slice(1).forEach((field) => {
      if (item[field] !== undefined && typeof item[field] !== "string" && strict) {
        throw new Error(`items[${index}].${field} must be a string`);
      }
      if (field !== "durationNote" || typeof item[field] === "string" && item[field].trim()) {
        normalized[field] = typeof item[field] === "string" ? item[field] : "";
      }
    });
    if (normalized.kind === "section") {
      return { id: normalized.id, kind: "section", title: normalized.title };
    }
    return normalized;
  }

  function normalizeAgendaData(source, defaults, options = {}) {
    const strict = options.strict !== false;
    if (!source || typeof source !== "object" || Array.isArray(source)) throw new Error("agenda payload must be an object");
    const normalized = {};
    Object.entries(defaults || {}).forEach(([field, fallback]) => {
      if (field === "items") return;
      const value = source[field];
      if (typeof fallback === "string") {
        if (value !== undefined && typeof value !== "string" && strict) throw new Error(`${field} must be a string`);
        normalized[field] = typeof value === "string" ? value : fallback;
        if (IMAGE_FIELDS.has(field) && !validImageSource(normalized[field])) {
          if (strict) throw new Error(`${field} contains an unsupported image source`);
          normalized[field] = fallback;
        }
      }
    });
    const rawItems = Array.isArray(source.items) ? source.items : defaults.items || [];
    if (!Array.isArray(source.items) && source.items !== undefined && strict) throw new Error("items must be an array");
    if (rawItems.length > MAX_ITEMS) throw new Error(`items exceeds ${MAX_ITEMS} entries`);
    normalized.items = rawItems.map((item, index) => normalizeItem(item, index, strict)).filter(Boolean);
    if (!normalized.items.length) normalized.items = (defaults.items || []).map((item, index) => normalizeItem(item, index, false));
    return assertPayloadSize(normalized);
  }

  return { MAX_PAYLOAD_BYTES, MAX_ITEMS, assertPayloadSize, normalizeAgendaData };
});
```

Load `js/agenda-data.js` before the inline agenda script. Replace import/cloud normalization with strict `TMAgendaData.normalizeAgendaData(parsed, DEFAULT_DATA)`. Replace local startup merging with `{ strict: false }`. Assign `state` only after normalization succeeds, and call `saveData()` only after the new state renders successfully.

- [ ] **Step 4: Run agenda-data and existing agenda tests**

Run: `node --test tests/agenda_data.test.mjs tests/agenda_generator_sidebar.test.mjs tests/code_health.test.mjs`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add js/agenda-data.js agenda_generator.html tests/agenda_data.test.mjs
git commit -m "fix: validate agenda payloads"
```

### Task 2: Conflict-safe cloud-sync controller

**Files:**
- Modify: `js/agenda-cloud-sync.js`
- Modify: `tests/agenda_cloud_sync.test.mjs`

- [ ] **Step 1: Add failing cloud-state tests**

Add tests using the existing fake controller harness:

```js
test("existing drafts cannot save before the first remote load succeeds", async () => {
  let saveCalls = 0;
  const { controller } = createController({
    rpcHandler(name) {
      if (name === "get_agenda_draft") return Promise.resolve({ data: null, error: new Error("load failed") });
      saveCalls += 1;
      return Promise.resolve({ data: { version: 2 }, error: null });
    }
  });
  await assert.rejects(() => controller.init(), /load failed/);
  await assert.rejects(() => controller.saveNow(), /remote draft is not ready/);
  assert.equal(saveCalls, 0);
});

test("dirty local edits survive a newer broadcast", async () => {
  const conflicts = [];
  const { controller, fake, applied, activeTimerCount } = createController({ onConflict: (value) => conflicts.push(value) });
  await controller.init();
  controller.scheduleSave();
  await fake.broadcastHandler({ payload: { version: 2, updated_by: "other-client" } });
  assert.equal(activeTimerCount(), 1);
  assert.equal(applied.length, 1);
  assert.equal(conflicts.length, 1);
});

test("forking a conflict creates a new draft from local payload", async () => {
  const { controller } = createController({ payload: { meetingNo: "local-copy" } });
  await controller.init();
  controller.scheduleSave();
  await controller.handleBroadcast({ version: 2, updated_by: "other-client" });
  const result = await controller.forkDraft();
  assert.notEqual(result.id, "draft_12345678901234567890");
  assert.equal(controller.hasConflict(), false);
});
```

- [ ] **Step 2: Run the cloud tests and verify RED**

Run: `node --test tests/agenda_cloud_sync.test.mjs`

Expected: the initial-load test observes a save call, the dirty-broadcast test observes the debounce being cleared, and `forkDraft` is undefined.

- [ ] **Step 3: Implement readiness, dirty state, and conflict resolution**

In `createAgendaCloudSync`, add:

```js
let remoteReady = !draftId;
let dirty = false;
let conflict = null;

function enterConflict(remoteVersion, reason = "version-conflict") {
  conflict = { remoteVersion: Number(remoteVersion || 0), reason };
  applyStatus(SYNC_STATUS.error, "version-conflict");
  options.onConflict?.({ ...conflict });
  return { conflict: true };
}
```

`scheduleSave()` must set `dirty = true`. `loadRemoteDraft()` sets `remoteReady = true`, `dirty = false`, and `conflict = null` only after the payload applies. `saveNow()` throws `new Error("remote draft is not ready")` when an existing draft lacks a positive loaded version, and always sends that positive version. `handleBroadcast()` calls `enterConflict()` without clearing the save timer whenever `dirty` is true. Add `loadRemoteLatest()` for explicit remote resolution and `forkDraft()` that creates a new draft from the current payload, switches channel/URL to its ID, and clears dirty/conflict state.

Expose:

```js
loadRemoteLatest,
forkDraft,
hasConflict: () => Boolean(conflict),
isRemoteReady: () => remoteReady,
isDirty: () => dirty
```

- [ ] **Step 4: Run cloud tests and verify GREEN**

Run: `node --test tests/agenda_cloud_sync.test.mjs`

Expected: PASS, including replacing the old “remote last-write-wins cancels debounce” expectation with conflict preservation.

- [ ] **Step 5: Commit**

```bash
git add js/agenda-cloud-sync.js tests/agenda_cloud_sync.test.mjs
git commit -m "fix: preserve cloud edits across conflicts"
```

### Task 3: Edge Function gateway and database hardening

**Files:**
- Create: `supabase/functions/_shared/agenda-policy.mjs`
- Create: `supabase/functions/agenda-drafts/index.ts`
- Create: `supabase/migrations/20260622000000_harden_agenda_drafts.sql`
- Create: `tests/agenda_edge_policy.test.mjs`
- Modify: `js/agenda-cloud-sync.js`
- Modify: `tests/agenda_cloud_sync.test.mjs`

- [ ] **Step 1: Write failing policy and migration contract tests**

```js
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { validateAgendaRequest, limitForAction } from "../supabase/functions/_shared/agenda-policy.mjs";

test("edge policy enforces action-specific limits", () => {
  assert.deepEqual(limitForAction("create"), { limit: 10, windowSeconds: 3600 });
  assert.deepEqual(limitForAction("get"), { limit: 120, windowSeconds: 60 });
  assert.deepEqual(limitForAction("save"), { limit: 30, windowSeconds: 60 });
});

test("edge policy requires a positive version for saves", () => {
  assert.throws(
    () => validateAgendaRequest({ action: "save", draftId: "a".repeat(24), clientId: "client-a", expectedVersion: null, payload: {} }),
    /expectedVersion must be positive/
  );
});

test("hardening migration revokes public draft RPC access", () => {
  const sql = readFileSync(new URL("../supabase/migrations/20260622000000_harden_agenda_drafts.sql", import.meta.url), "utf8");
  assert.match(sql, /revoke all on function public\.create_agenda_draft\(jsonb\) from anon, authenticated/i);
  assert.match(sql, /grant execute on function public\.create_agenda_draft\(jsonb\) to service_role/i);
  assert.match(sql, /expires_at timestamptz/i);
  assert.match(sql, /consume_agenda_draft_rate_limit/i);
});
```

- [ ] **Step 2: Run the policy test and verify RED**

Run: `node --test tests/agenda_edge_policy.test.mjs`

Expected: FAIL because the policy module and migration do not exist.

- [ ] **Step 3: Implement the pure Edge policy module**

Export `MAX_PAYLOAD_BYTES`, `PolicyError`, `limitForAction`, and `validateAgendaRequest`. Validate the action enum, capability ID regex `^[A-Za-z0-9_-]{20,80}$`, client ID length, positive integer expected version for saves, and 4 MiB serialized payload size for create/save. Return a normalized object with camelCase fields.

- [ ] **Step 4: Implement the hardening migration**

The migration must:

```sql
alter table public.agenda_drafts
  add column if not exists expires_at timestamptz not null default (now() + interval '90 days');

alter table public.agenda_drafts
  add constraint agenda_drafts_payload_size
  check (pg_column_size(payload) <= 4194304) not valid;

create table if not exists public.agenda_draft_rate_limits (
  bucket_key text not null,
  action text not null,
  window_started_at timestamptz not null,
  request_count integer not null,
  primary key (bucket_key, action)
);

revoke all on table public.agenda_draft_rate_limits from anon, authenticated;

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
  if p_limit < 1 or p_window_seconds < 1 then
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
```

Replace create/get/save functions so create/save set `expires_at = now() + interval '90 days'`, get includes `d.expires_at > now()`, and save requires `expected_version is not null and expected_version > 0` plus `d.version = expected_version`. Preserve the existing `40001` version-conflict and `P0002` missing-draft codes. End the migration with:

```sql
revoke all on function public.create_agenda_draft(jsonb) from public, anon, authenticated;
revoke all on function public.get_agenda_draft(text) from public, anon, authenticated;
revoke all on function public.save_agenda_draft(text, jsonb, text, bigint) from public, anon, authenticated;
revoke all on function public.consume_agenda_draft_rate_limit(text, text, integer, integer) from public, anon, authenticated;

grant execute on function public.create_agenda_draft(jsonb) to service_role;
grant execute on function public.get_agenda_draft(text) to service_role;
grant execute on function public.save_agenda_draft(text, jsonb, text, bigint) to service_role;
grant execute on function public.consume_agenda_draft_rate_limit(text, text, integer, integer) to service_role;
```

- [ ] **Step 5: Implement the Edge Function**

`supabase/functions/agenda-drafts/index.ts` must:

```ts
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { PolicyError, limitForAction, validateAgendaRequest } from "../_shared/agenda-policy.mjs";

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return jsonResponse(request, null, 204);
  if (request.method !== "POST") return jsonError(request, "method_not_allowed", 405);
  try {
    const body = validateAgendaRequest(await request.json());
    const ipHash = await hashIp(request.headers.get("x-forwarded-for") || "unknown");
    const bucket = body.action === "save" ? `${ipHash}:${body.draftId}` : ipHash;
    const { limit, windowSeconds } = limitForAction(body.action);
    const allowed = await consumeRateLimit(bucket, body.action, limit, windowSeconds);
    if (!allowed) return jsonError(request, "rate_limited", 429, { "Retry-After": String(windowSeconds) });
    if (body.action === "create") return jsonOk(request, await createDraft(body.payload));
    if (body.action === "get") return jsonOk(request, await getDraft(body.draftId));
    return jsonOk(request, await saveDraft(body));
  } catch (error) {
    return mapSafeError(request, error);
  }
});
```

Define `corsResponse`, `jsonOk`, `jsonError`, `hashIp`, `consumeRateLimit`, `createDraft`, `getDraft`, `saveDraft`, and `mapSafeError` in the same file. Construct a service-role Supabase client from environment variables. Never return raw database error messages.

Use these exact helper contracts:

```ts
const supabase = createClient(
  Deno.env.get("SUPABASE_URL") || "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "",
  { auth: { persistSession: false } }
);

const allowedOrigins = new Set(
  String(Deno.env.get("AGENDA_ALLOWED_ORIGINS") || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean)
);

function corsHeaders(request: Request) {
  const origin = request.headers.get("origin") || "";
  const allowedOrigin = !allowedOrigins.size ? "*" : allowedOrigins.has(origin) ? origin : "null";
  return {
    "access-control-allow-origin": allowedOrigin,
    "access-control-allow-headers": "authorization, apikey, content-type",
    "access-control-allow-methods": "POST, OPTIONS",
    "vary": "origin"
  };
}

function jsonResponse(request: Request, body: unknown, status = 200, extraHeaders: Record<string, string> = {}) {
  return new Response(body === null ? null : JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", ...corsHeaders(request), ...extraHeaders }
  });
}

function jsonOk(request: Request, data: unknown) {
  return jsonResponse(request, { data });
}

function jsonError(request: Request, code: string, status: number, extraHeaders: Record<string, string> = {}) {
  return jsonResponse(request, { error: { code, message: code } }, status, extraHeaders);
}

async function hashIp(ip: string) {
  const salt = Deno.env.get("AGENDA_RATE_LIMIT_SALT") || "";
  const bytes = new TextEncoder().encode(`${salt}:${ip.split(",")[0].trim()}`);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function consumeRateLimit(bucket: string, action: string, limit: number, windowSeconds: number) {
  const { data, error } = await supabase.rpc("consume_agenda_draft_rate_limit", {
    p_bucket_key: bucket,
    p_action: action,
    p_limit: limit,
    p_window_seconds: windowSeconds
  });
  if (error) throw new PolicyError("rate_limit_unavailable", 503);
  return data === true;
}

async function createDraft(payload: unknown) {
  const { data, error } = await supabase.rpc("create_agenda_draft", { payload });
  if (error) throw error;
  return Array.isArray(data) ? data[0] : data;
}

async function getDraft(draftId: string) {
  const { data, error } = await supabase.rpc("get_agenda_draft", { draft_id: draftId });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) throw new PolicyError("draft_not_found", 404);
  return row;
}

async function saveDraft(body: ReturnType<typeof validateAgendaRequest>) {
  const { data, error } = await supabase.rpc("save_agenda_draft", {
    draft_id: body.draftId,
    payload: body.payload,
    client_id: body.clientId,
    expected_version: body.expectedVersion
  });
  if (error) throw error;
  return Array.isArray(data) ? data[0] : data;
}

function mapSafeError(request: Request, error: unknown) {
  if (error instanceof PolicyError) return jsonError(request, error.code, error.status);
  const code = String((error as { code?: string })?.code || "");
  if (code === "40001") return jsonError(request, "version_conflict", 409);
  if (code === "P0002") return jsonError(request, "draft_not_found", 404);
  console.error("agenda-drafts failed", code);
  return jsonError(request, "internal_error", 500);
}
```

- [ ] **Step 6: Switch the browser controller to the Edge transport**

Replace direct RPC calls with:

```js
async function requestDraft(action, body = {}) {
  if (options.transport) return options.transport(action, body);
  const client = resolveSupabaseClient();
  const { data, error } = await client.functions.invoke("agenda-drafts", { body: { action, ...body } });
  if (error) throw error;
  if (data?.error) {
    const requestError = new Error(data.error.message || data.error.code);
    requestError.code = data.error.code;
    throw requestError;
  }
  return data?.data || data;
}
```

Map create/get/save controller operations to `requestDraft`. Update the test fake to inject `transport` rather than asserting direct RPC calls.

- [ ] **Step 7: Run policy and cloud tests**

Run: `node --test tests/agenda_edge_policy.test.mjs tests/agenda_cloud_sync.test.mjs`

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add supabase/functions supabase/migrations/20260622000000_harden_agenda_drafts.sql js/agenda-cloud-sync.js tests/agenda_edge_policy.test.mjs tests/agenda_cloud_sync.test.mjs
git commit -m "fix: harden anonymous draft persistence"
```

### Task 4: Cloud conflict actions in the existing UI

**Files:**
- Modify: `agenda_generator.html:3470-3487, 3682-3727, 4778-4875, 5673-5807`
- Modify: `tests/agenda_generator_sidebar.test.mjs`

- [ ] **Step 1: Add failing UI contract tests**

```js
test("cloud sync exposes explicit conflict recovery actions", () => {
  assert.match(html, /id="cloudSyncConflictActions"/);
  assert.match(html, /id="loadRemoteDraftBtn"/);
  assert.match(html, /id="forkLocalDraftBtn"/);
  assert.match(html, /cloudSyncController\.loadRemoteLatest\(\)/);
  assert.match(html, /cloudSyncController\.forkDraft\(\)/);
});
```

- [ ] **Step 2: Run the UI test and verify RED**

Run: `node --test tests/agenda_generator_sidebar.test.mjs`

Expected: FAIL because the conflict action elements do not exist.

- [ ] **Step 3: Add and bind the compact conflict row**

Inside the cloud card add a hidden row containing `载入云端` and `本机另存为新草稿`. Add element references and:

```js
function renderCloudConflictActions(visible) {
  els.cloudSyncConflictActions.hidden = !visible;
}

async function loadRemoteConflictVersion() {
  if (!window.confirm("载入云端版本？尚未同步的本机修改将被替换。")) return;
  await cloudSyncController.loadRemoteLatest();
  renderCloudConflictActions(false);
}

async function forkLocalConflictVersion() {
  await cloudSyncController.forkDraft();
  renderCloudConflictActions(false);
  showToast("本机内容已另存为新的同步草稿");
}
```

Pass `onConflict: () => renderCloudConflictActions(true)` to the controller. Keep the row visible after recoverable errors and hide it only after a successful resolution.

- [ ] **Step 4: Run cloud/UI tests**

Run: `node --test tests/agenda_generator_sidebar.test.mjs tests/agenda_cloud_sync.test.mjs`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add agenda_generator.html tests/agenda_generator_sidebar.test.mjs
git commit -m "fix: add cloud conflict recovery controls"
```

### Task 5: Safe timekeeper transitions and durable record writes

**Files:**
- Create: `js/timekeeper-state.js`
- Create: `tests/timekeeper_state.test.mjs`
- Modify: `index.html:2761-2764, 2966-2972, 3467-3556, 3490-3535`

- [ ] **Step 1: Write failing pure behavior tests**

```js
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { test } from "node:test";

const require = createRequire(import.meta.url);
const TimekeeperState = require("../js/timekeeper-state.js");

test("paused or recorded-pending timer state cannot be abandoned", () => {
  assert.equal(TimekeeperState.canLeaveAgenda({ running: true, paused: true, elapsed: 42 }, null), false);
  assert.equal(TimekeeperState.canLeaveAgenda({ running: false, paused: false, elapsed: 0 }, "finish-agenda"), false);
  assert.equal(TimekeeperState.canLeaveAgenda({ running: false, paused: false, elapsed: 0 }, null), true);
});

test("activating one item demotes every other active item", () => {
  const items = [{ id: "a", status: "active" }, { id: "b", status: "pending" }];
  TimekeeperState.activateOnly(items, "b");
  assert.deepEqual(items.map(({ status }) => status), ["pending", "active"]);
});

test("failed record persistence rolls back the append", () => {
  const records = [];
  const result = TimekeeperState.appendPersistedRecord(records, { id: "r1" }, () => false);
  assert.equal(result, false);
  assert.deepEqual(records, []);
});
```

- [ ] **Step 2: Run the state test and verify RED**

Run: `node --test tests/timekeeper_state.test.mjs`

Expected: FAIL because `js/timekeeper-state.js` does not exist.

- [ ] **Step 3: Implement the state module**

```js
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.TMTimekeeperState = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function () {
  function canLeaveAgenda(timer, postRecordAction) {
    return !timer?.running && !timer?.paused && Number(timer?.elapsed || 0) === 0 && !postRecordAction;
  }
  function activateOnly(items, itemId) {
    (Array.isArray(items) ? items : []).forEach((item) => {
      if (item.id === itemId) item.status = "active";
      else if (item.status === "active") item.status = "pending";
    });
  }
  function appendPersistedRecord(records, record, persist) {
    records.push(record);
    let saved = false;
    try { saved = persist() !== false; } catch { saved = false; }
    if (!saved) records.splice(records.lastIndexOf(record), 1);
    return saved;
  }
  return { canLeaveAgenda, activateOnly, appendPersistedRecord };
});
```

- [ ] **Step 4: Integrate the state module into the live timekeeper**

Load `js/timekeeper-state.js`. Return the boolean from `saveRecords()`. In `addRecord()`, call `appendPersistedRecord`; return `null` on failure. In `stopTimer()`, return immediately without resetting when elapsed is positive and no record was persisted.

At the start of `selectAgenda()` and `finishCurrentAgenda()`, reject transitions when `canLeaveAgenda(state.timer, state.postRecordAction)` is false and show `请先结束并记录，或明确重置当前计时`. In `startTimer()`, call `activateOnly(state.agendaItems, item.id)` before saving.

- [ ] **Step 5: Run timekeeper tests**

Run: `node --test tests/timekeeper_state.test.mjs tests/timekeeper_mobile_layout.test.mjs tests/code_health.test.mjs`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add js/timekeeper-state.js index.html tests/timekeeper_state.test.mjs
git commit -m "fix: protect live timer state"
```

### Task 6: Formula-safe CSV export

**Files:**
- Create: `js/export-safety.js`
- Create: `tests/export_safety.test.mjs`
- Modify: `index.html:2761-2764, 3641-3667`

- [ ] **Step 1: Write failing CSV tests**

```js
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { test } from "node:test";

const require = createRequire(import.meta.url);
const ExportSafety = require("../js/export-safety.js");

test("CSV cells neutralize spreadsheet formulas after leading whitespace", () => {
  for (const value of ["=1+1", "+SUM(A1:A2)", "-2+3", "@cmd", "  =HYPERLINK(\"https://x\")"]) {
    assert.match(ExportSafety.escapeCsvCell(value), /^"\s*'/);
  }
});

test("CSV cells preserve ordinary Unicode and double embedded quotes", () => {
  assert.equal(ExportSafety.escapeCsvCell("畅言,\"主持\""), "\"畅言,\"\"主持\"\"\"");
});
```

- [ ] **Step 2: Run the CSV test and verify RED**

Run: `node --test tests/export_safety.test.mjs`

Expected: FAIL because `js/export-safety.js` does not exist.

- [ ] **Step 3: Implement and integrate safe CSV escaping**

```js
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.TMExportSafety = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function () {
  function neutralizeFormula(value) {
    const text = String(value ?? "");
    return /^\s*[=+\-@]/.test(text) ? text.replace(/^(\s*)/, "$1'") : text;
  }
  function escapeCsvCell(value) {
    return `"${neutralizeFormula(value).replaceAll('"', '""')}"`;
  }
  return { neutralizeFormula, escapeCsvCell };
});
```

Load this module in `index.html` and replace the inline cell quoting expression with `window.TMExportSafety.escapeCsvCell(cell)`.

- [ ] **Step 4: Run export and timekeeper tests**

Run: `node --test tests/export_safety.test.mjs tests/timekeeper_mobile_layout.test.mjs tests/code_health.test.mjs`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add js/export-safety.js index.html tests/export_safety.test.mjs
git commit -m "fix: neutralize CSV formulas"
```

### Task 7: Full regression and deployment documentation

**Files:**
- Create: `supabase/functions/agenda-drafts/README.md`
- Modify: `tests/code_health.test.mjs`

- [ ] **Step 1: Add a failing repository contract test**

```js
test("hardened client modules and Edge deployment guide are tracked", () => {
  for (const path of [
    "js/agenda-data.js",
    "js/timekeeper-state.js",
    "js/export-safety.js",
    "supabase/functions/agenda-drafts/index.ts",
    "supabase/functions/agenda-drafts/README.md"
  ]) assert.equal(existsSync(new URL(`../${path}`, import.meta.url)), true, `${path} should exist`);
});
```

- [ ] **Step 2: Run code-health test and verify RED**

Run: `node --test tests/code_health.test.mjs`

Expected: FAIL because the Edge deployment guide does not exist.

- [ ] **Step 3: Write the deployment guide**

Document exact commands and environment variables:

```powershell
supabase secrets set SUPABASE_URL="$env:SUPABASE_URL" SUPABASE_SERVICE_ROLE_KEY="$env:SUPABASE_SERVICE_ROLE_KEY" AGENDA_RATE_LIMIT_SALT="$env:AGENDA_RATE_LIMIT_SALT" AGENDA_ALLOWED_ORIGINS="$env:AGENDA_ALLOWED_ORIGINS"
supabase functions deploy agenda-drafts --no-verify-jwt
supabase db push
npm test
```

Explain the required order: function code and secrets, migration, static client. State that `--no-verify-jwt` preserves no-login access and that the function itself enforces rate, size, capability, and version checks.

- [ ] **Step 4: Run the complete suite**

Run: `npm test`

Expected: all tests pass with zero failures.

- [ ] **Step 5: Inspect final scope**

Run: `git status --short && git diff --check && git diff origin/main...HEAD --stat`

Expected: only planned application, test, migration, function, and documentation files appear; `git diff --check` prints nothing.

- [ ] **Step 6: Commit**

```bash
git add supabase/functions/agenda-drafts/README.md tests/code_health.test.mjs
git commit -m "docs: document hardened sync deployment"
```

- [ ] **Step 7: Run final verification from committed HEAD**

Run: `npm test && git status --short`

Expected: all tests pass and the working tree is clean.
