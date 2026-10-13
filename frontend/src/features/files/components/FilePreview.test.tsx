import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { FilePreview } from "./FilePreview";
import { normalFileFixtures } from "../api/files.fixtures";

const originalDescriptor = Object.getOwnPropertyDescriptor(navigator, "pdfViewerEnabled");
afterEach(() => {
  cleanup();
  if (originalDescriptor) Object.defineProperty(navigator, "pdfViewerEnabled", originalDescriptor);
  else Reflect.deleteProperty(navigator, "pdfViewerEnabled");
});
const pdf = { ...normalFileFixtures[0]!, mimeType: "application/pdf", originalName: "preview.pdf" };
const url = "https://storage.example/preview.pdf";

describe("PDF preview capability", () => {
  it("does not navigate to a PDF when the browser cannot display it inline", () => {
    Object.defineProperty(navigator, "pdfViewerEnabled", { value: false, configurable: true });
    render(<FilePreview file={pdf} url={url} onError={() => {}} />);
    expect(screen.getByText(/A browser preview is not available/)).toBeVisible();
    expect(document.querySelector("iframe")).toBeNull();
  });
  it("keeps the titled sandboxed preview available in a browser with an inline PDF viewer", () => {
    Object.defineProperty(navigator, "pdfViewerEnabled", { value: true, configurable: true });
    render(<FilePreview file={pdf} url={url} onError={() => {}} />);
    const frame = screen.getByTitle("Preview of preview.pdf");
    expect(frame).toHaveAttribute("src", url);
    expect(frame).toHaveAttribute("sandbox", "allow-same-origin");
    expect(frame).toHaveAttribute("referrerPolicy", "no-referrer");
  });
});
