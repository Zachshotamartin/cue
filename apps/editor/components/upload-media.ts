import { api } from "./client-api";
import type { Asset, CaptureMetadata } from "../../../packages/contracts";
export async function uploadMedia(
  projectId: string,
  file: File,
  metadata: CaptureMetadata = {},
) {
  if (file.size > 64 * 1024 * 1024)
    throw Error(`${file.name} exceeds the 64 MiB file limit.`);
  const digest = Array.from(
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", await file.arrayBuffer()),
    ),
  )
    .map((n) => n.toString(16).padStart(2, "0"))
    .join("");
  const upload = await api(`/projects/${projectId}/uploads`, {
    method: "POST",
    body: JSON.stringify({
      name: file.name,
      bytes: file.size,
      hash: digest,
      metadata,
    }),
  });
  if (upload.assetId)
    return (
      await api<{ asset: Asset }>(`/uploads/${upload.id}/complete`, {
        method: "POST",
      })
    ).asset;
  for (let i = 0; i < upload.chunks; i++)
    if (!upload.received?.includes(i))
      await api(`/uploads/${upload.id}/chunks/${i}`, {
        method: "PUT",
        body: file.slice(i * 1048576, (i + 1) * 1048576),
      });
  return (
    await api<{ asset: Asset }>(`/uploads/${upload.id}/complete`, {
      method: "POST",
    })
  ).asset;
}
