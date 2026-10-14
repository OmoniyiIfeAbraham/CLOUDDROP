import { describe, expect, it } from "vitest";
import {
  createShareToken,
  isShareExpired,
  resolveShareExpiry,
} from "../src/lib/share-policy.js";

describe("Share policy", () => {
  it("creates a 16-character URL-safe token", () => {
    const token = createShareToken();
    expect(token).toMatch(/^[A-Za-z0-9_-]{16}$/);
  });

  it("creates unique tokens", () => {
    expect(createShareToken()).not.toBe(createShareToken());
  });

  it("expires shares after the configured 24-hour TTL", () => {
    const now = new Date("2026-10-05T12:00:00.000Z");
    const expiresAt = resolveShareExpiry(24, now);

    expect(expiresAt.toISOString()).toBe("2026-10-06T12:00:00.000Z");
    expect(isShareExpired(expiresAt, now)).toBe(false);
    expect(
      isShareExpired(expiresAt, new Date("2026-10-06T12:00:01.000Z")),
    ).toBe(true);
  });

  it("supports a 1-hour share expiry", () => {
    const now = new Date("2026-10-05T12:00:00.000Z");
    const expiresAt = resolveShareExpiry(1, now);

    expect(expiresAt.toISOString()).toBe("2026-10-05T13:00:00.000Z");
  });

  it("supports the maximum 7-day share expiry", () => {
    const now = new Date("2026-10-05T12:00:00.000Z");
    const expiresAt = resolveShareExpiry(168, now);

    expect(expiresAt.toISOString()).toBe("2026-10-12T12:00:00.000Z");
  });

  it("rejects invalid TTL values", () => {
    expect(() => resolveShareExpiry(0)).toThrow();
    expect(() => resolveShareExpiry(200)).toThrow();
  });

  it("rejects a share expiry above 7 days", () => {
    expect(() => resolveShareExpiry(169)).toThrow(
      "Share TTL must be 1, 24, or 168 hours",
    );
  });

  it("rejects durations other than 1, 24, or 168 hours", () => {
    expect(() => resolveShareExpiry(2)).toThrow(
      "Share TTL must be 1, 24, or 168 hours",
    );
  });
});
