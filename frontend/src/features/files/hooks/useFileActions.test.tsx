import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { formatDateTime } from "../../../lib/format";
import { ToastProvider } from "../../../components/ui/ToastProvider";
import { FilesPage } from "../../../pages/FilesPage";
import { ApiError } from "../api/api-error";
import { FilesContext } from "../api/files-context";
import { createMockFilesRepository } from "../api/files-mock-repository";
import type { FilesRepository } from "../api/files-repository";
import { normalFileFixtures } from "../api/files.fixtures";
import type { DownloadResult, ShareResult } from "../model/file.types";

const attachmentUrl = 'https://example.invalid/download?response-content-disposition=attachment%3B%20filename%3D%22notes.txt%22&response-content-type=application%2Foctet-stream&X-Amz-Signature=example';
beforeEach(() => { vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {}); });

const firstFile = normalFileFixtures[0]!;
const secondFile = normalFileFixtures[1]!;

const renderActions = (repository: FilesRepository) => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <FilesContext.Provider value={repository}>
          <ToastProvider><FilesPage /></ToastProvider>
        </FilesContext.Provider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
};

const openShare = async (file: typeof firstFile) => {
  fireEvent.click(await screen.findByRole("button", { name: `Share ${file.originalName}` }));
  fireEvent.click(screen.getByRole("button", { name: "Create link" }));
};

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("file actions", () => {
  it("does not turn Download into viewing when the backend returns an inline link", async () => {
    const base = createMockFilesRepository();
    let issued = 0;
    const getDownload = vi.fn(async (id: string) => ({
      ...await base.getDownload(id),
      downloadUrl: `https://example.invalid/download/${++issued}`,
    }));
    const open = vi.spyOn(window, "open").mockReturnValue(null);
    renderActions({ ...base, getDownload });

    const button = await screen.findByRole("button", { name: `Download ${firstFile.originalName}` });
    fireEvent.click(button);
    expect(await screen.findByRole("alert")).toHaveTextContent("Direct download is not available");
    expect(screen.queryByRole("link", { name: "Open file" })).not.toBeInTheDocument();
    expect(screen.queryByText(/Download started/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Close dialog" }));
    fireEvent.click(button);
    expect(await screen.findByRole("alert")).toHaveTextContent("Direct download is not available");
    expect(HTMLAnchorElement.prototype.click).not.toHaveBeenCalled();
    expect(open).not.toHaveBeenCalled();
    expect(getDownload).toHaveBeenCalledTimes(2);
  });

  it("starts a filename-preserving download automatically from the initial click", async () => {
    const base = createMockFilesRepository();
    const url = 'https://example.invalid/download?response-content-disposition=attachment%3B%20filename%3D%22notes.txt%22&response-content-type=application%2Foctet-stream&X-Amz-Signature=example';
    renderActions({ ...base, getDownload: async (id) => ({ ...await base.getDownload(id), downloadUrl: url }) });

    fireEvent.click(await screen.findByRole("button", { name: `Download ${firstFile.originalName}` }));
    const save = await screen.findByRole("link", { name: "Save file" });
    expect(save).toHaveAttribute("href", url);
    expect(save).toHaveAttribute("download", firstFile.originalName);
    expect(save).toHaveAttribute("rel", "noopener noreferrer");
    expect(save).toHaveAttribute("target", "_self");
    expect(HTMLAnchorElement.prototype.click).toHaveBeenCalledOnce();
    const automatic = vi.mocked(HTMLAnchorElement.prototype.click).mock.contexts[0] as HTMLAnchorElement;
    expect(automatic.href).toBe(url);
    expect(automatic.download).toBe(firstFile.originalName);
    expect(automatic.referrerPolicy).toBe("no-referrer");
  });

  it("rejects attachment links that lack binary delivery", async () => {
    const base = createMockFilesRepository();
    renderActions({ ...base, getDownload: async (id) => ({
      ...await base.getDownload(id),
      downloadUrl: "https://example.invalid/download?response-content-disposition=attachment",
    }) });
    fireEvent.click(await screen.findByRole("button", { name: `Download ${firstFile.originalName}` }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Direct download is not available");
    expect(HTMLAnchorElement.prototype.click).not.toHaveBeenCalled();
    expect(screen.queryByRole("link", { name: "Save file" })).not.toBeInTheDocument();
  });

  it("explains a missing file in the download dialog without opening a link", async () => {
    renderActions({
      ...createMockFilesRepository(),
      getDownload: async () => { throw new ApiError({ message: "File not found", code: "NOT_FOUND", status: 404 }); },
    });

    fireEvent.click(await screen.findByRole("button", { name: `Download ${firstFile.originalName}` }));
    expect(await screen.findByText("That file is no longer available.")).toBeVisible();
    expect(screen.getByRole("dialog", { name: "Download file" })).toBeVisible();
    expect(screen.queryByRole("link", { name: "Open file" })).not.toBeInTheDocument();
  });

  it("does not open a non-HTTPS download URL", async () => {
    const base = createMockFilesRepository();
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    renderActions({
      ...base,
      getDownload: async (id) => ({ ...await base.getDownload(id), downloadUrl: "http://example.invalid/file" }),
    });

    fireEvent.click(await screen.findByRole("button", { name: `Download ${firstFile.originalName}` }));
    expect(await screen.findByText("The download link could not be created. Please try again.")).toBeVisible();
    expect(screen.queryByRole("link", { name: "Open file" })).not.toBeInTheDocument();
    expect(click).not.toHaveBeenCalled();
  });

  it("lets the user cancel preparation and ignores a late response", async () => {
    let resolveDownload!: (result: DownloadResult) => void;
    const pending = new Promise<DownloadResult>((resolve) => { resolveDownload = resolve; });
    const base = createMockFilesRepository();
    const getDownload = vi.fn(() => pending);
    renderActions({ ...base, getDownload });
    const button = await screen.findByRole("button", { name: `Download ${firstFile.originalName}` });
    fireEvent.click(button);
    expect(screen.getByText("Preparing your download...")).toBeVisible();
    fireEvent.click(button);
    expect(getDownload).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    await act(async () => resolveDownload(await base.getDownload(firstFile.id)));
    expect(screen.queryByRole("dialog", { name: "Download file" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Open file" })).not.toBeInTheDocument();
    expect(button).toBeEnabled();
  });

  it("retries a failed download request with a new link", async () => {
    const base = createMockFilesRepository();
    const getDownload = vi.fn(async (id: string) => ({ ...await base.getDownload(id), downloadUrl: attachmentUrl }))
      .mockRejectedValueOnce(new ApiError({ message: "Unavailable", code: "DOWNLOAD_FAILED", status: 500, retryable: true }));
    renderActions({ ...base, getDownload });
    fireEvent.click(await screen.findByRole("button", { name: `Download ${firstFile.originalName}` }));
    expect(await screen.findByRole("alert")).toHaveTextContent("The download link could not be created.");
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByRole("link", { name: "Save file" })).toHaveAttribute("href", attachmentUrl);
    expect(getDownload).toHaveBeenCalledTimes(2);
  });

  it("removes expired download links and can request a fresh one", async () => {
    const base = createMockFilesRepository();
    const getDownload = vi.fn(async (id: string) => ({ ...await base.getDownload(id), downloadUrl: attachmentUrl, expiresIn: 0.1 }));
    renderActions({ ...base, getDownload });
    fireEvent.click(await screen.findByRole("button", { name: `Download ${firstFile.originalName}` }));
    expect(await screen.findByRole("link", { name: "Save file" })).toBeVisible();
    expect(await screen.findByRole("alert")).toHaveTextContent("This file link has expired.");
    expect(screen.queryByRole("link", { name: "Save file" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    await waitFor(() => expect(getDownload).toHaveBeenCalledTimes(2));
  });

  it("uses View to preview an image without initiating a download", async () => {
    const base = createMockFilesRepository();
    const getDownload = vi.fn((id: string) => base.getDownload(id));
    const getView = vi.fn((id: string) => base.getView(id));
    renderActions({ ...base, getDownload, getView });
    fireEvent.click(await screen.findByRole("button", { name: `View ${secondFile.originalName}` }));
    const image = await screen.findByRole("img", { name: secondFile.originalName });
    expect(image).toHaveAttribute("src", `https://example.invalid/view/${secondFile.id}`);
    expect(screen.getByRole("dialog", { name: "View file" })).toBeVisible();
    expect(getView).toHaveBeenCalledWith(secondFile.id);
    expect(getDownload).not.toHaveBeenCalled();
    expect(HTMLAnchorElement.prototype.click).not.toHaveBeenCalled();
    fireEvent.error(image);
    expect(await screen.findByRole("alert")).toHaveTextContent("The preview could not be loaded");
  });


  it("previews CSV inline without initiating a download", async () => {
    const csv = {
      ...firstFile,
      mimeType: "text/csv",
      originalName: "records.csv",
    };

    const base = createMockFilesRepository({ files: [csv] });
    const getView = vi.fn((id: string) => base.getView(id));

    renderActions({ ...base, getView });

    fireEvent.click(
      await screen.findByRole("button", { name: "View records.csv" }),
    );

    expect(
      await screen.findByTitle("Preview of records.csv"),
    ).toBeVisible();

    expect(document.querySelector("iframe")).not.toBeNull();

    expect(HTMLAnchorElement.prototype.click).not.toHaveBeenCalled();
  });


  it("explains a preview the backend refuses", async () => {
    const base = createMockFilesRepository();
    renderActions({ ...base, getView: async () => { throw new ApiError({ message: "Preview is not supported for this file type", code: "PREVIEW_NOT_SUPPORTED", status: 415 }); } });
    fireEvent.click(await screen.findByRole("button", { name: `View ${secondFile.originalName}` }));
    expect(await screen.findByRole("alert")).toHaveTextContent("A preview is not available for this file type. Use Download to save it.");
  });

  it("waits for the user to choose an expiry before creating a link", async () => {
    const base = createMockFilesRepository();
    const getTemporaryShare = vi.fn((id: string, ttlHours?: number) => base.getTemporaryShare(id, ttlHours));
    renderActions({ ...base, getTemporaryShare });

    fireEvent.click(await screen.findByRole("button", { name: `Share ${firstFile.originalName}` }));
    expect(screen.getByRole("radio", { name: "1 day" })).toBeChecked();
    expect(getTemporaryShare).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("radio", { name: "7 days" }));
    fireEvent.click(screen.getByRole("button", { name: "Create link" }));
    expect(await screen.findByRole("textbox", { name: "Temporary link" })).toHaveValue(`https://example.invalid/share/${firstFile.id}`);
    expect(getTemporaryShare).toHaveBeenCalledWith(firstFile.id, 168);
    expect(screen.getByText(/Expires in 7 days, on /)).toBeVisible();
    expect(screen.queryByRole("radio", { name: "7 days" })).not.toBeInTheDocument();
  });

  it("preserves a short CloudDrop share URL and its backend expiry", async () => {
    const base = createMockFilesRepository();
    const shareUrl = "https://clouddrop-c8.duckdns.org/s/Ab7kP2xQ";
    const expiresAt = new Date(Date.now() + 180_000).toISOString();
    renderActions({ ...base, getTemporaryShare: async (id) => ({ ...await base.getTemporaryShare(id), shareUrl, expiresAt }) });
    await openShare(firstFile);
    expect(await screen.findByRole("textbox", { name: "Temporary link" })).toHaveValue(shareUrl);
    expect(screen.getByRole("link", { name: "Open link" })).toHaveAttribute("href", shareUrl);
    expect(screen.getByRole("link", { name: "Open link" })).toHaveAttribute("rel", "noopener noreferrer");
    expect(screen.getByText(/Expires in 3 minutes/)).toHaveTextContent(formatDateTime(Date.parse(expiresAt)));
  });

  it("does not expose a link whose backend expiry has already passed", async () => {
    const base = createMockFilesRepository();
    renderActions({ ...base, getTemporaryShare: async (id) => ({ ...await base.getTemporaryShare(id), expiresIn: 86400, expiresAt: new Date(Date.now() - 1000).toISOString() }) });
    await openShare(firstFile);
    expect(await screen.findByRole("alert")).toHaveTextContent("This link has expired. Create a new one.");
    expect(screen.queryByRole("textbox", { name: "Temporary link" })).not.toBeInTheDocument();
  });

  it("keeps a failed share open and can request a new link", async () => {
    const base = createMockFilesRepository();
    const getTemporaryShare = vi.fn((id: string, ttlHours?: number) => base.getTemporaryShare(id, ttlHours))
      .mockRejectedValueOnce(new ApiError({ message: "Unavailable", code: "SHARE_FAILED", status: 500, retryable: true }));
    renderActions({ ...base, getTemporaryShare });

    await openShare(firstFile);
    expect(await screen.findByRole("alert")).toHaveTextContent("The share link could not be created.");
    fireEvent.click(screen.getByRole("button", { name: "Create new link" }));
    expect(await screen.findByRole("textbox", { name: "Temporary link" })).toHaveValue(`https://example.invalid/share/${firstFile.id}`);
    expect(getTemporaryShare).toHaveBeenCalledTimes(2);
    expect(screen.getByText(/Expires in 1 day, on /)).toBeVisible();
  });

  it("does not expose a non-HTTPS share URL", async () => {
    const base = createMockFilesRepository();
    renderActions({
      ...base,
      getTemporaryShare: async (id) => ({ ...await base.getTemporaryShare(id), shareUrl: "http://example.invalid/share" }),
    });

    await openShare(firstFile);
    expect(await screen.findByRole("alert")).toHaveTextContent("The share link could not be created.");
    expect(screen.queryByRole("textbox", { name: "Temporary link" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Open link" })).not.toBeInTheDocument();
  });

  it("removes an expired share URL and offers renewal", async () => {
    const base = createMockFilesRepository();
    const getTemporaryShare = vi.fn(async (id: string) => ({
      ...await base.getTemporaryShare(id),
      expiresIn: 1,
      expiresAt: new Date(Date.now() + 1000).toISOString(),
    }));
    renderActions({ ...base, getTemporaryShare });

    await openShare(firstFile);

    expect(await screen.findByRole("textbox", { name: "Temporary link" })).toBeVisible();

    await waitFor(
      () => {
        expect(screen.queryByRole("textbox", { name: "Temporary link" })).not.toBeInTheDocument();
        expect(screen.getByRole("alert")).toHaveTextContent("This link has expired. Create a new one.");
      },
      { timeout: 3000 },
    );

    fireEvent.click(screen.getByRole("button", { name: "Create new link" }));
    await waitFor(() => expect(getTemporaryShare).toHaveBeenCalledTimes(2));
  });

  it("ignores a share result from a dialog that was closed", async () => {
    let resolveOld!: (result: ShareResult) => void;
    const oldRequest = new Promise<ShareResult>((resolve) => { resolveOld = resolve; });
    const base = createMockFilesRepository();
    const getTemporaryShare = vi.fn((id: string) => id === firstFile.id ? oldRequest : base.getTemporaryShare(id));
    renderActions({ ...base, getTemporaryShare });

    await openShare(firstFile);
    expect(screen.getByText("Creating secure link...")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Close dialog" }));
    await openShare(secondFile);
    expect(await screen.findByRole("textbox", { name: "Temporary link" })).toHaveValue(`https://example.invalid/share/${secondFile.id}`);

    await act(async () => resolveOld(await base.getTemporaryShare(firstFile.id)));
    expect(screen.getByRole("textbox", { name: "Temporary link" })).toHaveValue(`https://example.invalid/share/${secondFile.id}`);
  });

  it("keeps the file and dialog visible after deletion fails, then retries", async () => {
    const base = createMockFilesRepository();
    const deleteFile = vi.fn((id: string) => base.deleteFile(id))
      .mockRejectedValueOnce(new ApiError({ message: "Unavailable", code: "DELETE_FAILED", status: 500, retryable: true }));
    renderActions({ ...base, deleteFile });

    fireEvent.click(await screen.findByRole("button", { name: `Delete ${firstFile.originalName}` }));
    fireEvent.click(screen.getByRole("button", { name: "Delete file" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("The file could not be deleted.");
    expect(screen.getByRole("link", { name: firstFile.originalName })).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Delete file" }));
    await waitFor(() => expect(screen.queryByRole("link", { name: firstFile.originalName })).not.toBeInTheDocument());
    expect(deleteFile).toHaveBeenCalledTimes(2);
  });

  it("does not dismiss a busy delete dialog with Escape", async () => {
    let finishDelete!: () => void;
    const pending = new Promise<void>((resolve) => { finishDelete = resolve; });
    const base = createMockFilesRepository();
    renderActions({ ...base, deleteFile: () => pending });

    fireEvent.click(await screen.findByRole("button", { name: `Delete ${firstFile.originalName}` }));
    fireEvent.click(screen.getByRole("button", { name: "Delete file" }));
    expect(screen.getByRole("button", { name: "Deleting..." })).toBeDisabled();
    const dialog = screen.getByRole("dialog", { name: "Delete file?" });
    expect(screen.getByRole("button", { name: "Close dialog" })).toBeDisabled();
    const cancel = new Event("cancel", { bubbles: false, cancelable: true });
    fireEvent(dialog, cancel);
    expect(cancel.defaultPrevented).toBe(true);
    expect(dialog).toBeVisible();

    await act(async () => finishDelete());
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Delete file?" })).not.toBeInTheDocument());
  });
});
