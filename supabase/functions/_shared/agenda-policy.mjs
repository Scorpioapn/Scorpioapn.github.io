export const MAX_PAYLOAD_BYTES = 4 * 1024 * 1024;

const DRAFT_ID_PATTERN = /^[A-Za-z0-9_-]{20,80}$/;
const CLIENT_ID_PATTERN = /^[A-Za-z0-9._:-]{8,120}$/;
const ACTION_LIMITS = Object.freeze({
  create: Object.freeze({ limit: 10, windowSeconds: 3600 }),
  get: Object.freeze({ limit: 120, windowSeconds: 60 }),
  save: Object.freeze({ limit: 30, windowSeconds: 60 })
});

export class PolicyError extends Error {
  constructor(code, status = 400) {
    super(code.replaceAll("_", " "));
    this.name = "PolicyError";
    this.code = code;
    this.status = status;
  }
}

function jsonByteLength(value) {
  let serialized;
  try {
    serialized = JSON.stringify(value);
  } catch {
    throw new PolicyError("invalid_payload");
  }
  if (serialized === undefined) throw new PolicyError("invalid_payload");
  return new TextEncoder().encode(serialized).length;
}

function validatePayload(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new PolicyError("payload_must_be_an_object");
  }
  if (jsonByteLength(payload) > MAX_PAYLOAD_BYTES) {
    throw new PolicyError("payload_exceeds_4_MiB", 413);
  }
  return payload;
}

export function limitForAction(action) {
  const value = ACTION_LIMITS[action];
  if (!value) throw new PolicyError("invalid_action");
  return { ...value };
}

export function validateAgendaRequest(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new PolicyError("invalid_request");
  }
  const action = String(input.action || "");
  limitForAction(action);

  const draftId = String(input.draftId || "");
  const clientId = String(input.clientId || "");
  const expectedVersion = input.expectedVersion == null ? null : Number(input.expectedVersion);
  let payload = null;

  if (action !== "create" && !DRAFT_ID_PATTERN.test(draftId)) {
    throw new PolicyError("invalid_draft_id");
  }
  if (action === "save" && !CLIENT_ID_PATTERN.test(clientId)) {
    throw new PolicyError("clientId_is_invalid");
  }
  if (action === "save" && (!Number.isInteger(expectedVersion) || expectedVersion < 1)) {
    throw new PolicyError("expectedVersion_must_be_positive");
  }
  if (action === "create" || action === "save") payload = validatePayload(input.payload);

  return { action, draftId, clientId, expectedVersion, payload };
}
