import { expect, test } from "@playwright/test";

test("list and search files through the live backend", async ({ page, isMobile }, testInfo) => {
  test.skip(process.env.VITE_USE_MOCK_API !== "false", "Requires a backend on port 5000 and VITE_USE_MOCK_API=false");

  const email = `live-files-${Date.now()}-${testInfo.project.name}@example.test`;
  await page.goto("/register");
  await page.getByLabel("First name").fill("Ada");
  await page.getByLabel("Last name").fill("Lovelace");
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password", { exact: true }).fill("securepass123");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByRole("heading", { name: /Good to see you, Ada/ })).toBeVisible();

  if (isMobile) await page.getByRole("button", { name: "Open navigation" }).click();
  const list = page.waitForResponse((response) => new URL(response.url()).pathname === "/api/v1/files");
  await page.getByRole("link", { name: "My files" }).click();
  expect((await list).status()).toBe(200);
  await expect(page.getByRole("heading", { name: "Your library is empty" })).toBeVisible();

  const search = page.waitForResponse((response) => {
    const url = new URL(response.url());
    return url.pathname === "/api/v1/files/search" && url.searchParams.get("search") === "report";
  });
  await page.getByRole("searchbox", { name: "Search files" }).fill("report");
  expect((await search).status()).toBe(200);
  await expect(page.getByRole("heading", { name: "No matching files" })).toBeVisible();

  await page.getByRole("button", { name: "Clear filters" }).click();
  await expect(page.getByRole("heading", { name: "Your library is empty" })).toBeVisible();
});
