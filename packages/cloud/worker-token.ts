import crypto from "node:crypto";
import { safeEqual } from "../storage/config";
export function workerToken(
  id: string,
  expires = Math.floor(Date.now() / 1000) + 1800,
) {
  const secret = process.env.CUE_SIGNING_SECRET;
  if (!secret) throw new Error("Worker signing secret is missing.");
  return `${expires}.${crypto.createHmac("sha256", secret).update(`render:${id}:${expires}`).digest("hex")}`;
}
export function validWorkerToken(id: string, token: string) {
  const n = Number(token.split(".")[0]);
  return (
    Number.isSafeInteger(n) &&
    n > Date.now() / 1000 &&
    n < Date.now() / 1000 + 3600 &&
    safeEqual(token, workerToken(id, n))
  );
}
