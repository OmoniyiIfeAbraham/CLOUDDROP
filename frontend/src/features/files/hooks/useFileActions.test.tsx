import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "../../../components/ui/ToastProvider";
import { FilesPage } from "../../../pages/FilesPage";
import { ApiError } from "../api/api-error";
import { FilesContext } from "../api/files-context";
import { createMockFilesRepository } from "../api/files-mock-repository";
import type { FilesRepository } from "../api/files-repository";
import { normalFileFixtures } from "../api/files.fixtures";
import type { ShareResult } from "../model/file.types";

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

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("file actions", () => {
  it("requests a fresh HTTPS download URL for each action", async () => {
    const base = createMockFilesRepository();
    let issued = 0;
    const getDownload = vi.fn(async (id: string) => ({
      ...await base.getDownload(id),
      downloadUrl: `https://example.invalid/download/${++issued}`,
    }));
    const opened: string[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
      opened.push(this.href);
    });
    renderActions({ ...base, getDownload });

    const button = await screen.findByRole("button", { name: `Download ${firstFile.originalName}` });
    fireEvent.click(button);
    await waitFor(() => expect(opened).toHaveLength(1));
    fireEvent.click(button);
    await waitFor(() => expect(opened).toHaveLength(2));
    expect(opened).toEqual([
      "https://example.invalid/download/1",
      "https://example.invalid/download/2",
    ]);
    expect(getDownload).toHaveBeenCalledTimes(2);
  });

  it("does not open a non-HTTPS download URL", async () => {
    const base = createMockFilesRepository();
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    renderActions({
      ...base,
      getDownload: async (id) => ({ ...await base.getDownload(id), downloadUrl: "http://example.invalid/file" }),
    });

    fireEvent.click(await screen.findByRole("button", { name: `Download ${firstFile.originalName}` }));
    expect(await screen.findByText("The download link could not be opened.")).toBeVisible();
    expect(click).not.toHaveBeenCalled();
  });

  it("keeps a failed share open and can request a new link", async () => {
    const base = createMockFilesRepository();
    const getTemporaryShare = vi.fn((id: string) => base.getTemporaryShare(id))
      .mockRejectedValueOnce(new ApiError({ message: "Unavailable", code: "SHARE_FAILED", status: 500, retryable: true }));
    renderActions({ ...base, getTemporaryShare });

    fireEvent.click(await screen.findByRole("button", { name: `Share ${firstFile.originalName}` }));
    expect(await screen.findByRole("alert")).toHaveTextContent("The share link could not be created.");
    fireEvent.click(screen.getByRole("button", { name: "Create new link" }));
    expect(await screen.findByRole("textbox", { name: "Temporary link" })).toHaveValue(`https://example.invalid/share/${firstFile.id}`);
    expect(getTemporaryShare).toHaveBeenCalledTimes(2);
  });

  it("does not expose a non-HTTPS share URL", async () => {
    const base = createMockFilesRepository();
    renderActions({
      ...base,
      getTemporaryShare: async (id) => ({ ...await base.getTemporaryShare(id), shareUrl: "http://example.invalid/share" }),
    });

    fireEvent.click(await screen.findByRole("button", { name: `Share ${firstFile.originalName}` }));
    expect(await screen.findByRole("alert")).toHaveTextContent("The share link could not be created.");
    expect(screen.queryByRole("textbox", { name: "Temporary link" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Open link" })).not.toBeInTheDocument();
  });

  it("removes an expired share URL and offers renewal", async () => {
    const base = createMockFilesRepository();
    const getTemporaryShare = vi.fn(async (id: string) => ({ ...await base.getTemporaryShare(id), expiresIn: 0.05 }));
    renderActions({ ...base, getTemporaryShare });

    fireEvent.click(await screen.findByRole("button", { name: `Share ${firstFile.originalName}` }));
    expect(await screen.findByRole("textbox", { name: "Temporary link" })).toBeVisible();
    expect(await screen.findByRole("alert")).toHaveTextContent("This link has expired. Create a new one.");
    expect(screen.queryByRole("textbox", { name: "Temporary link" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Create new link" }));
    await waitFor(() => expect(getTemporaryShare).toHaveBeenCalledTimes(2));
  });

  it("ignores a share result from a dialog that was closed", async () => {
    let resolveOld!: (result: ShareResult) => void;
    const oldRequest = new Promise<ShareResult>((resolve) => { resolveOld = resolve; });
    const base = createMockFilesRepository();
    const getTemporaryShare = vi.fn((id: string) => id === firstFile.id ? oldRequest : base.getTemporaryShare(id));
    renderActions({ ...base, getTemporaryShare });

    fireEvent.click(await screen.findByRole("button", { name: `Share ${firstFile.originalName}` }));
    expect(screen.getByText("Creating secure link...")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Close dialog" }));
    fireEvent.click(screen.getByRole("button", { name: `Share ${secondFile.originalName}` }));
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
    const cancel = new Event("cancel", { bubbles: false, cancelable: true });
    fireEvent(dialog, cancel);
    expect(cancel.defaultPrevented).toBe(true);
    expect(dialog).toBeVisible();

    await act(async () => finishDelete());
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Delete file?" })).not.toBeInTheDocument());
  });
});
