import { createHash, randomUUID } from "node:crypto";
import { lstat, mkdir, rename, unlink, writeFile } from "node:fs/promises";
import { isAbsolute, join } from "node:path";

/** Private transport for an isolated E2E backend; never a public code endpoint. */
export const deliverToTestMailbox = async (to: string, code: string): Promise<boolean> => {
  const directory = process.env.CLOUDDROP_E2E_MAILBOX_DIR;
  if (!directory) return false;
  if (process.env.NODE_ENV !== "test") {
    throw new Error("The E2E mailbox requires NODE_ENV=test.");
  }

  const recipient = to.trim().toLowerCase();
  if (!isAbsolute(directory) || !/^qa-[a-z0-9-]+@example\.test$/.test(recipient)) {
    throw new Error("The E2E mailbox requires an absolute directory and a disposable QA recipient.");
  }
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const status = await lstat(directory);
  if (!status.isDirectory() || (status.mode & 0o077) !== 0) {
    throw new Error("The E2E mailbox must be a private directory (0700).");
  }

  const recipientId = createHash("sha256").update(recipient).digest("hex");
  const temporary = join(directory, `.${recipientId}-${randomUUID()}.tmp`);
  try {
    await writeFile(temporary, JSON.stringify({ to: recipient, code, createdAt: Date.now() }), {
      flag: "wx", mode: 0o600,
    });
    await rename(temporary, join(directory, `${recipientId}.json`));
  } finally {
    await unlink(temporary).catch((error: NodeJS.ErrnoException) => {
      if (error.code !== "ENOENT") throw error;
    });
  }
  return true;
};
