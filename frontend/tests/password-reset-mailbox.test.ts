import { createHash } from "node:crypto";
import { chmod, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readPasswordResetLink, removePasswordResetMessage } from "../e2e/password-reset-mailbox";

describe("private reset link reader", () => {
  let directory: string;
  const email = "qa-reset-reader@example.test";
  const origin = "http://127.0.0.1:4177";
  const resetLink = `${origin}/reset-password?token=disposable-token`;
  const filename = createHash("sha256").update(email).digest("hex") + ".reset.json";
  const write = async (data: object) => writeFile(join(directory, filename), JSON.stringify(data), { mode: 0o600 });
  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), "clouddrop-reset-reader-"));
    vi.stubEnv("CLOUDDROP_E2E_MAILBOX_DIR", directory);
  });
  afterEach(async () => { vi.unstubAllEnvs(); await rm(directory, { recursive: true, force: true }); });
  it("reads a fresh request then deletes the private link", async () => {
    const requestedAfter = Date.now();
    await write({ to: email, resetLink, createdAt: requestedAfter });
    expect(await readPasswordResetLink(email, requestedAfter, origin)).toBe(resetLink);
    await removePasswordResetMessage(email);
    await expect(readFile(join(directory, filename))).rejects.toMatchObject({ code: "ENOENT" });
  });
  it("rejects stale, public and mismatched-origin messages without exposing the URL", async () => {
    await write({ to: email, resetLink, createdAt: Date.now() - 60_000 });
    await expect(readPasswordResetLink(email, Date.now(), origin, 1)).rejects.toThrow("No fresh password-reset message");
    await write({ to: email, resetLink, createdAt: Date.now() });
    await expect(readPasswordResetLink(email, 0, "https://example.test")).rejects.toThrow("link and token omitted");
    await chmod(join(directory, filename), 0o644);
    await expect(readPasswordResetLink(email, 0, origin)).rejects.toThrow("private regular files");
  });
  it("rejects another recipient or a reset URL without a token", async () => {
    await write({ to: "qa-another@example.test", resetLink, createdAt: Date.now() });
    await expect(readPasswordResetLink(email, 0, origin)).rejects.toThrow("does not match");
    await write({ to: email, resetLink: `${origin}/reset-password`, createdAt: Date.now() });
    await expect(readPasswordResetLink(email, 0, origin)).rejects.toThrow("does not match");
  });
});
