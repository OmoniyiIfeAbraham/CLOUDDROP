import { expect, type Page, type TestInfo } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { stripVTControlCharacters } from "node:util";
import { readVerificationCode, removeVerificationMessage, requireVerificationBackend, requireVerificationMailbox } from "./verification-mailbox";

export const isApi = (url: string, suffix: RegExp) => suffix.test(new URL(url).pathname);
export const capture = async (page: Page, info: TestInfo, name: string) => {
  const path = info.outputPath(`${name}.png`);
  await page.screenshot({ path, fullPage: true, mask: [
    page.getByRole("textbox", { name: "Temporary link" }),
    page.getByLabel("Verification code", { exact: true }),
    page.getByLabel("Password", { exact: true }),
  ] });
  await info.attach(name, { path, contentType: "image/png" });
};
export const openPage = async (page: Page, name: "Overview" | "My files" | "Upload") => {
  const opener = page.getByRole("button", { name: "Open navigation" });
  if (await opener.isVisible()) await opener.click();
  await page.getByRole("link", { name, exact: true }).click();
};

interface LiveProfile { firstName?: string; lastName?: string }

export const registerLiveAccount = async (page: Page, profile: LiveProfile = {}) => {
  // Fail before creating an account if no private test delivery channel exists.
  await requireVerificationMailbox();
  const prefix = `qa-${Date.now()}-${randomUUID().slice(0, 8)}`;
  const firstName = profile.firstName ?? "QA";
  const email = `${prefix}@example.test`;
  const password = "CloudDrop-QA-2026!";
  const registeredAfter = Date.now();
  await page.goto("/register");
  await requireVerificationBackend(page);
  await page.getByLabel("First name").fill(firstName);
  await page.getByLabel("Last name").fill(profile.lastName ?? "Review");
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  const registered = page.waitForResponse((r) => isApi(r.url(), /\/api\/v1\/auth\/register$/));
  await page.getByRole("button", { name: "Create account" }).click();
  const response = await registered;
  expect(response.status()).toBe(201);
  const payload = await response.json();
  expect(payload.data.token === undefined, "Registration must not return a session token").toBe(true);
  expect(await page.evaluate(() => sessionStorage.getItem("clouddrop.access-token") === null)).toBe(true);
  await expect(page.getByRole("heading", { name: "Verify your email", exact: true })).toBeVisible();
  return { prefix, email, password, firstName, registeredAfter, api: new URL("/api/v1/", page.url()).toString() };
};

export const verifyLiveAccount = async (page: Page, pending: Awaited<ReturnType<typeof registerLiveAccount>>, info: TestInfo) => {
  let token: string;
  try {
    const code = await readVerificationCode(pending.email, pending.registeredAfter);
    // Catch browser errors here: locator.fill errors can include the supplied code.
    try {
      await page.getByLabel("Verification code", { exact: true }).fill(code);
      const [response] = await Promise.all([
        page.waitForResponse((r) => isApi(r.url(), /\/api\/v1\/auth\/verify-email$/) && r.request().method() === "POST"),
        page.getByRole("button", { name: "Verify email", exact: true }).click(),
      ]);
      if (response.status() !== 200) throw new Error();
      const payload = await response.json();
      if (typeof payload.data?.token !== "string" || !payload.data.token) throw new Error();
      token = payload.data.token;
    } catch { throw new Error("Email verification did not complete successfully; verification codes and request payloads are omitted."); }
  } finally {
    const input = page.getByLabel("Verification code", { exact: true });
    if (await input.count()) await input.fill("").catch(() => {});
    await removeVerificationMessage(pending.email);
  }
  await expect(page.getByRole("heading", { name: `Good to see you, ${pending.firstName}` })).toBeVisible();
  expect(await page.evaluate(() => !!sessionStorage.getItem("clouddrop.access-token"))).toBe(true);
  const { prefix, api } = pending;
  const headers = { Authorization: `Bearer ${token}` };
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
  return { ...pending, token, headers, cleanup };
};

export const liveAccount = async (page: Page, info: TestInfo, profile: LiveProfile = {}) =>
  verifyLiveAccount(page, await registerLiveAccount(page, profile), info);

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
