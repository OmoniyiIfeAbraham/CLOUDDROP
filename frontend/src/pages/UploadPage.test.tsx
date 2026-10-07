import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "../components/ui/ToastProvider";
import { ApiError } from "../features/files/api/api-error";
import { FilesContext } from "../features/files/api/files-context";
import { createMockFilesRepository } from "../features/files/api/files-mock-repository";
import type { FilesRepository } from "../features/files/api/files-repository";
import { normalFileFixtures } from "../features/files/api/files.fixtures";
import type { FileRecord } from "../features/files/model/file.types";
import { MAX_FILE_SIZE } from "../features/upload/upload-service";
import { UploadPage } from "./UploadPage";

const renderUpload = (repository: FilesRepository) => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <FilesContext.Provider value={repository}>
          <ToastProvider><UploadPage /></ToastProvider>
        </FilesContext.Provider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return queryClient;
};

const selectFiles = (files: File[]) => {
  fireEvent.change(document.querySelector('input[type="file"]')!, { target: { files } });
};

const queueItem = (name: string) => {
  const item = screen.getAllByRole("listitem").find((entry) => entry.textContent?.includes(name));
  if (!item) throw new Error(`No queued file named ${name}`);
  return item;
};

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("upload queue states", () => {
  it("rejects unsupported and oversized files before upload", () => {
    const uploadFile = vi.fn(async () => normalFileFixtures[0]!);
    const base = createMockFilesRepository();
    renderUpload({ ...base, uploadFile });
    const oversized = new File(["x"], "huge.pdf", { type: "application/pdf" });
    Object.defineProperty(oversized, "size", { value: MAX_FILE_SIZE + 1 });
    selectFiles([new File(["x"], "run.exe", { type: "application/x-msdownload" }), oversized]);

    expect(queueItem("run.exe")).toHaveTextContent("This file type is not supported.");
    expect(queueItem("huge.pdf")).toHaveTextContent("File exceeds the 2 GB upload limit.");
    expect(screen.getByRole("button", { name: "Upload 0 files" })).toBeDisabled();
    expect(uploadFile).not.toHaveBeenCalled();
  });

  it("requires a category before submitting the queue", () => {
    const uploadFile = vi.fn(async () => normalFileFixtures[0]!);
    const base = createMockFilesRepository();
    renderUpload({ ...base, uploadFile });
    selectFiles([new File(["notes"], "notes.txt", { type: "text/plain" })]);

    fireEvent.click(screen.getByRole("button", { name: "Upload 1 file" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Choose a category before uploading.");
    expect(uploadFile).not.toHaveBeenCalled();
  });

  it("shows progress, locks the category, and refreshes files after success", async () => {
    let finishUpload!: (file: FileRecord) => void;
    const pending = new Promise<FileRecord>((resolve) => { finishUpload = resolve; });
    const uploadFile = vi.fn((_file: File, _category: string, onProgress?: (percent: number) => void) => {
      onProgress?.(40);
      return pending;
    });
    const base = createMockFilesRepository();
    const queryClient = renderUpload({ ...base, uploadFile });
    const invalidate = vi.spyOn(queryClient, "invalidateQueries");
    selectFiles([new File(["notes"], "notes.txt", { type: "text/plain" })]);
    fireEvent.change(screen.getByRole("combobox", { name: "Category" }), { target: { value: "Documents" } });

    fireEvent.click(screen.getByRole("button", { name: "Upload 1 file" }));
    expect(queueItem("notes.txt")).toHaveTextContent("Uploading 40%");
    expect(screen.getByRole("progressbar", { name: "Upload progress for notes.txt" })).toHaveValue(40);
    expect(screen.getByRole("combobox", { name: "Category" })).toBeDisabled();
    expect(uploadFile).toHaveBeenCalledWith(expect.any(File), "Documents", expect.any(Function));

    await act(async () => finishUpload(normalFileFixtures[0]!));
    expect(queueItem("notes.txt")).toHaveTextContent("Uploaded");
    expect(screen.getByRole("link", { name: "View uploaded files" })).toHaveAttribute("href", "/files");
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["files"] });
  });

  it("offers retry for transient failures and completes on a later attempt", async () => {
    const uploadFile = vi.fn(async () => normalFileFixtures[0]!)
      .mockRejectedValueOnce(new ApiError({ message: "Offline", code: "NETWORK_ERROR", retryable: true }));
    const base = createMockFilesRepository();
    renderUpload({ ...base, uploadFile });
    selectFiles([new File(["notes"], "notes.txt", { type: "text/plain" })]);
    fireEvent.change(screen.getByRole("combobox", { name: "Category" }), { target: { value: "Documents" } });

    fireEvent.click(screen.getByRole("button", { name: "Upload 1 file" }));
    await waitFor(() => expect(queueItem("notes.txt")).toHaveTextContent("Could not connect. Check your connection and try again."));
    fireEvent.click(await screen.findByRole("button", { name: "Retry" }));
    fireEvent.click(screen.getByRole("button", { name: "Upload 1 file" }));
    await waitFor(() => expect(queueItem("notes.txt")).toHaveTextContent("Uploaded"));
    expect(uploadFile).toHaveBeenCalledTimes(2);
  });

  it("does not offer retry for a permanent backend rejection", async () => {
    const uploadFile = vi.fn(async () => { throw new ApiError({ message: "Invalid upload", code: "INVALID_UPLOAD", status: 400 }); });
    const base = createMockFilesRepository();
    renderUpload({ ...base, uploadFile });
    selectFiles([new File(["notes"], "notes.txt", { type: "text/plain" })]);
    fireEvent.change(screen.getByRole("combobox", { name: "Category" }), { target: { value: "Documents" } });

    fireEvent.click(screen.getByRole("button", { name: "Upload 1 file" }));
    await waitFor(() => expect(queueItem("notes.txt")).toHaveTextContent("Check the file and category, then try again."));
    expect(screen.queryByRole("button", { name: "Retry" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Upload 0 files" })).toBeDisabled();
  });

  it("keeps per-file outcomes separate in a mixed batch", async () => {
    const uploadFile = vi.fn(async () => normalFileFixtures[0]!)
      .mockRejectedValueOnce(new ApiError({ message: "Offline", code: "NETWORK_ERROR", retryable: true }));
    const base = createMockFilesRepository();
    renderUpload({ ...base, uploadFile });
    selectFiles([
      new File(["one"], "first.txt", { type: "text/plain" }),
      new File(["two"], "second.txt", { type: "text/plain" }),
    ]);
    fireEvent.change(screen.getByRole("combobox", { name: "Category" }), { target: { value: "Documents" } });

    fireEvent.click(screen.getByRole("button", { name: "Upload 2 files" }));
    await waitFor(() => expect(uploadFile).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(queueItem("first.txt")).toHaveTextContent("Could not connect. Check your connection and try again."));
    expect(queueItem("second.txt")).toHaveTextContent("Uploaded");
    expect(screen.getByRole("status")).toHaveTextContent("1 file uploaded.");
  });

  it("adds dropped files to the queue", () => {
    renderUpload(createMockFilesRepository());
    const dropZone = screen.getByRole("heading", { name: "Drop files here" }).closest(".drop-zone")!;
    fireEvent.dragEnter(dropZone);
    expect(dropZone).toHaveClass("drop-zone--active");
    fireEvent.drop(dropZone, { dataTransfer: { files: [new File(["notes"], "dropped.txt", { type: "text/plain" })] } });
    expect(queueItem("dropped.txt")).toHaveTextContent("Ready");
    expect(dropZone).not.toHaveClass("drop-zone--active");
  });
});
