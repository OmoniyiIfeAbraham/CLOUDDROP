import { readFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { createServer, type Server } from "node:https";
import type { IncomingHttpHeaders } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const filename = "Résumé notes (final).txt";
const content = "CloudDrop browser download verification.\n";
const pdfStream = "BT /F1 12 Tf 30 100 Td (CloudDrop PDF preview check) Tj ET";
const pdfObjects = [
  "<< /Type /Catalog /Pages 2 0 R >>", "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
  "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 200] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
  "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>", `<< /Length ${pdfStream.length} >>\nstream\n${pdfStream}\nendstream`,
];
let pdfDocument = "%PDF-1.4\n";
const pdfOffsets = [0];
for (const [index, object] of pdfObjects.entries()) {
  pdfOffsets.push(pdfDocument.length); pdfDocument += `${index + 1} 0 obj\n${object}\nendobj\n`;
}
const pdfXref = pdfDocument.length;
pdfDocument += `xref\n0 6\n0000000000 65535 f \n${pdfOffsets.slice(1).map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`).join("")}trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${pdfXref}\n%%EOF\n`;
const file = {
  id: "download-file-1", originalName: filename, mimeType: "text/plain",
  size: Buffer.byteLength(content), category: "Documents",
  createdAt: "2026-10-12T10:00:00.000Z", updatedAt: "2026-10-12T10:00:00.000Z",
};
const encodedName = encodeURIComponent(filename).replace(/[!'()*]/g, (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`);
const disposition = `attachment; filename="Resume notes (final).txt"; filename*=UTF-8''${encodedName}`;
let storage: Server;
let storageOrigin: string;
let certificateDirectory: string;
const storageRequests: { url: string; headers: IncomingHttpHeaders }[] = [];

test.beforeAll(async () => {
  // A real response is needed: WebKit does not treat route.fulfill attachment
  // responses as downloads (Playwright issue #22691). Keys are ephemeral and
  // generated locally; no credentials or certificates are committed.
  certificateDirectory = mkdtempSync(join(tmpdir(), "clouddrop-download-test-"));
  const key = join(certificateDirectory, "key.pem");
  const cert = join(certificateDirectory, "cert.pem");
  execFileSync("openssl", ["req", "-x509", "-newkey", "rsa:2048", "-nodes", "-days", "1", "-keyout", key, "-out", cert, "-subj", "/CN=127.0.0.1"], { stdio: "ignore" });
  storage = createServer({ key: readFileSync(key), cert: readFileSync(cert) }, (request, response) => {
    const url = new URL(request.url ?? "/", storageOrigin);
    storageRequests.push({ url: url.toString(), headers: request.headers });
    response.setHeader("Content-Type", url.searchParams.get("response-content-type") ?? "text/plain");
    const attachment = url.searchParams.get("response-content-disposition");
    if (attachment) response.setHeader("Content-Disposition", attachment);
    if (url.pathname === "/image.png") {
      response.setHeader("Content-Type", "image/png");
      response.end(Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aL1sAAAAASUVORK5CYII=", "base64"));
    } else if (url.pathname === "/document.pdf") {
      response.setHeader("Content-Type", "application/pdf"); response.end(pdfDocument);
    } else response.end(content);
  });
  await new Promise<void>((resolve) => storage.listen(0, "127.0.0.1", resolve));
  storageOrigin = `https://127.0.0.1:${(storage.address() as AddressInfo).port}`;
});

test.afterAll(async () => {
  if (storage) await new Promise<void>((resolve, reject) => storage.close((error) => error ? reject(error) : resolve()));
  if (certificateDirectory) rmSync(certificateDirectory, { recursive: true, force: true });
});

const installFixtures = async (page: Page, options: {
  image?: boolean; pdf?: boolean; attachment?: boolean; failFirst?: boolean; gate?: Promise<void>; expiresIn?: number;
} = {}) => {
  let requested = 0;
  storageRequests.length = 0;
  const record = options.image ? { ...file, mimeType: "image/png", category: "Images" } : options.pdf ? { ...file, mimeType: "application/pdf", originalName: "preview.pdf", size: Buffer.byteLength(pdfDocument) } : file;
  await page.addInitScript(() => {
    if (location.origin === "http://127.0.0.1:4176") sessionStorage.setItem("clouddrop.access-token", "browser-fixture-session");
  });
  await page.route("**/api/v1/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    let data: unknown;
    if (path.endsWith("/auth/me")) {
      data = { user: { id: "fixture-user", firstName: "Ada", lastName: "Lovelace", email: "fixture@example.test" } };
    } else if (path.endsWith("/download")) {
      requested += 1;
      await options.gate;
      if (options.failFirst && requested === 1) {
        await route.fulfill({ status: 500, json: { success: false, message: "Unavailable", error: { code: "DOWNLOAD_FAILED" } } });
        return;
      }
      const url = new URL(options.image ? "/image.png" : options.pdf ? "/document.pdf" : "/object.txt", storageOrigin);
      url.searchParams.set("X-Amz-Signature", `fixture-${requested}`);
      if (options.attachment) {
        url.searchParams.set("response-content-disposition", disposition);
        url.searchParams.set("response-content-type", "application/octet-stream");
      }
      data = { file: record, downloadUrl: url.toString(), expiresIn: options.expiresIn ?? 600 };
    } else if (path.endsWith(`/files/${file.id}`)) {
      data = { file: record };
    } else if (path.endsWith("/files")) {
      data = { files: [record], pagination: { page: 1, limit: 10, total: 1, totalPages: 1 } };
    } else {
      throw new Error(`Unexpected API request: ${path}`);
    }
    await route.fulfill({ json: { success: true, message: "Fixture request succeeded", data } });
  });
  await page.goto("/files");
  await expect(page.getByRole("link", { name: record.originalName, exact: true })).toBeVisible();
  return { requests: () => requested, storageRequests };
};

