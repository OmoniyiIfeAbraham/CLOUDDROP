import { createHash } from "node:crypto";
import { lstat, readFile, unlink } from "node:fs/promises";
import { join } from "node:path";
import { setTimeout } from "node:timers/promises";
import { requireVerificationMailbox } from "./verification-mailbox";

const messagePath = (directory: string, email: string) => join(directory,
  `${createHash("sha256").update(email.trim().toLowerCase()).digest("hex")}.reset.json`);

export const readPasswordResetLink = async (email: string, requestedAfter: number, frontendOrigin: string, timeoutMs = 10_000): Promise<string> => {
  const path = messagePath(await requireVerificationMailbox(), email);
  const deadline = Date.now() + timeoutMs;
  do {
    const status = await lstat(path).catch((error: NodeJS.ErrnoException) => {
      if (error.code === "ENOENT") return null;
      throw new Error("The private reset mailbox could not be read.");
    });
    if (status) {
      if (!status.isFile() || (status.mode & 0o077) !== 0) throw new Error("Reset messages must be private regular files (0600).");
      try {
        const message = JSON.parse(await readFile(path, "utf8"));
        if (message.to !== email.trim().toLowerCase() || typeof message.resetLink !== "string" || typeof message.createdAt !== "number") throw new Error();
        const link = new URL(message.resetLink);
        if (link.origin !== frontendOrigin || link.pathname !== "/reset-password" ||
          link.username || link.password || link.searchParams.getAll("token").length !== 1 || !link.searchParams.get("token")) throw new Error();
        if (message.createdAt >= requestedAfter && message.createdAt <= Date.now() + 5_000) return link.toString();
      } catch { throw new Error("The reset message does not match this request and frontend origin; link and token omitted."); }
    }
    await setTimeout(100);
  } while (Date.now() < deadline);
  throw new Error("No fresh password-reset message arrived in the isolated mailbox.");
};

export const removePasswordResetMessage = async (email: string): Promise<void> => {
  await unlink(messagePath(await requireVerificationMailbox(), email)).catch((error: NodeJS.ErrnoException) => {
    if (error.code !== "ENOENT") throw new Error("The reset message could not be removed.");
  });
};
