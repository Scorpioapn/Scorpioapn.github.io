(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.TMAgendaData = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function () {
  const MAX_PAYLOAD_BYTES = 4 * 1024 * 1024;
  const MAX_ITEMS = 250;
  const IMAGE_FIELDS = new Set(["logoData", "wechatQrData", "joinQrData", "voteQrData"]);
  const ITEM_FIELDS = ["time", "title", "detail", "duration", "durationNote", "person"];

  function byteLength(value) {
    const text = JSON.stringify(value);
    if (typeof TextEncoder === "function") return new TextEncoder().encode(text).length;
    return unescape(encodeURIComponent(text)).length;
  }

  function assertPayloadSize(value) {
    if (byteLength(value) > MAX_PAYLOAD_BYTES) {
      throw new Error("agenda payload exceeds 4 MiB");
    }
    return value;
  }

  function isPlainObject(value) {
    return Boolean(value) && typeof value === "object" && !Array.isArray(value);
  }

  function validImageSource(value) {
    return value === ""
      || /^data:image\/(?:png|jpeg|webp|gif);base64,[A-Za-z0-9+/=\s]+$/i.test(value)
      || /^assets\/[A-Za-z0-9._/-]+$/.test(value);
  }

  function normalizeString(value, fallback, label, strict) {
    if (value === undefined) return fallback;
    if (typeof value === "string") return value;
    if (strict) throw new Error(`${label} must be a string`);
    return fallback;
  }

  function normalizeItem(item, index, strict) {
    if (!isPlainObject(item)) {
      if (strict) throw new Error(`items[${index}] must be an object`);
      return null;
    }

    const kind = item.kind === "section" ? "section" : "item";
    const normalized = {
      id: String(item.id || `item-${index + 1}`),
      kind
    };

    ITEM_FIELDS.forEach((field) => {
      const value = normalizeString(item[field], "", `items[${index}].${field}`, strict);
      if (field !== "durationNote" || value.trim()) normalized[field] = value;
    });

    if (kind === "section") {
      return { id: normalized.id, kind, title: normalized.title };
    }
    return normalized;
  }

  function normalizeAgendaData(source, defaults, options = {}) {
    const strict = options.strict !== false;
    if (!isPlainObject(source)) throw new Error("agenda payload must be an object");
    if (!isPlainObject(defaults)) throw new Error("agenda defaults must be an object");

    const normalized = {};
    Object.entries(defaults).forEach(([field, fallback]) => {
      if (field === "items" || typeof fallback !== "string") return;
      normalized[field] = normalizeString(source[field], fallback, field, strict);
      if (IMAGE_FIELDS.has(field) && !validImageSource(normalized[field])) {
        if (strict) throw new Error(`${field} contains an unsupported image source`);
        normalized[field] = fallback;
      }
    });

    if (source.items !== undefined && !Array.isArray(source.items) && strict) {
      throw new Error("items must be an array");
    }
    const rawItems = Array.isArray(source.items) ? source.items : (Array.isArray(defaults.items) ? defaults.items : []);
    if (rawItems.length > MAX_ITEMS) throw new Error(`items exceeds ${MAX_ITEMS} entries`);
    normalized.items = rawItems
      .map((item, index) => normalizeItem(item, index, strict))
      .filter(Boolean);

    return assertPayloadSize(normalized);
  }

  return {
    MAX_PAYLOAD_BYTES,
    MAX_ITEMS,
    assertPayloadSize,
    normalizeAgendaData
  };
});
