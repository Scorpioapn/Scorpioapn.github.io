import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const DEFAULT_ORIGIN = "https://scorpioapn.github.io";
const FUNCTION_NAME = "agenda-drafts";
const PREFLIGHT_HEADERS = "authorization,apikey,content-type,x-client-info";

function loadStaticSupabaseConfig() {
  const source = readFileSync(new URL("../js/supabase-config.js", import.meta.url), "utf8");
  const sandbox = {};
  sandbox.globalThis = sandbox;
  sandbox.window = sandbox;
  vm.runInNewContext(source, sandbox, { filename: "js/supabase-config.js" });
  return sandbox.TMAgendaSupabaseConfig || {};
}

function firstOrigin(value) {
  return String(value || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean)[0];
}

function resolveConfig() {
  const staticConfig = loadStaticSupabaseConfig();
  const url = process.env.AGENDA_SUPABASE_URL
    || process.env.SUPABASE_URL
    || staticConfig.url;
  const publishableKey = process.env.AGENDA_SUPABASE_PUBLISHABLE_KEY
    || process.env.SUPABASE_PUBLISHABLE_KEY
    || process.env.SUPABASE_ANON_KEY
    || staticConfig.publishableKey
    || staticConfig.anonKey
    || staticConfig.key;
  const origin = process.env.AGENDA_ALLOWED_ORIGIN
    || firstOrigin(process.env.AGENDA_ALLOWED_ORIGINS)
    || DEFAULT_ORIGIN;

  if (!url) throw new Error("Missing Supabase URL. Set AGENDA_SUPABASE_URL or js/supabase-config.js.");
  if (!publishableKey) throw new Error("Missing Supabase publishable key. Set AGENDA_SUPABASE_PUBLISHABLE_KEY or js/supabase-config.js.");

  return {
    origin,
    publishableKey,
    functionUrl: `${url.replace(/\/+$/, "")}/functions/v1/${FUNCTION_NAME}`
  };
}

function assertHeaderContains(headers, headerName, expectedValue) {
  const actual = headers.get(headerName) || "";
  assert.match(
    actual.toLowerCase(),
    new RegExp(`(^|[,\\s])${expectedValue.toLowerCase()}([,\\s]|$)`),
    `${headerName} should include ${expectedValue}; actual: ${actual || "<empty>"}`
  );
}

async function assertOkJson(response, label) {
  const text = await response.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    throw new Error(`${label} returned non-JSON response: ${text.slice(0, 240)}`);
  }
  if (!response.ok) {
    throw new Error(`${label} failed with ${response.status}: ${JSON.stringify(json)}`);
  }
  if (json?.error) {
    throw new Error(`${label} returned Edge error: ${JSON.stringify(json.error)}`);
  }
  return json;
}

async function readJsonResponse(response, label) {
  const text = await response.text();
  try {
    return text ? JSON.parse(text) : null;
  } catch {
    throw new Error(`${label} returned non-JSON response: ${text.slice(0, 240)}`);
  }
}

async function invokeAgendaDraft(config, body) {
  const response = await fetch(config.functionUrl, {
    method: "POST",
    headers: {
      "apikey": config.publishableKey,
      "authorization": `Bearer ${config.publishableKey}`,
      "content-type": "application/json",
      "origin": config.origin,
      "x-client-info": "agenda-smoke-test/1.0"
    },
    body: JSON.stringify(body)
  });
  return assertOkJson(response, body.action);
}

async function invokeAgendaDraftRaw(config, body, timeoutMs = 8000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const startedAt = Date.now();
  try {
    const response = await fetch(config.functionUrl, {
      method: "POST",
      headers: {
        "apikey": config.publishableKey,
        "authorization": `Bearer ${config.publishableKey}`,
        "content-type": "application/json",
        "origin": config.origin,
        "x-client-info": "agenda-smoke-test/1.0"
      },
      signal: controller.signal,
      body: JSON.stringify(body)
    });
    return {
      response,
      json: await readJsonResponse(response, body.action),
      elapsedMs: Date.now() - startedAt
    };
  } finally {
    clearTimeout(timer);
  }
}

async function verifyPreflight(config) {
  const response = await fetch(config.functionUrl, {
    method: "OPTIONS",
    headers: {
      "origin": config.origin,
      "access-control-request-method": "POST",
      "access-control-request-headers": PREFLIGHT_HEADERS
    }
  });
  assert.equal(response.status, 204, `preflight should return 204, got ${response.status}`);

  const allowOrigin = response.headers.get("access-control-allow-origin") || "";
  assert.ok(
    allowOrigin === config.origin || allowOrigin === "*",
    `access-control-allow-origin should allow ${config.origin}; actual: ${allowOrigin || "<empty>"}`
  );
  assertHeaderContains(response.headers, "access-control-allow-headers", "x-client-info");
}

async function run() {
  const config = resolveConfig();
  await verifyPreflight(config);

  const payload = {
    meetingNo: `smoke-${Date.now()}`,
    items: [
      { id: "smoke-item", kind: "item", title: "Smoke Test", duration: "1", person: "CI" }
    ]
  };

  const created = await invokeAgendaDraft(config, { action: "create", payload });
  const draftId = created?.data?.id;
  const version = Number(created?.data?.version);
  assert.match(String(draftId || ""), /^[A-Za-z0-9_-]{20,80}$/);
  assert.equal(version, 1);

  const loaded = await invokeAgendaDraft(config, { action: "get", draftId });
  assert.equal(loaded?.data?.payload?.meetingNo, payload.meetingNo);
  assert.equal(Number(loaded?.data?.version), version);

  const saved = await invokeAgendaDraft(config, {
    action: "save",
    draftId,
    clientId: "agenda-client-smoke-test",
    expectedVersion: version,
    payload: { ...payload, meetingNo: `${payload.meetingNo}-saved` }
  });
  assert.equal(Number(saved?.data?.version), version + 1);

  const stale = await invokeAgendaDraftRaw(config, {
    action: "save",
    draftId,
    clientId: "agenda-client-smoke-test",
    expectedVersion: version,
    payload: { ...payload, meetingNo: `${payload.meetingNo}-stale` }
  });
  assert.equal(stale.response.status, 409, `stale save should return 409, got ${stale.response.status}`);
  assert.equal(stale.json?.error?.code, "version_conflict");
  assert.ok(stale.elapsedMs < 6000, `stale save should fail fast, took ${stale.elapsedMs}ms`);

  console.log(`Supabase smoke test passed for ${FUNCTION_NAME}: ${draftId} v${version}->v${version + 1}`);
}

run().catch((error) => {
  console.error(error?.message || error);
  process.exit(1);
});
