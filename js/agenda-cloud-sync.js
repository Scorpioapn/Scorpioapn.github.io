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
    return code === "40001" || code === "version_conflict" || /version[ _-]conflict/i.test(message);
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
    let remoteReady = !draftId;
    let dirty = false;
    let conflict = null;

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

    function enterConflict(remoteVersion, reason = "version-conflict") {
      conflict = { remoteVersion: Number(remoteVersion || 0), reason };
      applyStatus(SYNC_STATUS.error, "version-conflict");
      options.onConflict?.({ ...conflict });
      return { conflict: true };
    }

    function clearScheduledSave() {
      if (saveTimer !== null) clearTimeoutFn(saveTimer);
      saveTimer = null;
    }

    async function requestDraft(action, body = {}) {
      if (options.transport) return normalizeRpcRow(await options.transport(action, body));
      const client = resolveSupabaseClient();
      if (!client) throw new Error("Supabase sync is not configured");
      if (!client.functions?.invoke) throw new Error("Supabase Edge sync is not available");
      const { data, error } = await client.functions.invoke("agenda-drafts", {
        body: { action, ...body }
      });
      if (error) throw error;
      if (data?.error) {
        const requestError = new Error(data.error.message || data.error.code || "Agenda sync failed");
        requestError.code = data.error.code || "";
        throw requestError;
      }
      return normalizeRpcRow(data?.data ?? data);
    }

    async function loadRemoteDraft({ force = false } = {}) {
      if (!draftId) return null;
      if (dirty && !force) return enterConflict(version, "local-dirty");
      applyStatus(SYNC_STATUS.syncing);
      const row = await requestDraft("get", { draftId });
      if (dirty && !force) {
        return enterConflict(Number(row?.version || version || 0), "local-dirty");
      }
      if (!row?.payload) throw new Error("Sync draft not found");
      clearScheduledSave();
      pendingOfflineSave = false;
      applyingRemote = true;
      try {
        options.applyRemotePayload(normalizeRemotePayload(row.payload));
      } finally {
        applyingRemote = false;
      }
      version = Number(row.version || version || 1);
      remoteReady = true;
      dirty = false;
      conflict = null;
      applyStatus(SYNC_STATUS.synced);
      updateLink();
      return row;
    }

    function detachChannel() {
      if (channel && supabaseClient?.removeChannel) supabaseClient.removeChannel(channel);
      channel = null;
    }

    function handleAsyncSyncError(error) {
      if (!isVersionConflictError(error)) options.onError?.(error);
      applyStatus(online() ? SYNC_STATUS.error : SYNC_STATUS.offline, isVersionConflictError(error) ? "version-conflict" : "");
    }

    function markSaveFailure(error) {
      if (isVersionConflictError(error)) {
        pendingOfflineSave = false;
        enterConflict(version, "version-conflict");
        return;
      }
      pendingOfflineSave = true;
      applyStatus(SYNC_STATUS.error);
    }

    function attachChannel() {
      const client = resolveSupabaseClient();
      if (!client || !draftId || channel) return;
      channel = client
        .channel(`agenda-draft:${draftId}`, { config: { broadcast: { self: false } } })
        .on("broadcast", { event: "agenda-updated" }, (message) => {
          return handleBroadcast(message?.payload || message).catch(handleAsyncSyncError);
        });
      channel.subscribe((status) => {
        if (status === "SUBSCRIBED" && pendingOfflineSave && remoteReady && !conflict) {
          return saveNow().catch(handleAsyncSyncError);
        }
        return null;
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
      try {
        return await loadRemoteDraft();
      } catch (error) {
        remoteReady = false;
        enterConflict(0, "initial-load-failed");
        throw error;
      }
    }

    async function createDraft() {
      if (!resolveSupabaseClient()) {
        applyStatus(SYNC_STATUS.error, "missing-config");
        throw new Error("Supabase sync is not configured");
      }
      applyStatus(SYNC_STATUS.syncing);
      const row = await requestDraft("create", { payload: options.getPayload() });
      draftId = row.id;
      version = Number(row.version || 1);
      remoteReady = true;
      dirty = false;
      conflict = null;
      setBrowserUrl(getDraftLink());
      detachChannel();
      attachChannel();
      updateLink();
      applyStatus(SYNC_STATUS.synced);
      return { id: draftId, version, url: getDraftLink() };
    }

    async function saveNow() {
      if (applyingRemote || !draftId) return null;
      if (!remoteReady || version <= 0) {
        const error = new Error("remote draft is not ready");
        error.code = "REMOTE_NOT_READY";
        applyStatus(SYNC_STATUS.error, "remote-not-ready");
        throw error;
      }
      if (conflict) return null;
      if (!resolveSupabaseClient()) {
        applyStatus(SYNC_STATUS.error, "missing-config");
        return null;
      }
      if (!online()) {
        pendingOfflineSave = true;
        applyStatus(SYNC_STATUS.offline);
        return null;
      }
      applyStatus(SYNC_STATUS.syncing);
      let row = null;
      const payload = options.getPayload();
      const saveArgs = {
        draftId,
        payload,
        clientId,
        expectedVersion: version
      };
      try {
        row = await requestDraft("save", saveArgs);
      } catch (error) {
        markSaveFailure(error);
        throw error;
      }
      pendingOfflineSave = false;
      version = Number(row.version || version + 1);
      dirty = false;
      conflict = null;
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
      dirty = true;
      if (!remoteReady || conflict) return;
      clearScheduledSave();
      saveTimer = setTimeoutFn(() => {
        saveTimer = null;
        if (conflict) return undefined;
        return saveNow().catch(handleAsyncSyncError);
      }, SAVE_DEBOUNCE_MS);
    }

    async function handleBroadcast(payload) {
      if (!payload || payload.updated_by === clientId) return { ignored: true };
      const remoteVersion = Number(payload.version || 0);
      if (remoteVersion <= version) return { ignored: true };
      if (dirty) return enterConflict(remoteVersion, "remote-update");
      await loadRemoteDraft();
      return { applied: true };
    }

    function retryPendingSave() {
      if (pendingOfflineSave && remoteReady && !conflict) scheduleSave();
    }

    async function loadRemoteLatest() {
      return loadRemoteDraft({ force: true });
    }

    async function forkDraft() {
      if (!resolveSupabaseClient()) {
        applyStatus(SYNC_STATUS.error, "missing-config");
        throw new Error("Supabase sync is not configured");
      }
      applyStatus(SYNC_STATUS.syncing);
      const row = await requestDraft("create", { payload: options.getPayload() });
      detachChannel();
      draftId = row.id;
      version = Number(row.version || 1);
      remoteReady = true;
      dirty = false;
      conflict = null;
      pendingOfflineSave = false;
      setBrowserUrl(getDraftLink());
      attachChannel();
      updateLink();
      applyStatus(SYNC_STATUS.synced);
      return { id: draftId, version, url: getDraftLink() };
    }

    return {
      init,
      createDraft,
      scheduleSave,
      saveNow,
      handleBroadcast,
      retryPendingSave,
      loadRemoteLatest,
      forkDraft,
      getDraftLink,
      getDraftId: () => draftId,
      getVersion: () => version,
      getClientId: () => clientId,
      hasConflict: () => Boolean(conflict),
      isRemoteReady: () => remoteReady,
      isDirty: () => dirty
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
