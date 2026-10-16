import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { capture, isApi, registerLiveAccount, verifyLiveAccount } from "./live-helpers";

test.use({ trace: "off", screenshot: "off", video: "off" });

test("recover a real failed verification delivery through existing-account sign-in and resend", async ({ page }, info) => {
  test.skip(process.env.VITE_USE_MOCK_API !== "false", "Requires an isolated real backend and private E2E mailbox");
  const pending = await registerLiveAccount(page, { failVerificationDelivery: true });
  await expect(page.getByRole("status")).toContainText("Your account was created");
  await expect(page.getByRole("alert")).toContainText("We could not send the verification email");
  expect(await page.evaluate(() => sessionStorage.getItem("clouddrop.access-token") === null)).toBe(true);
  expect((await new AxeBuilder({ page }).analyze()).violations.map(({ id }) => id)).toEqual([]);
  await capture(page, info, "email-delivery-failure-recovery");

  // Reproduce the reporter's retry: the account exists, but is not verified.
  await page.getByRole("button", { name: "Back to registration" }).click();
  await page.getByLabel("Password", { exact: true }).fill(pending.password);
  const duplicate = page.waitForResponse((r) => isApi(r.url(), /\/auth\/register$/));
  await page.getByRole("button", { name: "Create account" }).click();
  expect((await duplicate).status()).toBe(409);
  await expect(page.getByRole("button", { name: "Finish email verification" })).toBeVisible();
  await page.getByRole("link", { name: "Sign in instead" }).click();
  await expect(page.getByLabel("Email address")).toHaveValue(pending.email);
  await page.getByLabel("Password", { exact: true }).fill(pending.password);
  const blocked = page.waitForResponse((r) => isApi(r.url(), /\/auth\/login$/));
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  expect((await blocked).status()).toBe(403);
  await expect(page.getByRole("heading", { name: "Verify your email" })).toBeVisible();
  const resend = page.waitForResponse((r) => isApi(r.url(), /\/auth\/resend-verification$/));
  await page.getByRole("button", { name: "Resend verification code" }).click();
  expect((await resend).status()).toBe(200);
  await expect(page.getByRole("status")).toContainText("If the account is eligible");
  expect((await new AxeBuilder({ page }).analyze()).violations.map(({ id }) => id)).toEqual([]);
  await verifyLiveAccount(page, pending, info);
});

test("authenticate through the live backend", async ({ page, isMobile }, testInfo) => {
  test.skip(process.env.VITE_USE_MOCK_API !== "false", "Requires a backend on port 5000 and VITE_USE_MOCK_API=false");

  const pending = await registerLiveAccount(page, { firstName: "Ada", lastName: "Lovelace" });
  const { email, password, api } = pending;
  const blocked = await page.request.post(api + "auth/login", { data: { email, password } });
  expect(blocked.status()).toBe(403);
  expect((await blocked.json()).error.code).toBe("EMAIL_NOT_VERIFIED");
  expect((await page.request.get(api + "files")).status()).toBe(401);
  await verifyLiveAccount(page, pending, testInfo);

  const restored = page.waitForResponse((response) => response.url().endsWith("/api/v1/auth/me"));
  await page.reload();
  expect((await restored).status()).toBe(200);
  await expect(page.getByRole("heading", { name: /Good to see you, Ada/ })).toBeVisible();

  if (isMobile) await page.getByRole("button", { name: "Open navigation" }).click();
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/login$/);
  expect(await page.evaluate(() => sessionStorage.getItem("clouddrop.access-token") === null)).toBe(true);

  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  const login = page.waitForResponse((response) => response.url().endsWith("/api/v1/auth/login"));
  await page.getByRole("button", { name: "Sign in" }).click();
  expect((await login).status()).toBe(200);
  await expect(page.getByRole("heading", { name: /Good to see you, Ada/ })).toBeVisible();

  if (isMobile) await page.getByRole("button", { name: "Open navigation" }).click();
  await page.getByRole("button", { name: "Sign out" }).click();
  await page.evaluate(() => sessionStorage.setItem("clouddrop.access-token", "expired-token"));
  await page.goto("/files");
  await expect(page).toHaveURL(/\/login$/);
  expect(await page.evaluate(() => sessionStorage.getItem("clouddrop.access-token") === null)).toBe(true);
});
