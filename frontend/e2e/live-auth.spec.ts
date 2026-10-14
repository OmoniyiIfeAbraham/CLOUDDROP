import { expect, test } from "@playwright/test";
import { registerLiveAccount, verifyLiveAccount } from "./live-helpers";

test.use({ trace: "off", screenshot: "off", video: "off" });

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
