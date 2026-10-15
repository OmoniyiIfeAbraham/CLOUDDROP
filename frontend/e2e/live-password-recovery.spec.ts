import { expect, test } from "@playwright/test";
import { isApi, liveAccount } from "./live-helpers";
import { readPasswordResetLink, removePasswordResetMessage } from "./password-reset-mailbox";
import { requireVerificationBackend } from "./verification-mailbox";

test.use({ trace: "off", screenshot: "off", video: "off" });

test("reset through a private email link, sign in with the new password and reject reuse", async ({ page, isMobile }, info) => {
  test.skip(process.env.VITE_USE_MOCK_API !== "false", "Requires an isolated real backend and private E2E mailbox");
  const account = await liveAccount(page, info);
  if (isMobile) await page.getByRole("button", { name: "Open navigation" }).click();
  await page.getByRole("button", { name: "Sign out" }).click();
  await page.getByRole("link", { name: "Forgot password?" }).click();
  await requireVerificationBackend(page);
  const requestedAfter = Date.now();
  await page.getByLabel("Email address").fill(account.email);
  const requested = page.waitForResponse((response) => isApi(response.url(), /\/auth\/forgot-password$/));
  await page.getByRole("button", { name: "Send reset link" }).click();
  const response = await requested;
  expect(response.status()).toBe(200);
  const knownBody = await response.json();
  const unknown = await page.request.post(account.api + "auth/forgot-password", { data: { email: `qa-unknown-${Date.now()}@example.test` } });
  expect(unknown.status()).toBe(200);
  expect(await unknown.json()).toEqual(knownBody);
  await expect(page.getByRole("heading", { name: "Check your email" })).toBeVisible();

  let link: string;
  try {
    link = await readPasswordResetLink(account.email, requestedAfter, new URL(page.url()).origin);
    await page.goto(link);
    const newPassword = "CloudDrop-New-QA-2026!";
    await page.getByLabel("New password", { exact: true }).fill(newPassword);
    await page.getByLabel("Confirm password", { exact: true }).fill(newPassword);
    await page.getByRole("button", { name: "Reset password", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Password updated" })).toBeVisible();
    expect(new URL(page.url()).searchParams.has("token")).toBe(false);
    const oldLogin = await page.request.post(account.api + "auth/login", { data: { email: account.email, password: account.password } });
    expect(oldLogin.status()).toBe(401);
    await page.getByRole("link", { name: "Sign in", exact: true }).click();
    await page.getByLabel("Email address").fill(account.email);
    await page.getByLabel("Password", { exact: true }).fill(newPassword);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Good to see you, QA" })).toBeVisible();
    // A logged-in user must still be able to open a reset link.
    await page.goto(link);
    await page.getByLabel("New password", { exact: true }).fill(newPassword);
    await page.getByLabel("Confirm password", { exact: true }).fill(newPassword);
    await page.getByRole("button", { name: "Reset password", exact: true }).click();
    await expect(page.getByRole("heading", { name: "This reset link is no longer valid" })).toBeVisible();
  } catch {
    // Browser navigation errors can include the reset URL; never attach it.
    throw new Error("Live password recovery did not complete; reset links, tokens and request payloads omitted.");
  } finally {
    await removePasswordResetMessage(account.email);
  }
});
