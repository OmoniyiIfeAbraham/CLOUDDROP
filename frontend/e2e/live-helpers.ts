import { expect, type Page, type TestInfo } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { stripVTControlCharacters } from "node:util";

export const isApi = (url: string, suffix: RegExp) => suffix.test(new URL(url).pathname);
export const capture = async (page: Page, info: TestInfo, name: string) => {
  const path = info.outputPath(`${name}.png`);
  await page.screenshot({ path, fullPage: true, mask: [page.getByRole("textbox", { name: "Temporary link" })] });
  await info.attach(name, { path, contentType: "image/png" });
};
export const openPage = async (page: Page, name: "Overview" | "My files" | "Upload") => {
  const opener = page.getByRole("button", { name: "Open navigation" });
  if (await opener.isVisible()) await opener.click();
  await page.getByRole("link", { name, exact: true }).click();
};

export const liveAccount = async (page: Page, info: TestInfo) => {
  const prefix = `qa-${Date.now()}-${randomUUID().slice(0, 8)}`;
  await page.goto("/register");
  await page.getByLabel("First name").fill("QA");
  await page.getByLabel("Last name").fill("Review");
  await page.getByLabel("Email address").fill(`${prefix}@example.test`);
  await page.getByLabel("Password", { exact: true }).fill("CloudDrop-QA-2026!");
  const registered = page.waitForResponse((r) => isApi(r.url(), /\/api\/v1\/auth\/register$/));
  await page.getByRole("button", { name: "Create account" }).click();
  const response = await registered;
  expect(response.status()).toBe(201);
  const payload = await response.json();
  const token: string = payload.data.token;
  expect(token).toBeTruthy();
  await expect(page.getByRole("heading", { name: /Good to see you, QA/ })).toBeVisible();
  const headers = { Authorization: `Bearer ${token}` };
  const api = new URL("/api/v1/", page.url()).toString();
  const cleanup = async () => {
    const response = await page.request.get(api + "files?limit=100", { headers });
    expect(response.status(), "Cleanup must list the disposable account's files").toBe(200);
    const payload = await response.json();
    const files: { id: string; originalName: string }[] = payload.data.files;
    for (const file of files) {
      if (!file.originalName.startsWith(prefix)) throw new Error("Unexpected file in the disposable account; cleanup refused");
      const deleted = await page.request.delete(api + "files/" + encodeURIComponent(file.id), { headers });
      expect(deleted.status(), `Cleanup of ${file.originalName}`).toBe(200);
    }
    const remaining = await page.request.get(api + "files?limit=100", { headers });
    expect((await remaining.json()).data.pagination.total, "All QA uploads must be removed").toBe(0);
    await info.attach("cleanup", { body: JSON.stringify({ uploadedFilesRemoved: files.length, remaining: 0 }), contentType: "application/json" });
  };
  return { prefix, headers, api, cleanup };
};

export const checks = (info: TestInfo) => {
  const records: { check: string; expected: string; status: "PASS" | "FAIL"; actual: string }[] = [];
  return {
    async run(name: string, expected: string, task: () => Promise<void>) {
      try {
        await task();
        records.push({ check: name, expected, status: "PASS", actual: "Matched expected result" });
      } catch (error) {
        const message = stripVTControlCharacters(String(error).replace(/https?:\/\/[^\s"'<>]+/g, "[URL redacted]"));
        records.push({ check: name, expected, status: "FAIL", actual: message.slice(0, 1600) });
        expect.soft(message, name).toBe("");
      }
    },
    async save() {
      await info.attach("qa-checks", { body: JSON.stringify(records, null, 2), contentType: "application/json" });
    },
  };
};
