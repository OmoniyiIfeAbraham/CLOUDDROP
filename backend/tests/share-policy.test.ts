import { describe, expect, it } from "vitest";
import {
  createShareToken,
  isShareExpired,
  resolveShareExpiry,
} from "../src/lib/share-policy.js";

describe("Share policy", () => {
  it("creates a 64-character hex token", () => {
    const token = createShareToken();
    expect(token).toMatch(/^[a-f0-9]{64}$/);
  });

  it("creates unique tokens", () => {
    expect(createShareToken()).not.toBe(createShareToken());
  });

  it("expires shares after the configured TTL", () => {
    const now = new Date("2026-10-05T12:00:00.000Z");
    const expiresAt = resolveShareExpiry(24, now);
    expect(expiresAt.toISOString()).toBe("2026-10-06T12:00:00.000Z");
    expect(isShareExpired(expiresAt, now)).toBe(false);
    expect(isShareExpired(expiresAt, new Date("2026-10-06T12:00:01.000Z"))).toBe(
      true
    );
  });

  it("rejects invalid TTL values", () => {
    expect(() => resolveShareExpiry(0)).toThrow();
    expect(() => resolveShareExpiry(200)).toThrow();
  });
});
