export function CapturePreview(c, url, onUpload, onRemove) {
  const item = document.createElement("div");
  item.className = "capture";
  const preview = document.createElement(c.kind === "video" ? "video" : "img");
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
  upload.onclick = () => onUpload(upload);
  const remove = document.createElement("button");
  remove.textContent = "Discard local copy";
  remove.className = "quiet";
  remove.onclick = () => onRemove(remove);
  row.append(upload, remove);
  item.append(preview, name, row);
  return item;
}
