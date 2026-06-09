import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { test } from "node:test";

const require = createRequire(import.meta.url);
const CloudSync = require("../js/agenda-cloud-sync.js");

function storageFake(values = {}) {
  return {
    values,
    getItem(key) {
      return this.values[key] || null;
    },
    setItem(key, value) {
      this.values[key] = value;
    }
  };
}

function deterministicRandom(bytes) {
  bytes.fill(7);
}

function createFakeSupabase(rpcHandler) {
  const calls = [];
  let broadcastHandler = null;
  let subscribeHandler = null;
  const channel = {
    on(type, filter, handler) {
      calls.push(["on", type, filter]);
      broadcastHandler = handler;
      return this;
    },
    subscribe(callback) {
      calls.push(["subscribe"]);
      subscribeHandler = callback;
      callback?.("SUBSCRIBED");
      return this;
    },
    async send(message) {
      calls.push(["send", message]);
      return "ok";
    }
  };
  return {
    calls,
    get broadcastHandler() {
      return broadcastHandler;
    },
    get subscribeHandler() {
      return subscribeHandler;
    },
    library: {
      createClient() {
        calls.push(["createClient"]);
        return {
          async rpc(name, args) {
            calls.push(["rpc", name, args]);
            return rpcHandler(name, args);
          },
          channel(topic, config) {
            calls.push(["channel", topic, config]);
            return channel;
          },
          removeChannel() {
            calls.push(["removeChannel"]);
          }
        };
      }
    }
  };
}

function createController({
  initialDraftId = "draft_12345678901234567890",
  payload = { meetingNo: "739" },
  rpcHandler,
  online = () => true,
  onError = () => {}
}) {
  const statuses = [];
  const links = [];
  const applied = [];
  const urls = [];
  let scheduled = null;
  const fake = createFakeSupabase(rpcHandler);
  const controller = CloudSync.createAgendaCloudSync({
    config: { url: "https://example.supabase.co", publishableKey: "sb_publishable_test" },
    supabaseLibrary: fake.library,
    storage: storageFake(),
    getRandomValues: deterministicRandom,
    initialDraftId,
    getPayload: () => payload,
    applyRemotePayload: (remotePayload) => applied.push(remotePayload),
    setStatus: (status, detail) => statuses.push([status, detail]),
    renderLink: (url, draftId) => links.push({ url, draftId }),
    nowHref: () => "https://scorpioapn.github.io/agenda_generator.html",
    setBrowserUrl: (url) => urls.push(url),
    setTimeout: (fn) => {
      scheduled = fn;
      return 1;
    },
    clearTimeout: () => {},
    online,
    onError
  });
  return { controller, fake, statuses, links, applied, urls, runScheduled: () => scheduled?.() };
}

test("cloud sync reads draft id from URL search", () => {
  assert.equal(CloudSync.getDraftIdFromSearch("?draft=abc123&v=1"), "abc123");
  assert.equal(CloudSync.getDraftIdFromSearch("?v=1"), "");
});

test("cloud sync creates a stable browser client id", () => {
  const storage = storageFake();
  const first = CloudSync.getOrCreateClientId(storage, deterministicRandom);
  const second = CloudSync.getOrCreateClientId(storage, deterministicRandom);
  assert.equal(first, second);
  assert.match(first, /^agenda-client-/);
});

test("cloud sync loads remote draft when URL contains draft", async () => {
  const { controller, applied, statuses, fake } = createController({
    rpcHandler(name) {
      assert.equal(name, "get_agenda_draft");
      return Promise.resolve({ data: { payload: { meetingNo: "740" }, version: 7, updated_at: "2026-06-01" }, error: null });
    }
  });

  await controller.init();

  assert.deepEqual(applied, [{ meetingNo: "740" }]);
  assert.equal(controller.getVersion(), 7);
  assert.ok(statuses.some(([status]) => status === CloudSync.SYNC_STATUS.synced));
  assert.ok(fake.calls.some((call) => call[0] === "channel" && call[1] === "agenda-draft:draft_12345678901234567890"));
});

test("cloud sync debounces local edits before saving to Supabase RPC", async () => {
  const saveCalls = [];
  const { controller, runScheduled, fake } = createController({
    payload: { meetingNo: "741" },
    rpcHandler(name, args) {
      if (name === "save_agenda_draft") {
        saveCalls.push(args);
        return Promise.resolve({ data: { version: 3, updated_at: "2026-06-01" }, error: null });
      }
      return Promise.resolve({ data: { payload: { meetingNo: "739" }, version: 2 }, error: null });
    }
  });

  await controller.init();
  controller.scheduleSave();
  await runScheduled();

  assert.equal(saveCalls.length, 1);
  assert.deepEqual(saveCalls[0].payload, { meetingNo: "741" });
  assert.equal(saveCalls[0].draft_id, "draft_12345678901234567890");
  assert.equal(saveCalls[0].expected_version, 2);
  assert.ok(saveCalls[0].client_id.startsWith("agenda-client-"));
  assert.ok(fake.calls.some((call) => call[0] === "send" && call[1].event === "agenda-updated"));
});

