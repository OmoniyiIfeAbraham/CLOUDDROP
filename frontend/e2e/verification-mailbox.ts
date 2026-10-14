import { createHash } from "node:crypto";
import { lstat, readFile, unlink } from "node:fs/promises";
import { isAbsolute, join } from "node:path";
import { setTimeout } from "node:timers/promises";
import type { Page } from "@playwright/test";

export const requireVerificationMailbox = async (): Promise<string> => {
  const directory = process.env.CLOUDDROP_E2E_MAILBOX_DIR;
  if (!directory || !isAbsolute(directory)) {
    throw new Error("Live registration requires CLOUDDROP_E2E_MAILBOX_DIR: a private absolute path shared with an isolated NODE_ENV=test backend. Do not run it against production email delivery.");
  }
  const status = await lstat(directory).catch(() => null);
  if (!status?.isDirectory() || (status.mode & 0o077) !== 0) {
    throw new Error("Create the E2E mailbox directory with permissions 0700 before running live registration.");
  }
  return directory;
};

const messagePath = (directory: string, email: string) =>
  join(directory, `${createHash("sha256").update(email.trim().toLowerCase()).digest("hex")}.json`);

export const requireVerificationBackend = async (page: Page): Promise<void> => {
  const directory = await requireVerificationMailbox();
  let instanceId: unknown;
  try {
    const marker = join(directory, ".instance.json");
    const status = await lstat(marker);
    if (!status.isFile() || (status.mode & 0o077) !== 0) throw new Error();
    instanceId = JSON.parse(await readFile(marker, "utf8")).instanceId;
    if (typeof instanceId !== "string" || !instanceId) throw new Error();
  } catch { throw new Error("Start the isolated backend with npm run start:e2e using this private mailbox before live registration."); }
  const response = await page.request.get(new URL("/health", page.url()).toString());
  if (response.status() !== 200 || response.headers()["x-clouddrop-e2e-instance"] !== instanceId) {
    throw new Error("Live registration refused: the target does not match the private E2E backend. No account has been created.");
  }
};

export const readVerificationCode = async (email: string, registeredAfter: number, timeoutMs = 10_000): Promise<string> => {
  const directory = await requireVerificationMailbox();
  const path = messagePath(directory, email);
  const deadline = Date.now() + timeoutMs;
  do {
    const status = await lstat(path).catch((error: NodeJS.ErrnoException) => {
      if (error.code === "ENOENT") return null;
      throw new Error("The E2E mailbox could not be read.");
    });
    if (status) {
      if (!status.isFile() || (status.mode & 0o077) !== 0) {
        throw new Error("E2E verification messages must be private regular files (0600).");
      }
      let message: { to?: unknown; code?: unknown; createdAt?: unknown };
      try { message = JSON.parse(await readFile(path, "utf8")); }
      catch { throw new Error("The E2E verification message is invalid."); }
      if (!message || message.to !== email.trim().toLowerCase() || typeof message.code !== "string" ||
          !/^\d{6}$/.test(message.code) || typeof message.createdAt !== "number") {
        throw new Error("The E2E verification message does not match this registration.");
      }
      if (message.createdAt >= registeredAfter && message.createdAt <= Date.now() + 5_000) {
        return message.code;
      }
    }
    await setTimeout(100);
  } while (Date.now() < deadline);
  throw new Error("No fresh verification message arrived. Check the isolated backend mailbox configuration; no production email provider is used by this test.");
};

export const removeVerificationMessage = async (email: string): Promise<void> => {
  const directory = await requireVerificationMailbox();
  await unlink(messagePath(directory, email)).catch((error: NodeJS.ErrnoException) => {
    if (error.code !== "ENOENT") throw new Error("The E2E verification message could not be removed.");
  });
};
