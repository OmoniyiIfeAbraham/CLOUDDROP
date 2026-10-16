import { createHash } from "node:crypto";
import { chmod, lstat, mkdtemp, readFile, readdir, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sendPasswordResetEmail, sendVerificationEmail } from "../src/services/email.service.js";
import { validateEnv } from "../src/utils/env.utils.js";

describe("Private E2E verification delivery", () => {
  let directory: string;
  const recipient = "qa-mailbox-test@example.test";
  const code = "874123";

  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), "clouddrop-mailbox-test-"));
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("CLOUDDROP_E2E_MAILBOX_DIR", directory);
    // Even if credentials exist, the test transport must not call Resend.
    vi.stubEnv("RESEND_API_KEY", "test-provider-key");
    vi.stubEnv("EMAIL_FROM", "noreply@example.test");
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("Network delivery must not occur")));
    vi.spyOn(console, "info").mockImplementation(() => {});
  });

  afterEach(async () => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    await rm(directory, { recursive: true, force: true });
  });

  it("delivers a private recipient-specific message without email or code logging", async () => {
    await sendVerificationEmail({ to: recipient, firstName: "QA", code });
    const name = createHash("sha256").update(recipient).digest("hex") + ".json";
    expect(await readdir(directory)).toEqual([name]);
    expect((await lstat(join(directory, name))).mode & 0o777).toBe(0o600);
    expect(JSON.parse(await readFile(join(directory, name), "utf8"))).toEqual({
      to: recipient, code, createdAt: expect.any(Number),
    });
    expect(fetch).not.toHaveBeenCalled();
    expect(console.info).not.toHaveBeenCalled();
  });

  it("keeps concurrent recipients separate and replaces a resent code atomically", async () => {
    await Promise.all([
      sendVerificationEmail({ to: recipient, firstName: "QA", code }),
      sendVerificationEmail({ to: "qa-another@example.test", firstName: "QA", code: "987654" }),
    ]);
    await sendVerificationEmail({ to: recipient, firstName: "QA", code: "345678" });
    const messages = await Promise.all((await readdir(directory)).map(async (name) => JSON.parse(await readFile(join(directory, name), "utf8"))));
    expect(messages).toHaveLength(2);
    expect(messages.find(message => message.to === recipient).code).toBe("345678");
  });

  it("delivers reset links privately without overwriting verification messages or using Resend/logging", async () => {
    const resetLink = "http://127.0.0.1:4177/reset-password?token=disposable-test-token";
    await sendVerificationEmail({ to: recipient, firstName: "QA", code });
    await sendPasswordResetEmail({ to: recipient, firstName: "QA", resetLink });
    const id = createHash("sha256").update(recipient).digest("hex");
    expect((await readdir(directory)).sort()).toEqual([`${id}.json`, `${id}.reset.json`].sort());
    expect((await lstat(join(directory, `${id}.reset.json`))).mode & 0o777).toBe(0o600);
    expect(JSON.parse(await readFile(join(directory, `${id}.reset.json`), "utf8"))).toEqual({ to: recipient, resetLink, createdAt: expect.any(Number) });
    expect(fetch).not.toHaveBeenCalled();
    expect(console.info).not.toHaveBeenCalled();
  });

  it("refuses reset test delivery outside the isolated environment and to real recipients", async () => {
    const message = { to: recipient, firstName: "QA", resetLink: "http://127.0.0.1/reset-password?token=test" };
    vi.stubEnv("NODE_ENV", "production");
    await expect(sendPasswordResetEmail(message)).rejects.toThrow("NODE_ENV=test");
    vi.stubEnv("NODE_ENV", "test");
    await expect(sendPasswordResetEmail({ ...message, to: "customer@example.com" })).rejects.toThrow("disposable QA recipient");
    expect(await readdir(directory)).toEqual([]);
    expect(fetch).not.toHaveBeenCalled();
  });

  it.each(["production", "development"])("refuses test delivery and startup in %s", async (mode) => {
    vi.stubEnv("NODE_ENV", mode);
    await expect(sendVerificationEmail({ to: recipient, firstName: "QA", code })).rejects.toThrow("NODE_ENV=test");
    expect(() => validateEnv()).toThrow("NODE_ENV=test");
    expect(await readdir(directory)).toEqual([]);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("rejects real recipients and a mailbox that other users can read", async () => {
    await expect(sendVerificationEmail({ to: "customer@example.com", firstName: "Customer", code })).rejects.toThrow("disposable QA recipient");
    await chmod(directory, 0o755);
    await expect(sendVerificationEmail({ to: recipient, firstName: "QA", code })).rejects.toThrow("private directory");
    expect(await readdir(directory)).toEqual([]);
  });

  it("refuses a symlink used as the mailbox directory", async () => {
    const alias = directory + "-alias";
    await symlink(directory, alias);
    vi.stubEnv("CLOUDDROP_E2E_MAILBOX_DIR", alias);
    try {
      await expect(sendVerificationEmail({ to: recipient, firstName: "QA", code })).rejects.toThrow("private directory");
    } finally { await rm(alias); }
  });
});
