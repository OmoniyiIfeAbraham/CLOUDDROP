import { expect, test } from "@playwright/test";

test("sign in, find files, share, delete, and upload", async ({ page, isMobile }, testInfo) => {
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("/login");
  await page.getByLabel("Email address").fill("demo@clouddrop.app");
  await page.getByLabel("Password", { exact: true }).fill("securepass123");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("heading", { name: /Good to see you/ })).toBeVisible();
  await expect(page.getByText("6", { exact: true }).first()).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("dashboard.png"), fullPage: true });

  if (isMobile) {
    await page.getByRole("button", { name: "Open navigation" }).click();
    await expect(page.getByRole("button", { name: "Close navigation" }).first()).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("button", { name: "Open navigation" })).toBeFocused();
    await page.getByRole("button", { name: "Open navigation" }).click();
  }
  await page.getByRole("link", { name: "My files" }).click();
  await expect(page.getByRole("main", { name: "My files" })).toBeFocused();
  await expect(page.locator('.sidebar__nav a[href="/files"]')).toHaveAttribute("aria-current", "page");
  await expect(page.getByRole("heading", { name: "My files" })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("files.png"), fullPage: true });

  await page.getByRole("searchbox", { name: "Search files" }).fill("proposal");
  await expect(page.getByRole("link", { name: "capstone-proposal.pdf" })).toBeVisible();
  await expect(page.getByRole("link", { name: "product-demo.mp4" })).toHaveCount(0);
  await page.getByRole("button", { name: "Clear search" }).click();
  await expect(page.getByRole("link", { name: "product-demo.mp4" })).toBeVisible();

  await page.getByLabel("Category").selectOption("Images");
  await expect(page.getByRole("link", { name: "architecture-diagram.png" })).toBeVisible();
  await expect(page.getByRole("link", { name: "capstone-proposal.pdf" })).toHaveCount(0);
  await page.getByLabel("Category").selectOption("All");

  await page.getByRole("link", { name: "capstone-proposal.pdf" }).click();
  await expect(page.getByRole("heading", { name: "capstone-proposal.pdf" })).toBeVisible();
  await page.goBack();
  await expect(page.getByRole("heading", { name: "My files" })).toBeVisible();

  await page.getByRole("button", { name: "Download capstone-proposal.pdf" }).click();
  await expect(page.getByText("Download started for capstone-proposal.pdf.")).toBeVisible();

  await page.getByRole("button", { name: "Share capstone-proposal.pdf" }).click();
  await expect(page.getByRole("dialog", { name: "Share file" })).toBeVisible();
  await expect(page.getByText("Expires in 3 hours", { exact: false })).toBeVisible();
  await page.getByRole("button", { name: "Copy link" }).click();
  await expect(page.getByRole("button", { name: "Copied" })).toBeVisible();
  await page.getByRole("button", { name: "Close dialog" }).click();

  await page.getByRole("button", { name: "Delete capstone-proposal.pdf" }).click();
  await expect(page.getByRole("dialog", { name: "Delete file?" })).toBeVisible();
  await page.getByRole("button", { name: "Cancel" }).click();
  await expect(page.getByRole("link", { name: "capstone-proposal.pdf" })).toBeVisible();
  await page.getByRole("button", { name: "Delete capstone-proposal.pdf" }).click();
  await page.getByRole("button", { name: "Delete file", exact: true }).click();
  await expect(page.getByRole("link", { name: "capstone-proposal.pdf" })).toHaveCount(0);

  if (isMobile) {
    await page.getByRole("button", { name: "Open navigation" }).click();
  }
  await page.getByRole("link", { name: "Upload", exact: true }).click();
  await page.locator('input[type="file"]').setInputFiles({
    name: "fresh-notes.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("CloudDrop smoke test"),
  });
  await page.getByRole("combobox", { name: "Category" }).selectOption("Documents");
  await page.getByRole("button", { name: "Upload 1 file" }).click();
  await expect(page.getByRole("listitem").filter({ hasText: "fresh-notes.txt" })).toContainText("Uploaded");
  await page.screenshot({ path: testInfo.outputPath("upload.png"), fullPage: true });
  await page.getByRole("link", { name: "View uploaded files" }).click();
  await expect(page.getByRole("link", { name: "fresh-notes.txt" })).toBeVisible();
});

test("register, restore a session, and sign out", async ({ page, isMobile }) => {
  await page.goto("/files");
  await expect(page).toHaveURL(/\/login$/);
  await page.getByRole("link", { name: "Create an account" }).click();
  await page.getByLabel("First name").fill("Ada");
  await page.getByLabel("Last name").fill("Lovelace");
  await page.getByLabel("Email address").fill("ada@example.com");
  await page.getByLabel("Password", { exact: true }).fill("securepass123");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByRole("heading", { name: /Good to see you, Ada/ })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("heading", { name: /Good to see you, Ada/ })).toBeVisible();
  if (isMobile) await page.getByRole("button", { name: "Open navigation" }).click();
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/login$/);
  await page.goto("/files");
  await expect(page).toHaveURL(/\/login$/);
});

test("an expired token cannot open a protected page", async ({ page }) => {
  await page.goto("/login");
  await page.evaluate(() => sessionStorage.setItem("clouddrop.access-token", "expired-token"));
  await page.goto("/files");
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible();
  expect(await page.evaluate(() => sessionStorage.getItem("clouddrop.access-token"))).toBeNull();
});

test("auth forms reject incomplete details", async ({ page }) => {
  await page.goto("/login");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByText("Enter a valid email address")).toBeVisible();
  await expect(page.getByText("Use at least 8 characters")).toBeVisible();

  await page.getByRole("link", { name: "Create an account" }).click();
  await page.getByLabel("Email address").fill("ada@example.com");
  await page.getByLabel("Password", { exact: true }).fill("securepass123");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByRole("alert")).toContainText("Enter your first and last name.");
});
