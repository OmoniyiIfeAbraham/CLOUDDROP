import { describe, expect, it } from "vitest";
import { fileCategorySchema } from "../src/utils/file.validation.js";
import { validateUploadedFile } from "../src/utils/file-upload.validation.js";

describe("File validation", () => {
  it("accepts a valid file category", () => {
    const result = fileCategorySchema.parse({
      category: "Documents",
    });

    expect(result.category).toBe("Documents");
  });

  it("rejects an invalid file category", () => {
    expect(() =>
      fileCategorySchema.parse({
        category: "InvalidCategory",
      }),
    ).toThrow();
  });

  it("accepts a supported file type within the size limit", () => {
    expect(() =>
      validateUploadedFile(
        "application/pdf",
        1024 * 1024,
      ),
    ).not.toThrow();
  });

  it("rejects a file larger than 25 MB", () => {
    expect(() =>
      validateUploadedFile(
        "application/pdf",
        25 * 1024 * 1024 + 1,
      ),
    ).toThrow("File size exceeds the 25 MB limit");
  });

  it("rejects an unsupported file type", () => {
    expect(() =>
      validateUploadedFile(
        "application/x-executable",
        1024,
      ),
    ).toThrow("File type is not supported");
  });
});
