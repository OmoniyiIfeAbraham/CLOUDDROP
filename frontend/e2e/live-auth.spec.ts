import { expect, test } from "@playwright/test";

test("authenticate through the live backend", async ({ page, isMobile }, testInfo) => {
  test.skip(process.env.VITE_USE_MOCK_API !== "false", "Requires a backend on port 5000 and VITE_USE_MOCK_API=false");

  const email = `live-auth-${Date.now()}-${testInfo.project.name}@example.test`;
  const password = "securepass123";

  await page.goto("/register");
  await page.getByLabel("First name").fill("Ada");
  await page.getByLabel("Last name").fill("Lovelace");
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  const registration = page.waitForResponse((response) => response.url().endsWith("/api/v1/auth/register"));
  await page.getByRole("button", { name: "Create account" }).click();
  expect((await registration).status()).toBe(201);
  await expect(page.getByRole("heading", { name: /Good to see you, Ada/ })).toBeVisible();
  expect(await page.evaluate(() => sessionStorage.getItem("clouddrop.access-token"))).toBeTruthy();

  const restored = page.waitForResponse((response) => response.url().endsWith("/api/v1/auth/me"));
  await page.reload();
  expect((await restored).status()).toBe(200);
  await expect(page.getByRole("heading", { name: /Good to see you, Ada/ })).toBeVisible();

  if (isMobile) await page.getByRole("button", { name: "Open navigation" }).click();
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/login$/);
  expect(await page.evaluate(() => sessionStorage.getItem("clouddrop.access-token"))).toBeNull();

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
  expect(await page.evaluate(() => sessionStorage.getItem("clouddrop.access-token"))).toBeNull();
});
