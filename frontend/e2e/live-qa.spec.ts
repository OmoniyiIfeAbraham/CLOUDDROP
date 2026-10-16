import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { capture, checks, isApi, liveAccount, openPage } from "./live-helpers";

test.use({ trace: "off", screenshot: "off", video: "off" });

const enabled = process.env.CLOUDDROP_LIVE_QA === "true";
test.beforeEach(() => test.skip(!enabled, "Opt in with npm run test:live and E2E_BASE_URL"));

const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aL1sAAAAASUVORK5CYII=", "base64");

test("live uploads, dashboard, pagination, filters, filename download, sharing and deletion", async ({ page }, info) => {
  test.setTimeout(240_000);
  const account = await liveAccount(page, info);
  const qa = checks(info);
  const name = `${account.prefix}-Résumé notes (final).txt`;
  const contents = "CloudDrop final live QA.\n";
  const files = [
    { name, mimeType: "text/plain", buffer: Buffer.from(contents) },
    ...Array.from({ length: 10 }, (_, n) => ({ name: `${account.prefix}-document-${n}.txt`, mimeType: "text/plain", buffer: Buffer.from(`Document ${n}\n`) })),
    { name: `${account.prefix}-image.png`, mimeType: "image/png", buffer: png },
  ];
  try {
    await openPage(page, "Upload");
    await page.locator('input[type="file"]').setInputFiles(files);
    await qa.run("Automatic categories", "Documents/Images are read-only and cannot be overridden", async () => {
      await expect(page.getByLabel(`Category for ${name}: Documents`)).toHaveText("Documents");
      await expect(page.locator(".upload-item select")).toHaveCount(0);
    });
    await capture(page, info, "upload-ready");
    const uploaded = page.waitForResponse((r) => isApi(r.url(), /\/api\/v1\/files$/) && r.request().method() === "POST");
    await page.getByRole("button", { name: "Upload 12 files" }).click();
    expect((await uploaded).status()).toBe(201);
    await expect(page.locator(".upload-queue li").filter({ hasText: "Uploaded to" })).toHaveCount(12, { timeout: 100_000 });
    await qa.run("Completed upload feedback", "The completed queue shows All files uploaded", async () => {
      await expect(page.getByRole("button", { name: "All files uploaded" })).toBeVisible();
    });
    await capture(page, info, "upload-complete");

    const listing = await page.request.get(account.api + "files?limit=100", { headers: account.headers });
    const saved = (await listing.json()).data.files as { id: string; originalName: string; mimeType: string; size: number; category: string }[];
    expect(saved).toHaveLength(12);
    const document = saved.find((f) => f.mimeType === "text/plain" && f.originalName.includes("notes (final)"))!;
    await qa.run("Stored Unicode filename", "The API preserves the original uploaded filename", async () => {
      expect(document.originalName).toBe(name);
    });
    await openPage(page, "Overview");
    await qa.run("Dashboard statistics", "12 files, exact uploaded bytes, 11 Documents and 1 Image", async () => {
      const response = await page.request.get(account.api + "dashboard/stats", { headers: account.headers });
      expect(response.status()).toBe(200);
      const stats = (await response.json()).data;
      expect(stats.totalFiles).toBe(12);
      expect(stats.totalStorage).toBe(files.reduce((total, f) => total + f.buffer.length, 0));
      expect(stats.filesByCategory.Documents).toBe(11);
      expect(stats.filesByCategory.Images).toBe(1);
      await expect(page.locator(".stat-card").filter({ hasText: "Total files" }).locator("strong")).toHaveText("12");
      await expect(page.locator(".stat-card").filter({ hasText: "Categories used" }).locator("strong")).toHaveText("2");
    });
    await capture(page, info, "dashboard-populated");
    await openPage(page, "My files");
    await qa.run("Server pagination", "Ten rows on page one and two rows on page two", async () => {
      await expect(page.getByText("Page 1 of 2", { exact: true })).toBeVisible();
      await expect(page.locator(".file-table tbody tr")).toHaveCount(10);
      await page.getByRole("button", { name: "Next page" }).click();
      await expect(page.getByText("Page 2 of 2", { exact: true })).toBeVisible();
      await expect(page.locator(".file-table tbody tr")).toHaveCount(2);
    });
    await capture(page, info, "files-page-two");
    await qa.run("Category filtering", "The Images filter returns only the image and resets paging", async () => {
      await page.getByRole("combobox", { name: "Category", exact: true }).selectOption("Images");
      await expect(page.locator(".file-table tbody tr")).toHaveCount(1);
      await expect(page.getByRole("link", { name: `${account.prefix}-image.png`, exact: true })).toBeVisible();
    });
    await page.getByRole("combobox", { name: "Category", exact: true }).selectOption("All");
    await qa.run("Search and details", "Search finds the uploaded document; details match persisted metadata", async () => {
      await page.getByRole("searchbox", { name: "Search files" }).fill("notes (final)");
      await expect(page.getByRole("link", { name: document.originalName, exact: true })).toBeVisible();
      await page.getByRole("link", { name: document.originalName, exact: true }).click();
      await expect(page.getByRole("heading", { name: document.originalName, exact: true })).toBeVisible();
      await expect(page.getByRole("region", { name: "File information" })).toContainText("text/plain");
    });
    await capture(page, info, "file-details");
    await page.getByRole("link", { name: "Back to my files" }).click();
    await page.getByRole("searchbox", { name: "Search files" }).fill("notes (final)");
    await expect(page.getByRole("link", { name: document.originalName, exact: true })).toBeVisible();

    await qa.run("One-click browser download", "Download saves the original Unicode filename and exact bytes without a viewing tab", async () => {
      const received = page.waitForEvent("download", { timeout: 8000 }).catch(() => null);
      await page.getByRole("button", { name: `Download ${document.originalName}`, exact: true }).click();
      const download = await received;
      expect(download, "The first Download click must create a browser download event").not.toBeNull();
      if (!download) return;
      expect(download.suggestedFilename()).toBe(name);
      const path = info.outputPath("downloaded-document.txt");
      await download.saveAs(path);
      expect(await readFile(path, "utf8")).toBe(contents);
      expect(page.context().pages()).toHaveLength(1);
    });
    for (const popup of page.context().pages()) if (popup !== page) await popup.close();
    if (await page.getByRole("button", { name: "Close dialog" }).isVisible()) await page.getByRole("button", { name: "Close dialog" }).click();
    await qa.run("Separate View", "A supported plain-text file opens in the preview dialog without a download", async () => {
      await expect(page.getByRole("button", { name: `View ${document.originalName}`, exact: true })).toBeVisible();
      await page.getByRole("button", { name: `View ${document.originalName}`, exact: true }).click();
      await expect(page.getByRole("region", { name: `Preview of ${document.originalName}`, exact: true })).toContainText(contents);
    });
    if (await page.getByRole("button", { name: "Close dialog" }).isVisible()) await page.getByRole("button", { name: "Close dialog" }).click();
    await qa.run("Sharing with anonymous retrieval", "A 1-hour share link returns the uploaded bytes without a JWT", async () => {
      await page.getByRole("button", { name: `Share ${document.originalName}`, exact: true }).click();
      await page.getByRole("radio", { name: "1 hour" }).check();
      const shared = page.waitForResponse((r) => isApi(r.url(), /\/api\/v1\/files\/[^/]+\/share$/));
      await page.getByRole("button", { name: "Create link", exact: true }).click();
      expect((await shared).status()).toBe(201);
      const url = await page.getByRole("textbox", { name: "Temporary link" }).inputValue();
      const response = await page.request.get(url);
      expect(response.status()).toBe(200);
      expect(await response.text()).toBe(contents);
      await expect(page.getByText(/Expires in 1 hour/)).toBeVisible();
      await capture(page, info, "share-link-masked");
    });
    if (await page.getByRole("button", { name: "Close dialog" }).isVisible()) await page.getByRole("button", { name: "Close dialog" }).click();
    await qa.run("Deletion and refreshed library", "Delete removes this QA file from the API and UI", async () => {
      await page.getByRole("button", { name: `Delete ${document.originalName}`, exact: true }).click();
      const deleted = page.waitForResponse((r) => isApi(r.url(), /\/api\/v1\/files\/[^/]+$/) && r.request().method() === "DELETE");
      await page.getByRole("button", { name: "Delete file", exact: true }).click();
      expect((await deleted).status()).toBe(200);
      await expect(page.getByRole("link", { name: document.originalName, exact: true })).toHaveCount(0);
      expect((await page.request.get(account.api + "files/" + document.id, { headers: account.headers })).status()).toBe(404);
    });
    await capture(page, info, "deleted-empty-search");
  } finally { await account.cleanup(); await qa.save(); }
});

