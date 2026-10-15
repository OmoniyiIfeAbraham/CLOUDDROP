import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { FilePreview } from "./FilePreview";
import { normalFileFixtures } from "../api/files.fixtures";

const originalDescriptor = Object.getOwnPropertyDescriptor(navigator, "pdfViewerEnabled");

afterEach(() => {
  cleanup();
  if (originalDescriptor) {
    Object.defineProperty(navigator, "pdfViewerEnabled", originalDescriptor);
  } else {
    Reflect.deleteProperty(navigator, "pdfViewerEnabled");
  }
});

const pdf = {
  ...normalFileFixtures[0]!,
  mimeType: "application/pdf",
  originalName: "preview.pdf",
};

const url = "https://storage.example/preview.pdf";

describe("PDF preview", () => {
  it("renders a titled sandboxed iframe even when the browser reports no inline PDF viewer", () => {
    Object.defineProperty(navigator, "pdfViewerEnabled", {
      value: false,
      configurable: true,
    });

    render(<FilePreview file={pdf} url={url} onError={() => {}} />);

    const frame = screen.getByTitle("Preview of preview.pdf");
    expect(frame).toHaveAttribute("src", url);
    expect(frame).toHaveAttribute("sandbox", "allow-same-origin");
    expect(frame).toHaveAttribute("referrerPolicy", "no-referrer");
  });

  it("renders the PDF iframe when the browser reports an inline PDF viewer", () => {
    Object.defineProperty(navigator, "pdfViewerEnabled", {
      value: true,
      configurable: true,
    });

    render(<FilePreview file={pdf} url={url} onError={() => {}} />);

    expect(screen.getByTitle("Preview of preview.pdf")).toBeVisible();
  });
});
