import { RouteOption } from "./RouteOption.js";
import { CapturePreview } from "./CapturePreview.js";
import { getBlob } from "./shared.js";
const $ = (id) => document.getElementById(id);
let state = {},
  urls = [];
async function command(type, data = {}) {
  const r = await chrome.runtime.sendMessage({ type, ...data });
  if (!r?.ok) throw new Error(r?.error || "Capture service unavailable.");
  return r.data;
}
async function action(button, fn) {
  button.disabled = true;
  try {
    await fn();
    await refresh();
  } catch (e) {
    $("message").textContent = e.message;
  } finally {
    button.disabled = false;
  }
}
async function refresh() {
  state = await command("STATE");
  $("pair").hidden = !!state.token;
  $("capture").hidden = !state.token;
  $("project-title").textContent = state.projectTitle || "";
  $("message").textContent = state.message || "";
  $("record").textContent = state.recording
    ? "Stop recording"
    : "Record interaction";
  $("editor-link").href = `${state.server}/projects/${state.projectId}`;
  const routes = $("routes");
  routes.replaceChildren();
  for (const [i, r] of (state.routes || []).entries()) {
    routes.append(
      RouteOption(r, (selected) => {
        state.routes[i].selected = selected;
        command("ROUTES", { routes: state.routes });
      }),
    );
  }
  const host = $("captures");
  host.replaceChildren();
  urls.forEach(URL.revokeObjectURL);
  urls = [];
  for (const c of state.captures || []) {
    const stored = await getBlob(c.id);
    if (!stored) continue;
    const url = URL.createObjectURL(stored.blob);
    urls.push(url);
    host.append(
      CapturePreview(
        c,
        url,
        (button) => action(button, () => command("UPLOAD", { id: c.id })),
        (button) => action(button, () => command("REMOVE", { id: c.id })),
      ),
    );
  }
}
for (const [id, type] of [
  ["inspect", "INSPECT"],
  ["traverse", "TRAVERSE"],
  ["pause", "PAUSE"],
  ["mask", "MASK"],
])
  $(id).onclick = () => action($(id), () => command(type));
$("pair-button").onclick = async () => {
  try {
    const server = new URL($("server").value);
    if (server.protocol === "https:") {
      const allowed = await chrome.permissions.request({
        origins: [`${server.origin}/*`],
      });
      if (!allowed)
        throw new Error("Permission to connect to Cue was not granted.");
    }
    await action($("pair-button"), () =>
      command("PAIR", { server: server.origin, code: $("code").value }),
    );
  } catch (e) {
    $("message").textContent = e.message;
  }
};
$("current").onclick = () =>
  action($("current"), () => command("CAPTURE", { label: $("label").value }));
$("record").onclick = () =>
  action($("record"), () =>
    command(state.recording ? "STOP_RECORD" : "RECORD"),
  );
$("change").onclick = () => {
  $("pair").hidden = false;
  $("capture").hidden = true;
};
chrome.runtime.onMessage.addListener((m) => {
  if (m.type === "UPDATED")
    refresh().catch((e) => ($("message").textContent = e.message));
});
refresh().catch((e) => ($("message").textContent = e.message));
