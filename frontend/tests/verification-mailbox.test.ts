import { createHash } from "node:crypto";
import { chmod, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Page } from "@playwright/test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readVerificationCode, removeVerificationMessage, requireVerificationBackend, requireVerificationMailbox } from "../e2e/verification-mailbox";

describe("Live verification mailbox reader", () => {
  let directory: string;
  const email = "qa-reader@example.test";
  const code = "874123";
  const filename = createHash("sha256").update(email).digest("hex") + ".json";
  const createMessage = async (data: object, mode = 0o600) => {
    await writeFile(join(directory, filename), JSON.stringify(data), { mode });
  };

  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), "clouddrop-reader-test-"));
    vi.stubEnv("CLOUDDROP_E2E_MAILBOX_DIR", directory);
  });
  afterEach(async () => {
    vi.unstubAllEnvs();
    await rm(directory, { recursive: true, force: true });
  });

  it("reads only this registration's code, then removes the message", async () => {
    const registeredAfter = Date.now();
    await createMessage({ to: email, code, createdAt: registeredAfter });
    expect(await readVerificationCode(email, registeredAfter)).toBe(code);
    await removeVerificationMessage(email);
    await expect(readFile(join(directory, filename))).rejects.toMatchObject({ code: "ENOENT" });
  });
  it("rejects absent configuration before registration", async () => {
    vi.stubEnv("CLOUDDROP_E2E_MAILBOX_DIR", "");
    await expect(requireVerificationMailbox()).rejects.toThrow("Do not run it against production");
  });
  it("rejects stale delivery without including its code in the error", async () => {
    await createMessage({ to: email, code, createdAt: Date.now() - 60_000 });
    await expect(readVerificationCode(email, Date.now(), 1)).rejects.toThrow("No fresh verification message");
  });
  it("rejects another recipient, malformed codes and public messages", async () => {
    await createMessage({ to: "someone-else@example.test", code, createdAt: Date.now() });
    await expect(readVerificationCode(email, 0)).rejects.toThrow("does not match");
    await createMessage({ to: email, code: "bad-code", createdAt: Date.now() });
    await expect(readVerificationCode(email, 0)).rejects.toThrow("does not match");
    await chmod(join(directory, filename), 0o644);
    await expect(readVerificationCode(email, 0)).rejects.toThrow("private regular files");
  });
  it("refuses symlink messages and public directories", async () => {
    const target = join(directory, "message.json");
    await writeFile(target, JSON.stringify({ to: email, code, createdAt: Date.now() }), { mode: 0o600 });
    await symlink(target, join(directory, filename));
    await expect(readVerificationCode(email, 0)).rejects.toThrow("private regular files");
    await chmod(directory, 0o755);
    await expect(requireVerificationMailbox()).rejects.toThrow("0700");
  });
  it("refuses the target before registration unless its private instance marker matches", async () => {
    await writeFile(join(directory, ".instance.json"), JSON.stringify({ instanceId: "test-run-instance" }), { mode: 0o600 });
    const page = (header: string | undefined) => ({
      url: () => "http://127.0.0.1:4177/register",
      request: { get: vi.fn().mockResolvedValue({ status: () => 200, headers: () => ({ "x-clouddrop-e2e-instance": header }) }) },
    }) as unknown as Page;
    await expect(requireVerificationBackend(page(undefined))).rejects.toThrow("No account has been created");
    await expect(requireVerificationBackend(page("another-run"))).rejects.toThrow("No account has been created");
    await expect(requireVerificationBackend(page("test-run-instance"))).resolves.toBeUndefined();
  });
});
