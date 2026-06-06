(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.TMAgendaCloudSync = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function () {
  const CLIENT_ID_STORAGE_KEY = "tm_agenda_cloud_client_id_v1";
  const SAVE_DEBOUNCE_MS = 900;

  const SYNC_STATUS = Object.freeze({
    local: "local",
    syncing: "syncing",
    synced: "synced",
    offline: "offline",
    error: "error"
  });

  function getDraftIdFromSearch(search) {
    return (new URLSearchParams(search || "").get("draft") || "").trim();
  }

  function buildDraftUrl(href, draftId) {
    const url = new URL(href);
    url.searchParams.set("draft", draftId);
    return url.toString();
  }

  function bytesToBase64Url(bytes) {
    let binary = "";
    bytes.forEach((byte) => {
      binary += String.fromCharCode(byte);
    });
    return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
  }

  function randomId(getRandomValues) {
    const bytes = new Uint8Array(18);
    getRandomValues(bytes);
    return bytesToBase64Url(bytes);
  }

  function getOrCreateClientId(storage, getRandomValues) {
    const existing = storage?.getItem?.(CLIENT_ID_STORAGE_KEY);
    if (existing) return existing;
    const clientId = `agenda-client-${randomId(getRandomValues)}`;
    storage?.setItem?.(CLIENT_ID_STORAGE_KEY, clientId);
    return clientId;
  }

  function normalizeRpcRow(data) {
    if (Array.isArray(data)) return data[0] || null;
    return data || null;
  }

  function isVersionConflictError(error) {
    const message = String(error?.message || error || "");
    const code = String(error?.code || "");
    return code === "40001" || /version conflict/i.test(message);
  }

  function isExpectedVersionRpcMissing(error) {
    const message = String(error?.message || error || "");
    const code = String(error?.code || "");
    return code === "PGRST202" && /expected_version|save_agenda_draft/i.test(message);
  }

  function isSupabaseConfigured(config) {
    return Boolean(config?.url && (config?.publishableKey || config?.anonKey || config?.key));
  }

  function createAgendaCloudSync(options) {
    const storage = options.storage || null;
    const getRandomValues = options.getRandomValues || ((bytes) => crypto.getRandomValues(bytes));
    const clientId = options.clientId || getOrCreateClientId(storage, getRandomValues);
    const setStatus = options.setStatus || (() => {});
    const renderLink = options.renderLink || (() => {});
    const setBrowserUrl = options.setBrowserUrl || (() => {});
    const nowHref = options.nowHref || (() => "");
    const normalizeRemotePayload = options.normalizeRemotePayload || ((payload) => payload);
    const setTimeoutFn = options.setTimeout || setTimeout;
    const clearTimeoutFn = options.clearTimeout || clearTimeout;
    const online = options.online || (() => true);
    const config = options.config || {};
    const supabaseLibrary = options.supabaseLibrary || null;
    let supabaseClient = null;
    let channel = null;
    let draftId = options.initialDraftId || "";
    let version = 0;
    let saveTimer = null;
    let applyingRemote = false;
    let pendingOfflineSave = false;

    function getDraftLink() {
      return draftId ? buildDraftUrl(nowHref(), draftId) : "";
    }

    function updateLink() {
      renderLink(getDraftLink(), draftId);
    }

    function resolveSupabaseClient() {
      if (supabaseClient) return supabaseClient;
      const createClient = supabaseLibrary?.createClient;
      if (!isSupabaseConfigured(config) || !createClient) return null;
      supabaseClient = createClient(config.url, config.publishableKey || config.anonKey || config.key);
      return supabaseClient;
    }

    function applyStatus(status, detail = "") {
      setStatus(status, detail);
    }

    async function rpc(name, args) {
      const client = resolveSupabaseClient();
      if (!client) throw new Error("Supabase sync is not configured");
      const { data, error } = await client.rpc(name, args);
      if (error) throw error;
      return normalizeRpcRow(data);
    }

    async function loadRemoteDraft() {
      if (!draftId) return null;
      applyStatus(SYNC_STATUS.syncing);
      const row = await rpc("get_agenda_draft", { draft_id: draftId });
      if (!row?.payload) throw new Error("Sync draft not found");
      applyingRemote = true;
      try {
        options.applyRemotePayload(normalizeRemotePayload(row.payload));
      } finally {
        applyingRemote = false;
      }
      version = Number(row.version || version || 1);
      applyStatus(SYNC_STATUS.synced);
      updateLink();
      return row;
    }

    function detachChannel() {
      if (channel && supabaseClient?.removeChannel) supabaseClient.removeChannel(channel);
      channel = null;
    }

    function attachChannel() {
      const client = resolveSupabaseClient();
      if (!client || !draftId || channel) return;
      channel = client
        .channel(`agenda-draft:${draftId}`, { config: { broadcast: { self: false } } })
        .on("broadcast", { event: "agenda-updated" }, (message) => {
          handleBroadcast(message?.payload || message);
        });
      channel.subscribe((status) => {
        if (status === "SUBSCRIBED" && pendingOfflineSave) saveNow();
      });
    }

    async function init() {
      updateLink();
      if (!draftId) {
        applyStatus(SYNC_STATUS.local);
        return null;
      }
      if (!resolveSupabaseClient()) {
        applyStatus(SYNC_STATUS.error, "missing-config");
        return null;
      }
      attachChannel();
      return loadRemoteDraft();
    }

    async function createDraft() {
      if (!resolveSupabaseClient()) {
        applyStatus(SYNC_STATUS.error, "missing-config");
        throw new Error("Supabase sync is not configured");
      }
      applyStatus(SYNC_STATUS.syncing);
      const row = await rpc("create_agenda_draft", { payload: options.getPayload() });
      draftId = row.id;
      version = Number(row.version || 1);
      setBrowserUrl(getDraftLink());
      detachChannel();
      attachChannel();
      updateLink();
      applyStatus(SYNC_STATUS.synced);
      return { id: draftId, version, url: getDraftLink() };
    }

    async function saveNow() {
      if (applyingRemote || !draftId) return null;
      if (!resolveSupabaseClient()) {
        applyStatus(SYNC_STATUS.error, "missing-config");
        return null;
      }
      if (!online()) {
        pendingOfflineSave = true;
        applyStatus(SYNC_STATUS.offline);
        return null;
      }
      pendingOfflineSave = false;
      applyStatus(SYNC_STATUS.syncing);
      let row = null;
      const payload = options.getPayload();
      const saveArgs = {
        draft_id: draftId,
        payload,
        client_id: clientId
      };
      try {
        row = await rpc("save_agenda_draft", {
          ...saveArgs,
          expected_version: version || null
        });
      } catch (error) {
        if (isExpectedVersionRpcMissing(error)) {
          row = await rpc("save_agenda_draft", saveArgs);
        } else {
          applyStatus(SYNC_STATUS.error, isVersionConflictError(error) ? "version-conflict" : "");
          throw error;
        }
      }
      version = Number(row.version || version + 1);
      applyStatus(SYNC_STATUS.synced);
      if (channel?.send) {
        await channel.send({
          type: "broadcast",
          event: "agenda-updated",
          payload: { version, updated_by: clientId }
        });
      }
      return { version, updatedAt: row.updated_at };
    }

    function scheduleSave() {
      if (applyingRemote || !draftId) return;
      clearTimeoutFn(saveTimer);
      saveTimer = setTimeoutFn(() => {
        return saveNow().catch((error) => {
          if (!isVersionConflictError(error)) options.onError?.(error);
          applyStatus(online() ? SYNC_STATUS.error : SYNC_STATUS.offline, isVersionConflictError(error) ? "version-conflict" : "");
        });
      }, SAVE_DEBOUNCE_MS);
    }

    async function handleBroadcast(payload) {
      if (!payload || payload.updated_by === clientId) return { ignored: true };
      const remoteVersion = Number(payload.version || 0);
      if (remoteVersion <= version) return { ignored: true };
      await loadRemoteDraft();
      return { applied: true };
    }

    function retryPendingSave() {
      if (pendingOfflineSave) scheduleSave();
    }

    return {
      init,
      createDraft,
      scheduleSave,
      saveNow,
      handleBroadcast,
      retryPendingSave,
      getDraftLink,
      getDraftId: () => draftId,
      getVersion: () => version,
      getClientId: () => clientId
    };
  }

  return {
    CLIENT_ID_STORAGE_KEY,
    SAVE_DEBOUNCE_MS,
    SYNC_STATUS,
    buildDraftUrl,
    getDraftIdFromSearch,
    getOrCreateClientId,
    isSupabaseConfigured,
    createAgendaCloudSync
  };
});
