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
  it("shows the PDF in an unsandboxed frame, which Chrome's PDF viewer requires", () => {
    Object.defineProperty(navigator, "pdfViewerEnabled", { value: true, configurable: true });
    render(<FilePreview file={pdf} url={url} onError={() => {}} />);
    const frame = screen.getByTitle("Preview of preview.pdf");
    expect(frame).toHaveAttribute("src", url);
    expect(frame).not.toHaveAttribute("sandbox");
    expect(frame).toHaveAttribute("referrerPolicy", "no-referrer");
  });

  it("does not try to preview types the backend will not serve inline", () => {
    for (const mimeType of ["text/plain", "video/mp4", "audio/mpeg"]) {
      const { unmount } = render(<FilePreview file={{ ...pdf, mimeType }} url={url} onError={() => {}} />);
      expect(screen.getByText(/A browser preview is not available/)).toBeVisible();
      expect(document.querySelector("iframe, video, audio, img")).toBeNull();
      unmount();
    }
  });
});
