import { describe, expect, it } from "vitest";
import { categorizeByMimeType, isFileCategory } from "../src/lib/category.js";

describe("File categories", () => {
  it("maps common document mime types", () => {
    expect(categorizeByMimeType("application/pdf")).toBe("Documents");
    expect(categorizeByMimeType("text/plain")).toBe("Documents");
  });

  it("maps image, video and audio prefixes", () => {
    expect(categorizeByMimeType("image/png")).toBe("Images");
    expect(categorizeByMimeType("video/mp4")).toBe("Videos");
    expect(categorizeByMimeType("audio/mpeg")).toBe("Audio");
  });

  it("maps archives and falls back to Other", () => {
    expect(categorizeByMimeType("application/zip")).toBe("Archives");
    expect(categorizeByMimeType("application/octet-stream")).toBe("Other");
  });

  it("validates category names from the API contract", () => {
    expect(isFileCategory("Documents")).toBe(true);
    expect(isFileCategory("Unknown")).toBe(false);
  });
});
