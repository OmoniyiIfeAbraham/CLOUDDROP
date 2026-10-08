import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const audit = async (page: Page, view: string) => {
  const results = await new AxeBuilder({ page }).analyze();
  const violations = results.violations.map(({ id, impact, nodes }) => ({
    id,
    impact,
    targets: nodes.map(({ target }) => target),
  }));
  expect(violations, `${view} accessibility violations`).toEqual([]);
};

const signIn = async (page: Page) => {
  await page.goto("/login");
  await page.getByLabel("Email address").fill("demo@clouddrop.app");
  await page.getByLabel("Password", { exact: true }).fill("securepass123");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("heading", { name: /Good to see you/ })).toBeVisible();
};

test("auth screens meet automated accessibility checks", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible();
  await audit(page, "login");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByText("Enter a valid email address")).toBeVisible();
  await audit(page, "login validation");

  await page.getByRole("link", { name: "Create an account" }).click();
  await expect(page.getByRole("heading", { name: "Create your account" })).toBeVisible();
  await audit(page, "registration");
});

test("workspace and file actions meet automated accessibility checks", async ({ page, isMobile }) => {
  test.slow();
  await signIn(page);
  await audit(page, "dashboard");

  if (isMobile) {
    await page.getByRole("button", { name: "Open navigation" }).click();
    await audit(page, "mobile navigation");
    await page.keyboard.press("Escape");
  }

  await page.goto("/files");
  await expect(page.getByRole("link", { name: "capstone-proposal.pdf" })).toBeVisible();
  await audit(page, "file library");
  await page.getByRole("searchbox", { name: "Search files" }).fill("no-such-file");
  await expect(page.getByText("No matching files")).toBeVisible();
  await audit(page, "file search empty state");
  await page.getByRole("button", { name: "Clear filters" }).click();

  await page.getByRole("link", { name: "capstone-proposal.pdf" }).click();
  await expect(page.getByRole("heading", { name: "capstone-proposal.pdf" })).toBeVisible();
  await audit(page, "file details");

  await page.getByRole("button", { name: "Share" }).click();
  await expect(page.getByRole("textbox", { name: "Temporary link" })).toBeVisible();
  await audit(page, "share dialog");
  await page.keyboard.press("Escape");

  await page.getByRole("button", { name: "Delete" }).click();
  await expect(page.getByRole("dialog", { name: "Delete file?" })).toBeVisible();
  await audit(page, "delete dialog");
  await page.keyboard.press("Escape");

  await page.goto("/upload");
  await expect(page.getByRole("heading", { name: "Upload files" })).toBeVisible();
  await audit(page, "upload");
  await page.locator('input[type="file"]').setInputFiles({ name: "notes.txt", mimeType: "text/plain", buffer: Buffer.from("notes") });
  await page.getByRole("button", { name: "Upload 1 file" }).click();
  await expect(page.getByRole("alert")).toContainText("Choose a category before uploading.");
  await audit(page, "upload queue and validation");
});

test("keyboard navigation and dialog focus remain usable", async ({ page, isMobile }) => {
  await signIn(page);
  await page.goto("/files");
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "Skip to main content" })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("main", { name: "My files" })).toBeFocused();

  if (isMobile) {
    const menu = page.getByRole("button", { name: "Open navigation" });
    await menu.focus();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("button", { name: "Close navigation" }).first()).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(menu).toBeFocused();
  }

  const share = page.getByRole("button", { name: "Share capstone-proposal.pdf" });
  await share.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("dialog", { name: "Share file" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Close dialog" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(share).toBeFocused();

  await page.goto("/upload");
  const browse = page.getByRole("button", { name: "Browse files" });
  await browse.focus();
  const chooserPromise = page.waitForEvent("filechooser");
  await page.keyboard.press("Enter");
  const chooser = await chooserPromise;
  await chooser.setFiles({ name: "keyboard.txt", mimeType: "text/plain", buffer: Buffer.from("keyboard") });
  await expect(page.getByRole("listitem").filter({ hasText: "keyboard.txt" })).toBeVisible();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("button", { name: "Clear queue" })).toBeFocused();
});

test("pages and dialogs fit a 320px viewport", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 320, height: 700 });
  const fits = async (view: string) => {
    const widths = await page.evaluate(() => ({ content: document.documentElement.scrollWidth, viewport: window.innerWidth }));
    expect(widths.content, `${view} horizontal overflow`).toBeLessThanOrEqual(widths.viewport);
  };

  await page.goto("/login");
  await fits("login");
  await page.getByRole("link", { name: "Create an account" }).click();
  await fits("registration");
  await signIn(page);
  await fits("dashboard");
  await page.goto("/files");
  await expect(page.getByRole("link", { name: "capstone-proposal.pdf" })).toBeVisible();
  await fits("file library");
  await expect(page.getByRole("row").filter({ has: page.getByRole("link", { name: "capstone-proposal.pdf" }) }).locator(".file-name-cell__mobile-size")).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("files-320.png"), fullPage: true });
  await page.getByRole("button", { name: "Share capstone-proposal.pdf" }).click();
  await expect(page.getByRole("dialog", { name: "Share file" })).toBeVisible();
  await fits("share dialog");
  await page.screenshot({ path: testInfo.outputPath("share-320.png"), fullPage: true });
  await page.keyboard.press("Escape");
  await page.getByRole("link", { name: "capstone-proposal.pdf" }).click();
  await fits("file details");
  await page.goto("/upload");
  await fits("upload");
  await page.screenshot({ path: testInfo.outputPath("upload-320.png"), fullPage: true });
});