test("live responsive layouts, accessibility, keyboard and dialog focus", async ({ page }, info) => {
  test.setTimeout(180_000);
  const qa = checks(info);
  await page.goto("/login");
  await qa.run("Form validation accessibility", "Invalid input has readable feedback and no axe violations", async () => {
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page.getByText("Enter a valid email address")).toBeVisible();
    const result = await new AxeBuilder({ page }).analyze();
    expect(result.violations.map((v) => v.id)).toEqual([]);
  });
  const account = await liveAccount(page, info);
  const name = `${account.prefix}-keyboard.txt`;
  try {
    const created = await page.request.post(account.api + "files", { headers: account.headers, multipart: {
      file: { name, mimeType: "text/plain", buffer: Buffer.from("Keyboard QA") }, category: "Documents",
    } });
    expect(created.status()).toBe(201);
    await openPage(page, "My files");
    await expect(page.getByRole("link", { name, exact: true })).toBeVisible();
    await qa.run("Workspace accessibility", "The populated live file library has no axe violations", async () => {
      const result = await new AxeBuilder({ page }).analyze();
      expect(result.violations.map((v) => v.id)).toEqual([]);
    });
    for (const width of [320, 390, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await qa.run(`Responsive library at ${width}px`, "No horizontal document overflow; file actions stay reachable", async () => {
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
        await expect(page.getByRole("button", { name: `Share ${name}`, exact: true })).toBeVisible();
        await expect(page.getByRole("button", { name: `Delete ${name}`, exact: true })).toBeVisible();
      });
      await capture(page, info, `library-${width}`);
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await qa.run("Mobile navigation focus", "Escape closes navigation and returns focus to its opener", async () => {
      const opener = page.getByRole("button", { name: "Open navigation" });
      await opener.focus(); await page.keyboard.press("Enter");
      await expect(page.getByRole("button", { name: "Close navigation" }).first()).toBeFocused();
      await page.keyboard.press("Escape"); await expect(opener).toBeFocused();
    });
    for (const action of ["Share", "Delete", "Download"] as const) {
      await qa.run(`${action} dialog focus restoration`, "Escape closes the dialog and restores focus to the invoking button", async () => {
        const trigger = page.getByRole("button", { name: `${action} ${name}`, exact: true });
        await trigger.focus(); await page.keyboard.press("Enter");
        await expect(page.getByRole("button", { name: "Close dialog" })).toBeFocused();
        await page.keyboard.press("Escape"); await expect(trigger).toBeFocused();
      });
      if (await page.getByRole("button", { name: "Close dialog" }).isVisible()) await page.getByRole("button", { name: "Close dialog" }).click();
      for (const popup of page.context().pages()) if (popup !== page) await popup.close();
    }
    await openPage(page, "Upload");
    await page.emulateMedia({ reducedMotion: "reduce" });
    await qa.run("Reduced motion and upload validation", "Unsupported files show a clear error; the upload page fits at 320px", async () => {
      await page.setViewportSize({ width: 320, height: 700 });
      await page.locator('input[type="file"]').setInputFiles({ name: `${account.prefix}-invalid.exe`, mimeType: "application/x-msdownload", buffer: Buffer.from("MZ") });
      await expect(page.getByRole("listitem").filter({ hasText: "invalid.exe" })).toContainText("This file type is not supported.");
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      const result = await new AxeBuilder({ page }).analyze();
      expect(result.violations.map((v) => v.id)).toEqual([]);
    });
    await capture(page, info, "upload-validation-320");
    await qa.run("Missing file error state", "A missing UUID displays File unavailable with a recovery action", async () => {
      await page.goto("/files/00000000-0000-4000-8000-000000000000");
      await expect(page.getByRole("heading", { name: "File unavailable" })).toBeVisible();
      await expect(page.getByText("That file is no longer available.")).toBeVisible();
    });
    await capture(page, info, "missing-file");
  } finally { await account.cleanup(); await qa.save(); }
});

test("live upload network failure, retry, progress and client cancellation", async ({ page, context }, info) => {
  const account = await liveAccount(page, info);
  const name = `${account.prefix}-retry.txt`;
  try {
    await openPage(page, "Upload");
    await page.locator('input[type="file"]').setInputFiles({ name, mimeType: "text/plain", buffer: Buffer.from("Actual backend retry verification") });
    await context.setOffline(true);
    await page.getByRole("button", { name: "Upload 1 file", exact: true }).click();
    await expect(page.getByRole("button", { name: "Retry", exact: true })).toBeVisible();
    await capture(page, info, "upload-network-error");
    await context.setOffline(false);
    await page.getByRole("button", { name: "Retry", exact: true }).click();
    const uploaded = page.waitForResponse((r) => isApi(r.url(), /\/api\/v1\/files$/) && r.request().method() === "POST");
    await page.getByRole("button", { name: "Upload 1 file", exact: true }).click();
    expect((await uploaded).status()).toBe(201);
    await expect(page.getByRole("listitem").filter({ hasText: name })).toContainText("Uploaded to Documents");
    await capture(page, info, "upload-retried");
    await page.getByRole("button", { name: "Clear queue", exact: true }).click();
    const cancelledName = `${account.prefix}-cancel.txt`;
    await page.locator('input[type="file"]').setInputFiles({ name: cancelledName, mimeType: "text/plain", buffer: Buffer.alloc(128 * 1024, "c") });
    let release!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    let intercepted = false;
    // Stall the outgoing request, then abort it. No response is fabricated and no
    // bytes reach S3. This covers client cancellation, not server rollback.
    await page.route("**/api/v1/files", async (route) => {
      if (route.request().method() !== "POST") return route.continue();
      intercepted = true; await gate;
      await route.abort("aborted").catch(() => {});
    });
    await page.getByRole("button", { name: "Upload 1 file", exact: true }).click();
    await expect.poll(() => intercepted).toBe(true);
    await expect(page.getByRole("progressbar", { name: `Upload progress for ${cancelledName}` })).toBeVisible();
    await capture(page, info, "upload-progress");
    await page.getByRole("button", { name: "Cancel upload", exact: true }).click();
    release();
    await page.unrouteAll({ behavior: "wait" });
    await expect(page.getByRole("listitem").filter({ hasText: cancelledName })).toContainText("Upload cancelled.");
    await expect(page.getByRole("button", { name: "Retry", exact: true })).toBeVisible();
    const response = await page.request.get(account.api + "files?limit=100", { headers: account.headers });
    expect((await response.json()).data.files.map((f: { originalName: string }) => f.originalName)).not.toContain(cancelledName);
    await capture(page, info, "upload-cancelled");
  } finally { await context.setOffline(false); await page.unrouteAll({ behavior: "ignoreErrors" }); await account.cleanup(); }
});

test("live short-link contract and selected sharing durations", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop-chromium", "One backend contract check avoids redundant production share records");
  const account = await liveAccount(page, info);
  const name = `${account.prefix}-sharing.txt`;
  const qa = checks(info);
  try {
    expect((await page.request.post(account.api + "files", { headers: account.headers, multipart: { file: { name, mimeType: "text/plain", buffer: Buffer.from("Share duration QA") }, category: "Documents" } })).status()).toBe(201);
    await openPage(page, "My files");
    for (const [label, hours] of [["1 hour", 1], ["1 day", 24], ["7 days", 168]] as const) {
      await page.getByRole("button", { name: `Share ${name}`, exact: true }).click();
      await page.getByRole("radio", { name: label, exact: true }).check();
      const received = page.waitForResponse((r) => isApi(r.url(), /\/api\/v1\/files\/[^/]+\/share$/));
      await page.getByRole("button", { name: "Create link", exact: true }).click();
      const response = await received;
      expect(response.status()).toBe(201);
      const share = (await response.json()).data;
      await qa.run(`${label} sharing response`, "The backend reports the selected lifetime and the UI shows it", async () => {
        expect(share.expiresIn).toBeGreaterThan(hours * 3600 - 60);
        expect(share.expiresIn).toBeLessThanOrEqual(hours * 3600);
        await expect(page.getByText(new RegExp(`Expires in ${label}`))).toBeVisible();
      });
      await qa.run(`${label} short-link resolution`, "An anonymous HTTPS CloudDrop /s/token link returns the uploaded content", async () => {
        const url = new URL(share.shareUrl);
        const site = new URL(process.env.E2E_BASE_URL!);
        expect(url.origin).toBe(site.origin);
        expect(url.pathname).toMatch(/^\/s\/[A-Za-z0-9_-]+$/);
        expect(url.search).toBe("");
        const content = await page.request.get(url.toString());
        expect(content.status()).toBe(200); expect(await content.text()).toBe("Share duration QA");
      });
      await capture(page, info, `share-${hours}h-masked`);
      await page.getByRole("button", { name: "Close dialog" }).click();
    }
    await info.attach("expiry-limit", { body: "Selected durations and immediate retrieval are checked. Actual 24-hour/7-day expiry requires elapsed-time or controlled-clock backend verification; this run does not claim it.", contentType: "text/plain" });
  } finally { await account.cleanup(); await qa.save(); }
});
