import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { test } from "node:test";
import {
  MAX_PAYLOAD_BYTES,
  PolicyError,
  limitForAction,
  validateAgendaRequest
} from "../supabase/functions/_shared/agenda-policy.mjs";

test("edge policy enforces action-specific limits", () => {
  assert.deepEqual(limitForAction("create"), { limit: 10, windowSeconds: 3600 });
  assert.deepEqual(limitForAction("get"), { limit: 120, windowSeconds: 60 });
  assert.deepEqual(limitForAction("save"), { limit: 30, windowSeconds: 60 });
});

test("edge policy requires valid capability and client identifiers", () => {
  assert.throws(
    () => validateAgendaRequest({ action: "get", draftId: "short" }),
    (error) => error instanceof PolicyError && error.code === "invalid_draft_id" && error.status === 400
  );
  assert.throws(
    () => validateAgendaRequest({ action: "save", draftId: "a".repeat(24), clientId: "", expectedVersion: 1, payload: {} }),
    /clientId is invalid/
  );
});

test("edge policy requires a positive version for saves", () => {
  assert.throws(
    () => validateAgendaRequest({
      action: "save",
      draftId: "a".repeat(24),
      clientId: "client-a",
      expectedVersion: null,
      payload: {}
    }),
    /expectedVersion must be positive/
  );
});

test("edge policy rejects payloads larger than 4 MiB", () => {
  assert.throws(
    () => validateAgendaRequest({ action: "create", payload: { value: "x".repeat(MAX_PAYLOAD_BYTES) } }),
    /payload exceeds 4 MiB/
  );
});

test("edge policy normalizes supported requests", () => {
  assert.deepEqual(validateAgendaRequest({ action: "get", draftId: "a".repeat(24) }), {
    action: "get",
    draftId: "a".repeat(24),
    clientId: "",
    expectedVersion: null,
    payload: null
  });
});

test("hardening migration revokes public draft RPC access", () => {
  const url = new URL("../supabase/migrations/20260622000000_harden_agenda_drafts.sql", import.meta.url);
  assert.equal(existsSync(url), true);
  const sql = readFileSync(url, "utf8");
  assert.match(sql, /revoke all on function public\.create_agenda_draft\(jsonb\) from public, anon, authenticated/i);
  assert.match(sql, /grant execute on function public\.create_agenda_draft\(jsonb\) to service_role/i);
  assert.match(sql, /expires_at timestamptz/i);
  assert.match(sql, /consume_agenda_draft_rate_limit/i);
  assert.match(sql, /expected_version is null or expected_version < 1/i);
});

test("latest draft save migration returns business conflicts without retryable SQLSTATE", () => {
  const url = new URL("../supabase/migrations/20260706000000_fix_agenda_draft_conflict.sql", import.meta.url);
  assert.equal(existsSync(url), true);
  const sql = readFileSync(url, "utf8");
  assert.match(sql, /returns table\(version bigint, updated_at timestamptz, status text\)/i);
  assert.match(sql, /'version_conflict'::text/i);
  assert.match(sql, /'not_found'::text/i);
  assert.doesNotMatch(sql, /40001/, "business version conflicts should not use retryable serialization_failure");
});

test("Edge gateway exists and never exposes raw database errors", () => {
  const url = new URL("../supabase/functions/agenda-drafts/index.ts", import.meta.url);
  assert.equal(existsSync(url), true);
  const source = readFileSync(url, "utf8");
  assert.match(source, /Deno\.serve/);
  assert.match(source, /consume_agenda_draft_rate_limit/);
  assert.match(source, /row\?\.status === "version_conflict"/);
  assert.match(source, /message\.includes\("agenda draft version conflict"\)/);
  assert.match(source, /x-client-info/);
  assert.match(source, /x-region/);
  assert.doesNotMatch(source, /error\.message\s*\}/);
});
