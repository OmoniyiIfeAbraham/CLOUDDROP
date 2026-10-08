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

const fakeTab = () => ({ opener: {} as unknown, closed: false, location: { href: "" }, close: vi.fn() });

const openShare = async (file: typeof firstFile) => {
  fireEvent.click(await screen.findByRole("button", { name: `Share ${file.originalName}` }));
  fireEvent.click(screen.getByRole("button", { name: "Create link" }));
};

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("file actions", () => {
  it("opens the download tab during the click, then sends it to a fresh URL", async () => {
    const base = createMockFilesRepository();
    let issued = 0;
    const getDownload = vi.fn(async (id: string) => ({
      ...await base.getDownload(id),
      downloadUrl: `https://example.invalid/download/${++issued}`,
    }));
    const tabs = [fakeTab(), fakeTab()];
    const open = vi.spyOn(window, "open").mockImplementation(() => tabs[open.mock.calls.length - 1] as unknown as Window);
    renderActions({ ...base, getDownload });

    const button = await screen.findByRole("button", { name: `Download ${firstFile.originalName}` });
    fireEvent.click(button);
    expect(open).toHaveBeenCalledWith("", "_blank");
    await waitFor(() => expect(tabs[0]!.location.href).toBe("https://example.invalid/download/1"));
    fireEvent.click(button);
    await waitFor(() => expect(tabs[1]!.location.href).toBe("https://example.invalid/download/2"));
    expect(tabs[0]!.opener).toBeNull();
    expect(getDownload).toHaveBeenCalledTimes(2);
  });

  it("falls back to a link when the browser blocks the new tab", async () => {
    const opened: string[] = [];
    vi.spyOn(window, "open").mockReturnValue(null);
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
      opened.push(this.href);
    });
    renderActions(createMockFilesRepository());

    fireEvent.click(await screen.findByRole("button", { name: `Download ${firstFile.originalName}` }));
    await waitFor(() => expect(opened).toEqual([`https://example.invalid/download/${firstFile.id}`]));
  });

  it("closes the download tab and explains a missing file", async () => {
    const tab = fakeTab();
    vi.spyOn(window, "open").mockReturnValue(tab as unknown as Window);
    renderActions({
      ...createMockFilesRepository(),
      getDownload: async () => { throw new ApiError({ message: "File not found", code: "NOT_FOUND", status: 404 }); },
    });

    fireEvent.click(await screen.findByRole("button", { name: `Download ${firstFile.originalName}` }));
    expect(await screen.findByText("That file is no longer available.")).toBeVisible();
    expect(tab.close).toHaveBeenCalled();
    expect(tab.location.href).toBe("");
  });

  it("does not open a non-HTTPS download URL", async () => {
    const base = createMockFilesRepository();
    const tab = fakeTab();
    vi.spyOn(window, "open").mockReturnValue(tab as unknown as Window);
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    renderActions({
      ...base,
      getDownload: async (id) => ({ ...await base.getDownload(id), downloadUrl: "http://example.invalid/file" }),
    });

    fireEvent.click(await screen.findByRole("button", { name: `Download ${firstFile.originalName}` }));
    expect(await screen.findByText("The download link could not be opened.")).toBeVisible();
    expect(tab.close).toHaveBeenCalled();
    expect(tab.location.href).toBe("");
    expect(click).not.toHaveBeenCalled();
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
    const getTemporaryShare = vi.fn(async (id: string) => ({ ...await base.getTemporaryShare(id), expiresIn: 0.05 }));
    renderActions({ ...base, getTemporaryShare });

    await openShare(firstFile);
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
    const cancel = new Event("cancel", { bubbles: false, cancelable: true });
    fireEvent(dialog, cancel);
    expect(cancel.defaultPrevented).toBe(true);
    expect(dialog).toBeVisible();

    await act(async () => finishDelete());
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Delete file?" })).not.toBeInTheDocument());
  });
});
