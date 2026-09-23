import {
  normalizeRoute,
  family,
  evidenceExpression,
  maskPickerExpression,
  saveBlob,
  getBlob,
  removeBlob,
  allBlobs,
  recoverRecordings,
} from "./shared.js";
import { renderedStateReadinessExpression } from "./vendor/site-dna-readiness.js";
const send = (tabId, method, params = {}) =>
  chrome.debugger.sendCommand({ tabId }, method, params);
const load = async () =>
  (await chrome.storage.local.get("cue")).cue || {
    status: "idle",
    routes: [],
    captures: [],
    paused: false,
  };
const save = async (patch) => {
  const s = { ...(await load()), ...patch };
  await chrome.storage.local.set({ cue: s });
  chrome.runtime.sendMessage({ type: "UPDATED" }).catch(() => {});
  return s;
};
let busy = false,
  epoch = 0;
chrome.runtime.onInstalled.addListener(() =>
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }),
);
chrome.runtime.onStartup.addListener(async () => {
  await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
  const recovered = await recoverRecordings();
  const s = await load();
  if (recovered.length)
    await save({
      recording: false,
      captures: [
        ...s.captures,
        ...recovered
          .filter((id) => !s.captures.some((c) => c.id === id))
          .map((id) => ({
            id,
            title: "Recovered recording",
            kind: "video",
            uploaded: false,
          })),
      ],
    });
  if (s.status === "capturing")
    await save({
      status: "paused",
      paused: true,
      message: "Capture interrupted. Resume when the page is ready.",
    });
});
chrome.webNavigation.onCommitted.addListener(async (d) => {
  if (d.frameId !== 0) return;
  const s = await load();
  if (d.tabId !== s.tabId) return;
  epoch++;
  if (new URL(d.url).origin !== s.sourceOrigin) {
    await save({
      paused: true,
      status: "paused",
      message:
        "Navigation left the approved site. Finish signing in, return to your app, then resume.",
    });
    await chrome.debugger.detach({ tabId: d.tabId }).catch(() => {});
    if (s.recording)
      chrome.runtime
        .sendMessage({ target: "offscreen", type: "STOP", discard: true })
        .catch(() => {});
  }
});
chrome.webNavigation.onHistoryStateUpdated.addListener(async (d) => {
  if (d.frameId === 0 && d.tabId === (await load()).tabId) epoch++;
});
chrome.webNavigation.onReferenceFragmentUpdated.addListener(async (d) => {
  if (d.frameId === 0 && d.tabId === (await load()).tabId) epoch++;
});
chrome.debugger.onDetach.addListener(async ({ tabId }) => {
  const s = await load();
  if (s.tabId === tabId && s.status === "capturing")
    await save({
      status: "paused",
      paused: true,
      message: "Debugger disconnected. Resume capture to reconnect.",
    });
});
async function attach(tabId) {
  try {
    await chrome.debugger.attach({ tabId }, "1.3");
  } catch (e) {
    if (!String(e.message).includes("already attached")) throw e;
    try {
      await send(tabId, "Runtime.evaluate", { expression: "1" });
    } catch {
      throw new Error(
        "Another debugger owns this tab. Close DevTools or the other capture session.",
      );
    }
  }
  await send(tabId, "Page.enable");
  await send(tabId, "Runtime.enable");
}
async function evaluate(tabId, expression) {
  const r = await send(tabId, "Runtime.evaluate", {
    expression,
    returnByValue: true,
    awaitPromise: true,
  });
  if (r.exceptionDetails) throw new Error("The page could not be inspected.");
  return r.result.value;
}
async function api(s, route, options = {}) {
  const r = await fetch(`${s.server}${route}`, {
    ...options,
    headers: { Authorization: `Bearer ${s.token}`, ...options.headers },
  });
  const x = await r.json();
  if (!r.ok) throw new Error(x.error || "Cue could not receive this capture.");
  return x;
}
async function currentTab() {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  const t = tabs[0];
  if (!t?.id || !/^https?:/.test(t.url || ""))
    throw new Error("Select a website tab first.");
  return t;
}
async function inspectTab() {
  const tab = await currentTab();
  const s = await load();
  await attach(tab.id);
  const e = await evaluate(tab.id, evidenceExpression);
  const routes = [];
  const seen = new Set();
  for (const a of [{ href: tab.url, label: tab.title }, ...e.links]) {
    const url = normalizeRoute(a.href, tab.url);
    if (!url || seen.has(url)) continue;
    seen.add(url);
    routes.push({
      url,
      label: a.label || new URL(url).pathname,
      family: family(url),
      selected: routes.length < 25,
      state: "pending",
    });
  }
  return save({
    tabId: tab.id,
    sourceOrigin: new URL(tab.url).origin,
    originalUrl: tab.url,
    originalScroll: await evaluate(tab.id, "scrollY"),
    routes: routes.slice(0, 100),
    status: "ready",
    paused: false,
    message: `${routes.length} pages discovered. Review the selection before capturing.`,
  });
}
async function readiness(tabId) {
  const warnings = [];
  await evaluate(
    tabId,
    "Promise.race([document.fonts.ready,new Promise(r=>setTimeout(r,4000))]).then(()=>true)",
  ).catch(() => {});
  const result = await evaluate(tabId, renderedStateReadinessExpression(18000));
  if (!result.ready)
    warnings.push("Dynamic content did not fully settle. Review this capture.");
  await evaluate(
    tabId,
    "Promise.race([Promise.all([...document.images].filter(i=>{const r=i.getBoundingClientRect();return r.bottom>0&&r.top<innerHeight}).map(i=>i.decode().catch(()=>{}))),new Promise(r=>setTimeout(r,4000))]).then(()=>true)",
  );
  return warnings;
}
async function capture(stateLabel = "") {
  const s = await load();
  if (!s.tabId) await inspectTab();
  const current = await load(),
    tab = await chrome.tabs.get(current.tabId);
  if (new URL(tab.url).origin !== current.sourceOrigin)
    throw new Error("Return to the approved website before capturing.");
  await attach(current.tabId);
  const stamp = epoch,
    warnings = await readiness(current.tabId);
  const evidence = await evaluate(current.tabId, evidenceExpression);
  const png = await send(current.tabId, "Page.captureScreenshot", {
    format: "png",
    captureBeyondViewport: false,
  });
  if (
    stamp !== epoch ||
    (await evaluate(current.tabId, "location.href")) !== evidence.url
  )
    throw new Error("The page changed during capture. Try again.");
  const bytes = Uint8Array.from(atob(png.data), (c) => c.charCodeAt(0));
  const bitmap = await createImageBitmap(
    new Blob([bytes], { type: "image/png" }),
  );
  const canvas = new OffscreenCanvas(bitmap.width, bitmap.height),
    ctx = canvas.getContext("2d");
  ctx.drawImage(bitmap, 0, 0);
  const sx = bitmap.width / evidence.viewport.width,
    sy = bitmap.height / evidence.viewport.height;
  ctx.fillStyle = "#202220";
  for (const r of evidence.masks)
    ctx.fillRect(
      Math.floor(r.x * sx) - 3,
      Math.floor(r.y * sy) - 3,
      Math.ceil(r.width * sx) + 6,
      Math.ceil(r.height * sy) + 6,
    );
  bitmap.close();
  const blob = await canvas.convertToBlob({ type: "image/png" });
  const id = crypto.randomUUID();
  const metadata = {
    ...evidence,
    links: undefined,
    masks: evidence.masks.length,
    state: stateLabel || evidence.title,
    warnings,
  };
  await saveBlob(id, blob, metadata);
  await save({
    captures: [
      ...(await load()).captures,
      { id, title: metadata.state, kind: "image", uploaded: false },
    ],
    message: "Capture saved locally. Review it, then send it to Cue.",
  });
  return id;
}
async function upload(id) {
  const s = await load(),
    c = await getBlob(id);
  if (!c) throw new Error("Capture no longer exists.");
  if (!s.token) throw new Error("Pair with a Cue project first.");
  const buffer = await c.blob.arrayBuffer(),
    digest = [...new Uint8Array(await crypto.subtle.digest("SHA-256", buffer))]
      .map((x) => x.toString(16).padStart(2, "0"))
      .join("");
  let u =
    c.metadata.uploadProjectId === s.projectId ? c.metadata.uploadId : null;
  if (!u) {
    const r = await api(s, `/api/projects/${s.projectId}/uploads`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: `${c.metadata.state || "Capture"}.${c.blob.type.startsWith("video") ? "webm" : "png"}`,
        bytes: buffer.byteLength,
        hash: digest,
        metadata: c.metadata,
      }),
    });
    u = r.id;
    c.metadata.uploadId = u;
    c.metadata.uploadProjectId = s.projectId;
    await saveBlob(id, c.blob, c.metadata);
  }
  for (let i = 0; i < Math.ceil(buffer.byteLength / 1048576); i++)
    await api(s, `/api/uploads/${u}/chunks/${i}`, {
      method: "PUT",
      body: buffer.slice(i * 1048576, (i + 1) * 1048576),
    });
  await api(s, `/api/uploads/${u}/complete`, { method: "POST" });
  await save({
    captures: (await load()).captures.map((x) =>
      x.id === id ? { ...x, uploaded: true } : x,
    ),
    message: "Capture added to your Cue project.",
  });
}
async function traverse() {
  if (busy) throw new Error("A capture is already in progress.");
  busy = true;
  try {
    await save({ paused: false, status: "capturing" });
    for (let count = 0; count < 25; count++) {
      const s = await load();
      if (s.paused) break;
      const route = s.routes.find((r) => r.selected && r.state === "pending");
      if (!route) break;
      try {
        await attach(s.tabId);
        await send(s.tabId, "Page.navigate", { url: route.url });
        await new Promise((r) => setTimeout(r, 800));
        if ((await load()).paused) break;
        await capture(route.label);
        await save({
          routes: (await load()).routes.map((r) =>
            r.url === route.url ? { ...r, state: "captured" } : r,
          ),
        });
      } catch (e) {
        await save({
          routes: (await load()).routes.map((r) =>
            r.url === route.url ? { ...r, state: "failed" } : r,
          ),
          message: e.message,
        });
      }
    }
    const s = await load();
    if (!s.paused) {
      await save({
        status: "ready",
        message: "Capture complete. Review your screens before uploading.",
      });
      await send(s.tabId, "Page.navigate", { url: s.originalUrl })
        .then(async () => {
          await readiness(s.tabId);
          await evaluate(
            s.tabId,
            `scrollTo(0,${Number(s.originalScroll) || 0});true`,
          );
        })
        .catch(() => {});
      await chrome.debugger.detach({ tabId: s.tabId }).catch(() => {});
    }
  } finally {
    busy = false;
  }
}
async function recordStart() {
  const s = await load(),
    tab = await currentTab();
  if (
    !s.tabId ||
    tab.id !== s.tabId ||
    new URL(tab.url).origin !== s.sourceOrigin
  )
    throw new Error("Select and inspect the website tab before recording.");
  if (!(await chrome.offscreen.hasDocument()))
    await chrome.offscreen.createDocument({
      url: "offscreen.html",
      reasons: ["USER_MEDIA"],
      justification: "Record a short user-approved product demonstration.",
    });
  const streamId = await chrome.tabCapture.getMediaStreamId({
    targetTabId: s.tabId,
  });
  const result = await chrome.runtime.sendMessage({
    target: "offscreen",
    type: "START",
    streamId,
    metadata: {
      url: tab.url,
      title: tab.title,
      state: "Product demonstration",
    },
  });
  if (!result?.ok)
    throw new Error(result?.error || "Could not start recording.");
  return save({
    recording: true,
    message:
      "Recording this tab. Use demo data; recordings are reviewed before upload.",
  });
}
chrome.runtime.onMessage.addListener((m, sender, reply) => {
  if (m.target === "offscreen" || m.type === "UPDATED") return;
  (async () => {
    if (sender.id !== chrome.runtime.id)
      throw new Error("Invalid extension sender.");
    switch (m.type) {
      case "STATE":
        return load();
      case "PAIR": {
        const server = new URL(m.server);
        if (
          !["127.0.0.1", "localhost"].includes(server.hostname) ||
          server.protocol !== "http:"
        )
          throw new Error("Use your local Cue address.");
        const r = await fetch(`${server.origin}/api/pairing/exchange`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            code: m.code.replaceAll(" ", "").toUpperCase(),
          }),
        });
        const x = await r.json();
        if (!r.ok) throw new Error(x.error);
        return save({
          server: server.origin,
          token: x.token,
          projectId: x.projectId,
          projectTitle: x.title,
        });
      }
      case "INSPECT":
        return inspectTab();
      case "CAPTURE":
        return capture(m.label);
      case "MASK": {
        const s = await load();
        await attach(s.tabId);
        return evaluate(s.tabId, maskPickerExpression);
      }
      case "ROUTES":
        return save({ routes: m.routes });
      case "TRAVERSE":
        await save({
          routes: (await load()).routes.map((r) =>
            r.selected && r.state === "failed" ? { ...r, state: "pending" } : r,
          ),
        });
        traverse().catch((e) =>
          save({ status: "paused", paused: true, message: e.message }),
        );
        return { started: true };
      case "PAUSE":
        return save({ paused: true, status: "paused" });
      case "UPLOAD":
        return upload(m.id);
      case "REMOVE":
        await removeBlob(m.id);
        return save({
          captures: (await load()).captures.filter((x) => x.id !== m.id),
        });
      case "RECORD":
        return recordStart();
      case "STOP_RECORD":
        return chrome.runtime.sendMessage({
          target: "offscreen",
          type: "STOP",
        });
      case "RECORDED":
        return save({
          recording: false,
          captures: [
            ...(await load()).captures,
            {
              id: m.id,
              title: "Product demonstration",
              kind: "video",
              uploaded: false,
            },
          ],
          message: "Recording saved. Review it before upload.",
        });
      case "RECORD_FAILED":
        return save({ recording: false, message: m.error });
      default:
        throw new Error("Unknown capture command.");
    }
  })()
    .then((x) => reply({ ok: true, data: x }))
    .catch((e) => reply({ ok: false, error: e.message }));
  return true;
});
