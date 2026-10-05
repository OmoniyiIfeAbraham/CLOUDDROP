import { describe, expect, it } from "vitest";
import { ApiError } from "../src/utils/api-error.js";
import { validateFileUpload } from "../src/lib/file-validation.js";

describe("File validation", () => {
  it("accepts a valid file", () => {
    expect(() =>
      validateFileUpload({
        originalName: "report.pdf",
        mimeType: "application/pdf",
        size: 1024,
      })
    ).not.toThrow();
  });

  it("rejects path traversal in file names", () => {
    expect(() =>
      validateFileUpload({
        originalName: "../secret.pdf",
        mimeType: "application/pdf",
        size: 1024,
      })
    ).toThrow(ApiError);
  });

  it("rejects empty files", () => {
    expect(() =>
      validateFileUpload({
        originalName: "empty.pdf",
        mimeType: "application/pdf",
        size: 0,
      })
    ).toThrow(ApiError);
  });

  it("rejects blocked executable types", () => {
    expect(() =>
      validateFileUpload({
        originalName: "malware.exe",
        mimeType: "application/x-msdownload",
        size: 2048,
      })
    ).toThrow(ApiError);
  });
});
