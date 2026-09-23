export function RouteOption(r, onChange) {
  const label = document.createElement("label"),
    checkbox = document.createElement("input"),
    text = document.createElement("span");
  checkbox.type = "checkbox";
  checkbox.checked = r.selected;
  text.textContent = `${r.label} ${r.state === "captured" ? "✓" : r.state === "failed" ? "(retry needed)" : ""}`;
  checkbox.onchange = () => {
    onChange(checkbox.checked);
  };
  label.append(checkbox, text);
  return label;
}
