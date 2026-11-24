import { createHmac, timingSafeEqual } from "node:crypto";

export const recoveryLifetimeSeconds = 15 * 60;

function signProof(sessionId: string, expires: string, secret: string) {
  return createHmac("sha256", secret).update(`sofia-recovery:${sessionId}:${expires}`).digest("hex");
}

export function createRecoveryProof(sessionId: string, secret: string, now = Date.now()) {
  const expires = String(Math.floor(now / 1000) + recoveryLifetimeSeconds);
  return `${expires}.${signProof(sessionId, expires, secret)}`;
}

export function verifyRecoveryProof(proof: string, sessionId: string, secret: string, now = Date.now()) {
  const match = /^(\d{1,12})\.([a-f0-9]{64})$/.exec(proof);
  if (!match) return false;

  const [, expires, signature] = match;
  if (Number(expires) <= Math.floor(now / 1000)) return false;

  return timingSafeEqual(Buffer.from(signature, "hex"), Buffer.from(signProof(sessionId, expires, secret), "hex"));
}
