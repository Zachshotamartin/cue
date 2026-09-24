/** A persisted, user-driven checklist. Cue never clicks consequential actions for the user. */
export function JourneyChecklist(text, completed, recording, onComplete) {
  const list = document.createElement("ol");
  list.className = "journey-checklist";
  for (const [index, label] of text
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 12)
    .entries()) {
    const item = document.createElement("li"),
      button = document.createElement("button");
    button.className = "quiet";
    button.textContent = `${completed.includes(index) ? "✓ " : ""}${label}`;
    button.disabled = completed.includes(index) || !recording;
    button.title = recording
      ? "Mark this step and its visible result"
      : "Start recording to mark this step";
    button.onclick = () => onComplete(index, label);
    item.append(button);
    list.append(item);
  }
  return list;
}
