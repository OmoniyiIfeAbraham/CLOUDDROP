import { expect, test } from "@playwright/test";
import type { Page, TestInfo } from "@playwright/test";
import { readFile } from "node:fs/promises";

const capture = async (page: Page, testInfo: TestInfo, name: string) => {
  const path = testInfo.outputPath(`${name}.png`);
  await page.screenshot({ path, fullPage: true });
  await testInfo.attach(name, { path, contentType: "image/png" });
};

const isApi = (url: string, path: RegExp) => path.test(new URL(url).pathname);

test("register, sign in, upload, list, download, share, and delete through the live backend", async ({ page, isMobile }, testInfo) => {
  test.skip(process.env.VITE_USE_MOCK_API !== "false", "Requires a live backend with S3 and VITE_USE_MOCK_API=false");
  test.setTimeout(120_000);

  const email = `live-flow-${Date.now()}-${testInfo.project.name}@example.test`;
  const password = "securepass123";
  const fileName = `live-flow-${Date.now()}-${testInfo.project.name}.txt`;
  const content = `CloudDrop live flow check ${new Date().toISOString()}`;
  let shareUrl = "";
  const openNavigation = async () => {
    if (isMobile) await page.getByRole("button", { name: "Open navigation" }).click();
  };

  await test.step("register", async () => {
    await page.goto("/register");
    await page.getByLabel("First name").fill("Ada");
    await page.getByLabel("Last name").fill("Lovelace");
    await page.getByLabel("Email address").fill(email);
    await page.getByLabel("Password", { exact: true }).fill(password);
    const registered = page.waitForResponse((response) => isApi(response.url(), /\/api\/v1\/auth\/register$/));
    await page.getByRole("button", { name: "Create account" }).click();
    expect((await registered).status()).toBe(201);
    await expect(page.getByRole("heading", { name: /Good to see you, Ada/ })).toBeVisible();
    await capture(page, testInfo, "01-registered");
  });

  await test.step("sign out and sign in", async () => {
    await openNavigation();
    await page.getByRole("button", { name: "Sign out" }).click();
    await expect(page).toHaveURL(/\/login$/);
    await page.getByLabel("Email address").fill(email);
    await page.getByLabel("Password", { exact: true }).fill(password);
    const signedIn = page.waitForResponse((response) => isApi(response.url(), /\/api\/v1\/auth\/login$/));
    await page.getByRole("button", { name: "Sign in" }).click();
    expect((await signedIn).status()).toBe(200);
    await expect(page.getByRole("heading", { name: /Good to see you, Ada/ })).toBeVisible();
    await capture(page, testInfo, "02-signed-in");
  });

  await test.step("upload", async () => {
    await openNavigation();
    await page.getByRole("link", { name: "Upload", exact: true }).click();
    await page.locator('input[type="file"]').setInputFiles({ name: fileName, mimeType: "text/plain", buffer: Buffer.from(content) });
    await expect(page.getByLabel(`Category for ${fileName}: Documents`)).toHaveText("Documents");
    const uploaded = page.waitForResponse((response) => isApi(response.url(), /\/api\/v1\/files$/) && response.request().method() === "POST");
    await page.getByRole("button", { name: "Upload 1 file" }).click();
    expect((await uploaded).status()).toBe(201);
    await expect(page.getByRole("listitem").filter({ hasText: fileName })).toContainText("Uploaded to Documents");
    await capture(page, testInfo, "03-uploaded");
  });

  await test.step("list and search", async () => {
    await page.getByRole("link", { name: "View uploaded files" }).click();
    await expect(page.getByRole("link", { name: fileName })).toBeVisible();
    const searched = page.waitForResponse((response) => {
      const url = new URL(response.url());
      return url.pathname === "/api/v1/files" && url.searchParams.get("search") === "live-flow";
    });
    await page.getByRole("searchbox", { name: "Search files" }).fill("live-flow");
    expect((await searched).status()).toBe(200);
    await expect(page.getByRole("link", { name: fileName })).toBeVisible();
    await capture(page, testInfo, "04-listed");
  });

  await test.step("view", async () => {
    await page.getByRole("button", { name: `View ${fileName}`, exact: true }).click();
    await expect(page.getByRole("dialog", { name: "View file" })).toBeVisible();
    await expect(page.frameLocator(`iframe[title="Preview of ${fileName}"]`).locator("body")).toContainText(content);
    await page.getByRole("button", { name: "Close dialog" }).click();
  });

  await test.step("download", async () => {
    const requested = page.waitForResponse((response) => isApi(response.url(), /\/api\/v1\/files\/[^/]+\/download$/));
    const downloadEvent = page.waitForEvent("download");
    await page.getByRole("button", { name: `Download ${fileName}` }).click();
    expect((await requested).status()).toBe(200);
    const download = await downloadEvent;
    expect(download.suggestedFilename()).toBe(fileName);
    const path = testInfo.outputPath(fileName);
    await download.saveAs(path);
    expect(await readFile(path, "utf8")).toBe(content);
    await expect(page).toHaveURL(/\/files(?:\?.*)?$/);
    await page.getByRole("button", { name: "Close dialog" }).click();
    await capture(page, testInfo, "05-downloaded");
  });

  await test.step("share", async () => {
    await page.getByRole("button", { name: `Share ${fileName}` }).click();
    await page.getByRole("radio", { name: "1 hour" }).check();
    const shared = page.waitForResponse((response) => isApi(response.url(), /\/api\/v1\/files\/[^/]+\/share$/));
    await page.getByRole("button", { name: "Create link" }).click();
    expect((await shared).status()).toBe(201);
    shareUrl = await page.getByRole("textbox", { name: "Temporary link" }).inputValue();
    expect(shareUrl).toMatch(/^https:\/\//);
    await expect(page.getByText(/Expires in 1 hour/)).toBeVisible();
    const viaLink = await page.request.get(shareUrl);
    expect(viaLink.status()).toBe(200);
    expect(await viaLink.text()).toBe(content);
    await capture(page, testInfo, "06-shared");
    await page.getByRole("button", { name: "Close dialog" }).click();
  });

  await test.step("delete", async () => {
    await page.getByRole("button", { name: `Delete ${fileName}` }).click();
    const deleted = page.waitForResponse((response) => isApi(response.url(), /\/api\/v1\/files\/[^/]+$/) && response.request().method() === "DELETE");
    await page.getByRole("button", { name: "Delete file", exact: true }).click();
    expect((await deleted).status()).toBe(200);
    await expect(page.getByRole("link", { name: fileName })).toHaveCount(0);
    expect((await page.request.get(shareUrl)).status()).not.toBe(200);
    await capture(page, testInfo, "07-deleted");
  });
});
