import { describe, expect, it } from "vitest";
import { validatePreviewableFileContent } from "../src/utils/file-upload.validation.js";

const pngBuffer = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/9x8AAAAASUVORK5CYII=",
  "base64",
);

describe("Previewable file signature validation", () => {
  it("rejects plain text declared as a PDF", async () => {
    const buffer = Buffer.from("This is not a PDF file");

    await expect(
      validatePreviewableFileContent(buffer, "application/pdf"),
    ).rejects.toThrow("File type is not supported");
  });

  it("accepts a PNG image with sufficient content for detection", async () => {
    await expect(
      validatePreviewableFileContent(pngBuffer, "image/png"),
    ).resolves.toBeUndefined();
  });

  it("does not apply signature detection to non-previewable file types", async () => {
    const buffer = Buffer.from("ordinary text content");

    await expect(
      validatePreviewableFileContent(buffer, "text/plain"),
    ).resolves.toBeUndefined();
  });

  it("rejects an image whose detected type does not match its declared MIME type", async () => {
    await expect(
      validatePreviewableFileContent(pngBuffer, "image/jpeg"),
    ).rejects.toThrow("File type is not supported");
  });
});
