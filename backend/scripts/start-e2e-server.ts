import { randomUUID } from "node:crypto";
import { createServer } from "node:http";
import { lstat, unlink, writeFile } from "node:fs/promises";
import { isAbsolute, join } from "node:path";

// Run only against an isolated database. Normal application startup never mounts
// this wrapper or exposes the test-instance header.
const directory = process.env.CLOUDDROP_E2E_MAILBOX_DIR;
if (process.env.NODE_ENV !== "test" || !directory || !isAbsolute(directory)) {
  throw new Error("E2E startup requires NODE_ENV=test and an absolute CLOUDDROP_E2E_MAILBOX_DIR.");
}
const directoryStatus = await lstat(directory);
if (!directoryStatus.isDirectory() || (directoryStatus.mode & 0o077) !== 0) {
  throw new Error("Create a private E2E mailbox directory (0700) first.");
}
const port = Number(process.env.PORT ?? 5000);
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error("The E2E backend PORT must be between 1 and 65535.");
}
const { default: app } = await import("../src/server.js");
const marker = join(directory, ".instance.json");
const instanceId = randomUUID();
await writeFile(marker, JSON.stringify({ instanceId }), { flag: "wx", mode: 0o600 });

const server = createServer((req, res) => {
  if (req.url === "/health") res.setHeader("X-CloudDrop-E2E-Instance", instanceId);
  app(req, res);
});
server.on("error", async (error) => {
  await unlink(marker).catch(() => {});
  console.error(error.message);
  process.exit(1);
});
server.listen(port, "127.0.0.1", () => {
  console.info("Isolated CloudDrop E2E backend is ready on loopback.");
});
for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.once(signal, () => {
    server.close(() => {
      void unlink(marker).catch(() => {}).finally(() => process.exit(0));
    });
  });
}
