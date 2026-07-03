import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  MAX_PAYLOAD_BYTES,
  PolicyError,
  limitForAction,
  validateAgendaRequest
} from "../_shared/agenda-policy.mjs";

const MAX_REQUEST_BYTES = MAX_PAYLOAD_BYTES + 64 * 1024;
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
    "access-control-allow-headers": "authorization, apikey, content-type, x-client-info, x-region",
    "access-control-allow-methods": "POST, OPTIONS",
    "vary": "origin"
  };
}

function jsonResponse(
  request: Request,
  body: unknown,
  status = 200,
  extraHeaders: Record<string, string> = {}
) {
  return new Response(body === null ? null : JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      ...corsHeaders(request),
      ...extraHeaders
    }
  });
}

function jsonOk(request: Request, data: unknown) {
  return jsonResponse(request, { data });
}

function jsonError(
  request: Request,
  code: string,
  status: number,
  extraHeaders: Record<string, string> = {}
) {
  return jsonResponse(request, { error: { code, message: code } }, status, extraHeaders);
}

function assertOriginAllowed(request: Request) {
  const origin = request.headers.get("origin") || "";
  if (allowedOrigins.size && origin && !allowedOrigins.has(origin)) {
    throw new PolicyError("origin_not_allowed", 403);
  }
}

function serviceClient() {
  const url = Deno.env.get("SUPABASE_URL") || "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  if (!url || !serviceRoleKey) throw new PolicyError("service_not_configured", 503);
  return createClient(url, serviceRoleKey, { auth: { persistSession: false } });
}

async function parseRequestBody(request: Request) {
  const declaredLength = Number(request.headers.get("content-length") || 0);
  if (declaredLength > MAX_REQUEST_BYTES) throw new PolicyError("request_too_large", 413);
  const raw = await request.text();
  if (new TextEncoder().encode(raw).length > MAX_REQUEST_BYTES) {
    throw new PolicyError("request_too_large", 413);
  }
  try {
    return JSON.parse(raw);
  } catch {
    throw new PolicyError("invalid_json");
  }
}

async function hashIp(ip: string) {
  const salt = Deno.env.get("AGENDA_RATE_LIMIT_SALT") || "";
  if (!salt) throw new PolicyError("service_not_configured", 503);
  const address = ip.split(",")[0].trim() || "unknown";
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(`${salt}:${address}`)
  );
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function consumeRateLimit(
  bucket: string,
  action: string,
  limit: number,
  windowSeconds: number
) {
  const { data, error } = await serviceClient().rpc("consume_agenda_draft_rate_limit", {
    p_bucket_key: bucket,
    p_action: action,
    p_limit: limit,
    p_window_seconds: windowSeconds
  });
  if (error) throw new PolicyError("rate_limit_unavailable", 503);
  return data === true;
}

function firstRow(data: unknown) {
  return Array.isArray(data) ? data[0] || null : data || null;
}

async function createDraft(payload: unknown) {
  const { data, error } = await serviceClient().rpc("create_agenda_draft", { payload });
  if (error) throw error;
  const row = firstRow(data);
  if (!row) throw new PolicyError("draft_create_failed", 500);
  return row;
}

async function getDraft(draftId: string) {
  const { data, error } = await serviceClient().rpc("get_agenda_draft", { draft_id: draftId });
  if (error) throw error;
  const row = firstRow(data);
  if (!row) throw new PolicyError("draft_not_found", 404);
  return row;
}

async function saveDraft(body: ReturnType<typeof validateAgendaRequest>) {
  const { data, error } = await serviceClient().rpc("save_agenda_draft", {
    draft_id: body.draftId,
    payload: body.payload,
    client_id: body.clientId,
    expected_version: body.expectedVersion
  });
  if (error) throw error;
  const row = firstRow(data);
  if (!row) throw new PolicyError("draft_save_failed", 500);
  return row;
}

function mapSafeError(request: Request, error: unknown) {
  if (error instanceof PolicyError) return jsonError(request, error.code, error.status);
  const code = String((error as { code?: string })?.code || "");
  if (code === "40001") return jsonError(request, "version_conflict", 409);
  if (code === "P0002") return jsonError(request, "draft_not_found", 404);
  if (code === "23514" || code === "22023") return jsonError(request, "invalid_payload", 400);
  console.error("agenda-drafts failed", code || "unknown_database_error");
  return jsonError(request, "internal_error", 500);
}

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") return jsonResponse(request, null, 204);
  if (request.method !== "POST") return jsonError(request, "method_not_allowed", 405);

  try {
    assertOriginAllowed(request);
    const body = validateAgendaRequest(await parseRequestBody(request));
    const ipHash = await hashIp(request.headers.get("x-forwarded-for") || "unknown");
    const bucket = body.action === "save" ? `${ipHash}:${body.draftId}` : ipHash;
    const { limit, windowSeconds } = limitForAction(body.action);
    const allowed = await consumeRateLimit(bucket, body.action, limit, windowSeconds);
    if (!allowed) {
      return jsonError(request, "rate_limited", 429, { "Retry-After": String(windowSeconds) });
    }
    if (body.action === "create") return jsonOk(request, await createDraft(body.payload));
    if (body.action === "get") return jsonOk(request, await getDraft(body.draftId));
    return jsonOk(request, await saveDraft(body));
  } catch (error) {
    return mapSafeError(request, error);
  }
});
