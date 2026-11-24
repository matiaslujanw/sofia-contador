import { describe, expect, it } from "vitest";
import { createRecoveryProof, recoveryLifetimeSeconds, verifyRecoveryProof } from "./recovery-proof";

const sessionId = "sesion-original";
const secret = "a".repeat(64);
const now = 1_700_000_000_000;

describe("prueba de sesión de recuperación", () => {
  it("se vincula a la sesión que verificó el enlace y vence a los 15 minutos", () => {
    const proof = createRecoveryProof(sessionId, secret, now);

    expect(verifyRecoveryProof(proof, sessionId, secret, now)).toBe(true);
    expect(verifyRecoveryProof(proof, "otra-sesion", secret, now)).toBe(false);
    expect(verifyRecoveryProof(proof, sessionId, secret, now + recoveryLifetimeSeconds * 1000)).toBe(false);
  });

  it("rechaza valores modificados y secretos diferentes", () => {
    const proof = createRecoveryProof(sessionId, secret, now);
    const [expiry, signature] = proof.split(".");

    expect(verifyRecoveryProof(`9${expiry}.${signature}`, sessionId, secret, now)).toBe(false);
    expect(verifyRecoveryProof(proof, sessionId, "b".repeat(64), now)).toBe(false);
    expect(verifyRecoveryProof(`${expiry}.no-firmado`, sessionId, secret, now)).toBe(false);
  });
});
