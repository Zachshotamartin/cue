import type { Asset, Draft } from "../contracts";
import type { EvidenceAnalysis } from "../contracts/evidence";
export function evidenceAssets(draft: Draft, assets: Asset[]) {
  return assets.filter(
    (a) =>
      a.kind !== "audio" &&
      !a.metadata.privacyPending &&
      !a.metadata.supersededBy &&
      !draft.excludedAssetIds.includes(a.id) &&
      !["generated", "export", "export-poster"].includes(
        String(a.metadata.state),
      ),
  );
}
export function rankCaptures(draft: Draft, assets: Asset[], limit = 5) {
  const candidates = evidenceAssets(draft, assets);
  const seenHashes = new Set<string>(),
    seenFamilies = new Set<string>();
  return candidates
    .sort((a, b) => {
      const score = (a: Asset) => {
        const analysis = a.metadata.analysis as EvidenceAnalysis | undefined;
        const text = [
          a.name,
          a.metadata.title,
          a.metadata.state,
          a.metadata.text,
          ...(analysis?.segments?.map((s) => s.label) || []),
        ]
          .join(" ")
          .toLowerCase();
        const priorities = [...draft.features, draft.journey].filter(Boolean);
        const matches = priorities.reduce((total, feature) => {
          const words = feature.toLowerCase().match(/[a-z0-9]{3,}/g) || [];
          return (
            total +
            (words.length
              ? words.filter((w) => text.includes(w)).length / words.length
              : 0)
          );
        }, 0);
        return (
          matches * 10 +
          (a.kind === "video" ? 4 : 0) +
          (analysis?.segments?.some((s) => s.event?.type === "result")
            ? 4
            : 0) +
          (a.metadata.text ? 1 : 0) -
          (a.metadata.warnings?.length || 0)
        );
      };
      return score(b) - score(a);
    })
    .filter((a) => {
      if (seenHashes.has(a.hash)) return false;
      seenHashes.add(a.hash);
      return true;
    })
    .filter((a) => {
      const key =
        a.metadata.url && a.kind !== "video"
          ? new URL(a.metadata.url).pathname.replace(/\/\d+(?=\/|$)/g, "/:id") +
            String(a.metadata.state || "")
          : a.id;
      if (seenFamilies.has(key)) return false;
      seenFamilies.add(key);
      return true;
    })
    .slice(0, limit);
}