test("a signed attachment saves the original filename and bytes without CORS", async ({ page }, testInfo) => {
  const fixtures = await installFixtures(page, { attachment: true });
  const downloadEvent = page.waitForEvent("download");
  await page.getByRole("button", { name: `Download ${filename}`, exact: true }).click();
  const download = await downloadEvent;
  await expect(page.getByRole("link", { name: "Save file" })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("download-started.png"), fullPage: true });
  expect(download.suggestedFilename()).toBe(filename);
  const saved = testInfo.outputPath(filename);
  await download.saveAs(saved);
  expect(await readFile(saved, "utf8")).toBe(content);
  expect(new URL(download.url()).searchParams.get("X-Amz-Signature")).toBe("fixture-1");
  expect(fixtures.storageRequests).toHaveLength(1);
  expect(fixtures.storageRequests[0]!.headers.authorization).toBeUndefined();
  expect(fixtures.storageRequests[0]!.headers.referer).toBeUndefined();
  await expect(page).toHaveURL(/\/files$/);
});

test("Download refuses inline links and View opens a separate preview", async ({ page }, testInfo) => {
  const fixtures = await installFixtures(page);
  await page.setViewportSize({ width: 320, height: 700 });
  await page.getByRole("button", { name: `Download ${filename}`, exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("Direct download is not available");
  await expect(page.getByRole("link", { name: "Open file" })).toHaveCount(0);
  expect(fixtures.storageRequests).toHaveLength(0);
  await page.getByRole("button", { name: "View file", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "View file" })).toBeVisible();
  await expect(page.frameLocator(`iframe[title="Preview of ${filename}"]`).locator("body")).toContainText(content.trim());
  // Uploaded document contents are external; verify the titled frame separately from the owned dialog.
  const results = await new AxeBuilder({ page }).exclude(".file-preview iframe").analyze();
  expect(results.violations.map(({ id }) => id)).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath("view-preview-320.png"), fullPage: true });
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog", { name: "View file" })).not.toBeVisible();
  await expect(page.getByRole("button", { name: `Download ${filename}`, exact: true })).toBeFocused();
  expect(page.context().pages()).toHaveLength(1);
});

