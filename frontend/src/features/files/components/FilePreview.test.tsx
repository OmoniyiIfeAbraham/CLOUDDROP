
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FilePreview } from "./FilePreview";
import { normalFileFixtures } from "../api/files.fixtures";

const originalDescriptor = Object.getOwnPropertyDescriptor(
  navigator,
  "pdfViewerEnabled",
);

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();

  if (originalDescriptor) {
    Object.defineProperty(
      navigator,
      "pdfViewerEnabled",
      originalDescriptor,
    );
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

describe("file preview", () => {
  it("shows a fallback message when the browser reports no inline PDF viewer", () => {
    Object.defineProperty(navigator, "pdfViewerEnabled", {
      value: false,
      configurable: true,
    });

    render(<FilePreview file={pdf} url={url} onError={() => {}} />);

    expect(
      screen.getByText(
        "A browser preview is not available for this file type. Download the file to open it on your device.",
      ),
    ).toBeVisible();

    expect(
      screen.queryByTitle("Preview of preview.pdf"),
    ).not.toBeInTheDocument();
  });

  it("renders the PDF in an unsandboxed iframe with the correct URL and referrer policy", () => {
    Object.defineProperty(navigator, "pdfViewerEnabled", {
      value: true,
      configurable: true,
    });

    render(<FilePreview file={pdf} url={url} onError={() => {}} />);

    const frame = screen.getByTitle("Preview of preview.pdf");

    expect(frame).toBeVisible();
    expect(frame).toHaveAttribute("src", url);
    expect(frame).not.toHaveAttribute("sandbox");
    expect(frame).toHaveAttribute("referrerPolicy", "no-referrer");
  });

  it("does not try to preview types the backend will not serve inline", () => {
    for (const mimeType of [
      "application/zip",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "image/svg+xml",
    ]) {
      const { unmount } = render(
        <FilePreview
          file={{ ...pdf, mimeType }}
          url={url}
          onError={() => {}}
        />,
      );

      expect(
        screen.getByText(/A browser preview is not available/),
      ).toBeVisible();

      expect(
        document.querySelector("iframe, video, audio, img"),
      ).toBeNull();

      unmount();
    }
  });
  it.each(["text/plain", "text/csv", "text/markdown", "application/json", "application/yaml", "application/x-yaml", "application/sql"])("renders %s as literal text without navigating or executing markup", async (mimeType) => {
    const content = '<script>window.previewExecuted = true</script>\nRésumé, <img src="x">';
    const fetchFile = vi.fn().mockResolvedValue(new Response(content));
    vi.stubGlobal("fetch", fetchFile);
    render(<FilePreview file={{ ...pdf, mimeType, originalName: "notes.csv" }} url={url} onError={vi.fn()} />);
    const preview = await screen.findByRole("region", { name: "Preview of notes.csv" });
    expect(preview.textContent).toBe(content);
    expect(preview.querySelector("script, img, iframe")).toBeNull();
    expect(fetchFile).toHaveBeenCalledWith(url, expect.objectContaining({ credentials: "omit", referrerPolicy: "no-referrer" }));
  });

  it.each([['video/webm', 'video'], ['audio/wav', 'audio']])("provides controls for %s and reports playback failure", (mimeType, tag) => {
    const onError = vi.fn();
    render(<FilePreview file={{ ...pdf, mimeType }} url={url} onError={onError} />);
    const media = document.querySelector(tag!)!;
    expect(media).toHaveAttribute("controls");
    expect(media).toHaveAttribute("src", url);
    expect(media).not.toHaveAttribute("autoplay");
    fireEvent.error(media);
    expect(onError).toHaveBeenCalledOnce();
  });

  it("reports a denied text preview so the dialog can offer retry and Download", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("Forbidden", { status: 403 })));
    const onError = vi.fn();
    render(<FilePreview file={{ ...pdf, mimeType: "text/plain" }} url={url} onError={onError} />);
    await vi.waitFor(() => expect(onError).toHaveBeenCalledOnce());
  });

  it("aborts a pending text request when the preview closes", () => {
    const fetchFile = vi.fn().mockReturnValue(new Promise(() => {}));
    vi.stubGlobal("fetch", fetchFile);
    const onError = vi.fn();
    const { unmount } = render(<FilePreview file={{ ...pdf, mimeType: "text/plain" }} url={url} onError={onError} />);
    const options = fetchFile.mock.calls[0]![1] as RequestInit;
    expect(options.signal?.aborted).toBe(false);
    unmount();
    expect(options.signal?.aborted).toBe(true);
    expect(onError).not.toHaveBeenCalled();
  });
});
