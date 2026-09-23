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
    const label = document.createElement("label"),
      checkbox = document.createElement("input"),
      text = document.createElement("span");
    checkbox.type = "checkbox";
    checkbox.checked = r.selected;
    text.textContent = `${r.label} ${r.state === "captured" ? "✓" : r.state === "failed" ? "(retry needed)" : ""}`;
    checkbox.onchange = () => {
      state.routes[i].selected = checkbox.checked;
      command("ROUTES", { routes: state.routes });
    };
    label.append(checkbox, text);
    routes.append(label);
  }
  const host = $("captures");
  host.replaceChildren();
  urls.forEach(URL.revokeObjectURL);
  urls = [];
  for (const c of state.captures || []) {
    const stored = await getBlob(c.id);
    if (!stored) continue;
    const item = document.createElement("div");
    item.className = "capture";
    const preview = document.createElement(
        c.kind === "video" ? "video" : "img",
      ),
      url = URL.createObjectURL(stored.blob);
    urls.push(url);
    preview.src = url;
    if (c.kind === "video") preview.controls = true;
    else preview.alt = c.title;
    const name = document.createElement("strong");
    name.textContent = c.title;
    const row = document.createElement("div");
    row.className = "row";
    const upload = document.createElement("button");
    upload.textContent = c.uploaded ? "Added to project" : "Send to Cue";
    upload.disabled = !!c.uploaded;
    upload.onclick = () =>
      action(upload, () => command("UPLOAD", { id: c.id }));
    const remove = document.createElement("button");
    remove.textContent = "Discard local copy";
    remove.className = "quiet";
    remove.onclick = () =>
      action(remove, () => command("REMOVE", { id: c.id }));
    row.append(upload, remove);
    item.append(preview, name, row);
    host.append(item);
  }
}
for (const [id, type] of [
  ["inspect", "INSPECT"],
  ["traverse", "TRAVERSE"],
  ["pause", "PAUSE"],
  ["mask", "MASK"],
])
  $(id).onclick = () => action($(id), () => command(type));
$("pair-button").onclick = () =>
  action($("pair-button"), () =>
    command("PAIR", { server: $("server").value, code: $("code").value }),
  );
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
