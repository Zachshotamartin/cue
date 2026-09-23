export class RequestTooLarge extends Error {}

/** Bound bytes before buffering; Content-Length alone is not trustworthy. */
export async function boundedText(request: Request, limit: number) {
  if (Number(request.headers.get("content-length")) > limit)
    throw new RequestTooLarge();
  if (!request.body) return "";
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > limit) {
        await reader.cancel();
        throw new RequestTooLarge();
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  return Buffer.concat(chunks, length).toString("utf8");
}