test("cloud sync rejects stale saves without broadcasting success", async () => {
  const { controller, statuses, fake } = createController({
    payload: { meetingNo: "stale-local" },
    rpcHandler(name) {
      if (name === "save_agenda_draft") {
        return Promise.resolve({ data: null, error: new Error("agenda draft version conflict") });
      }
      return Promise.resolve({ data: { payload: { meetingNo: "remote" }, version: 7 }, error: null });
    }
  });

  await controller.init();
  await assert.rejects(() => controller.saveNow(), /version conflict/);

  assert.equal(controller.getVersion(), 7, "local controller version should not advance after a rejected stale save");
  assert.ok(statuses.some(([status, detail]) => status === CloudSync.SYNC_STATUS.error && detail === "version-conflict"));
  assert.equal(fake.calls.some((call) => call[0] === "send"), false, "stale saves should not broadcast a successful update");
});

test("cloud sync falls back to legacy save RPC while the expected-version migration is pending", async () => {
  const saveCalls = [];
  const { controller } = createController({
    payload: { meetingNo: "legacy-compatible" },
    rpcHandler(name, args) {
      if (name === "save_agenda_draft") {
        saveCalls.push(args);
        if (Object.hasOwn(args, "expected_version")) {
          const error = new Error("Could not find the function public.save_agenda_draft with expected_version");
          error.code = "PGRST202";
          return Promise.resolve({ data: null, error });
        }
        return Promise.resolve({ data: { version: 8, updated_at: "2026-06-06" }, error: null });
      }
      return Promise.resolve({ data: { payload: { meetingNo: "remote" }, version: 7 }, error: null });
    }
  });

  await controller.init();
  await controller.saveNow();

  assert.equal(saveCalls.length, 2);
  assert.equal(saveCalls[0].expected_version, 7);
  assert.equal(Object.hasOwn(saveCalls[1], "expected_version"), false, "legacy fallback should preserve live sync until the DB migration is applied");
  assert.equal(controller.getVersion(), 8);
});

test("cloud sync applies newer remote broadcast and ignores self broadcast", async () => {
  let remoteVersion = 1;
  const { controller, applied } = createController({
    rpcHandler(name) {
      if (name === "get_agenda_draft") {
        return Promise.resolve({
          data: { payload: { meetingNo: String(739 + remoteVersion) }, version: remoteVersion },
          error: null
        });
      }
      return Promise.resolve({ data: { version: remoteVersion }, error: null });
    }
  });

  await controller.init();
  const appliedAfterInit = applied.length;
  await controller.handleBroadcast({ version: 99, updated_by: controller.getClientId() });
  assert.equal(applied.length, appliedAfterInit, "self broadcasts should not reload the draft");

  remoteVersion = 2;
  await controller.handleBroadcast({ version: 2, updated_by: "other-client" });

  assert.equal(applied.length, appliedAfterInit + 1);
  assert.deepEqual(applied.at(-1), { meetingNo: "741" });
  assert.equal(controller.getVersion(), 2);
});

test("cloud sync reports newer broadcast load failures", async () => {
  let loadCalls = 0;
  const errors = [];
  const { controller, statuses, fake } = createController({
    rpcHandler(name) {
      if (name === "get_agenda_draft") {
        loadCalls += 1;
        if (loadCalls === 1) {
          return Promise.resolve({ data: { payload: { meetingNo: "739" }, version: 1 }, error: null });
        }
        return Promise.resolve({ data: null, error: new Error("remote draft unavailable") });
      }
      return Promise.resolve({ data: { version: 1 }, error: null });
    },
    onError: (error) => errors.push(error)
  });

  await controller.init();
  await fake.broadcastHandler({ payload: { version: 5, updated_by: "other-client" } });

  assert.equal(errors.length, 1);
  assert.match(errors[0].message, /remote draft unavailable/);
  assert.ok(statuses.some(([status]) => status === CloudSync.SYNC_STATUS.error), "failed broadcast refresh should show sync failure");
});

test("cloud sync reports pending reconnect save failures", async () => {
  let isOnline = true;
  let saveAttempts = 0;
  const errors = [];
  const { controller, statuses, fake } = createController({
    payload: { meetingNo: "offline-edit" },
    rpcHandler(name) {
      if (name === "save_agenda_draft") {
        saveAttempts += 1;
        return Promise.resolve({ data: null, error: new Error("save rejected after reconnect") });
      }
      return Promise.resolve({ data: { payload: { meetingNo: "739" }, version: 1 }, error: null });
    },
    online: () => isOnline,
    onError: (error) => errors.push(error)
  });

  await controller.init();
  isOnline = false;
  await controller.saveNow();
  isOnline = true;
  await fake.subscribeHandler("SUBSCRIBED");

  assert.equal(saveAttempts, 1);
  assert.equal(errors.length, 1);
  assert.match(errors[0].message, /save rejected after reconnect/);
  assert.ok(statuses.some(([status]) => status === CloudSync.SYNC_STATUS.offline), "offline edit should show pending offline status first");
  assert.ok(statuses.some(([status]) => status === CloudSync.SYNC_STATUS.error), "failed reconnect save should show sync failure");
});