test("View displays an image without opening a tab or downloading it", async ({ page }, testInfo) => {
  const fixtures = await installFixtures(page, { image: true });
  await page.getByRole("button", { name: `View ${filename}`, exact: true }).click();
  const image = page.getByRole("img", { name: filename });
  await expect(image).toBeVisible();
  await expect.poll(() => image.evaluate((element) => (element as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
  expect(fixtures.storageRequests).toHaveLength(1);
  expect(fixtures.storageRequests[0]!.headers.authorization).toBeUndefined();
  expect(page.context().pages()).toHaveLength(1);
  const result = await new AxeBuilder({ page }).analyze();
  expect(result.violations.map(({ id }) => id)).toEqual([]);
  await page.screenshot({ path: testInfo.outputPath("image-view.png"), fullPage: true });
});

test("cancelled preparation ignores a late response", async ({ page }, testInfo) => {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  const fixtures = await installFixtures(page, { gate, attachment: true });
  await page.getByRole("button", { name: `Download ${filename}`, exact: true }).click();
  await expect(page.getByText("Preparing your download...")).toBeVisible();
  await expect.poll(fixtures.requests).toBe(1);
  await page.screenshot({ path: testInfo.outputPath("download-preparing.png"), fullPage: true });
  const response = page.waitForResponse((value) => new URL(value.url()).pathname.endsWith("/download"));
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  release();
  await response;
  await expect(page.getByRole("dialog", { name: "Download file" })).not.toBeVisible();
  await expect(page.getByRole("link", { name: "Save file" })).toHaveCount(0);
  expect(fixtures.storageRequests).toHaveLength(0);
});

test("failed requests retry and expired links are renewed", async ({ page }, testInfo) => {
  await page.clock.install();
  const fixtures = await installFixtures(page, { attachment: true, failFirst: true, expiresIn: 30 });
  await page.getByRole("button", { name: `Download ${filename}`, exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("The download link could not be created.");
  await page.screenshot({ path: testInfo.outputPath("download-error.png"), fullPage: true });
  await page.getByRole("button", { name: "Try again" }).click();
  await expect(page.getByRole("link", { name: "Save file" })).toBeVisible();
  await page.clock.fastForward(31_000);
  await expect(page.getByRole("alert")).toContainText("This file link has expired.");
  await expect(page.getByRole("link", { name: "Save file" })).toHaveCount(0);
  await page.getByRole("button", { name: "Try again" }).click();
  await expect(page.getByRole("link", { name: "Save file" })).toHaveAttribute("href", /fixture-3/);
  expect(fixtures.requests()).toBe(3);
});


test("file dialogs restore an invoker that was not focused during activation", async ({ page }) => {
  await installFixtures(page);
  const trigger = page.getByRole("button", { name: `Share ${filename}`, exact: true });
  // Some browsers do not focus a button on pointer activation. Programmatic
  // activation exercises that same missing-native-focus case deterministically.
  await trigger.evaluate((element) => (element as HTMLButtonElement).click());
  await expect(page.getByRole("dialog", { name: "Share file" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(trigger).toBeFocused();
});


test("View avoids PDF navigation when the browser has no inline PDF viewer", async ({ page }) => {
  const fixtures = await installFixtures(page, { pdf: true });
  await page.evaluate(() => Object.defineProperty(navigator, "pdfViewerEnabled", { value: false, configurable: true }));
  const downloads: string[] = [];
  page.on("download", (download) => downloads.push(download.suggestedFilename()));
  await page.getByRole("button", { name: "View preview.pdf", exact: true }).click();
  await expect(page.getByText("A browser preview is not available for this file type. Download the file to open it on your device.")).toBeVisible();
  await expect(page.locator("iframe")).toHaveCount(0);
  expect(fixtures.storageRequests).toHaveLength(0);
  expect(downloads).toEqual([]);
});
