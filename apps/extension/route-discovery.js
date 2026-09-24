import { normalizeRoute, family } from "./shared.js";
/** New discoveries are offered for review, never silently added to traversal. */
export function mergeRoutes(existing, links, base, initiallySelected = false) {
  const routes = [...existing],
    seen = new Set(routes.map((r) => r.url));
  const selectedFamilies = new Set(
    routes.filter((r) => r.selected).map((r) => r.family),
  );
  for (const link of links) {
    const url = normalizeRoute(link.href, base);
    if (!url || seen.has(url) || routes.length >= 100) continue;
    seen.add(url);
    const group = family(url);
    const selected =
      initiallySelected &&
      !selectedFamilies.has(group) &&
      selectedFamilies.size < 25;
    if (selected) selectedFamilies.add(group);
    routes.push({
      url,
      label: String(link.label || new URL(url).pathname).slice(0, 100),
      family: group,
      selected,
      state: "pending",
    });
  }
  return routes;
}
