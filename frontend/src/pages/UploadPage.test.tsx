import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "../components/ui/ToastProvider";
import { AuthContext } from "../features/auth/auth-context";
import type { AuthContextValue } from "../features/auth/auth-context";
import { ApiError } from "../features/files/api/api-error";
import { FilesContext } from "../features/files/api/files-context";
import { createMockFilesRepository } from "../features/files/api/files-mock-repository";
import type { FilesRepository } from "../features/files/api/files-repository";
import { normalFileFixtures } from "../features/files/api/files.fixtures";
import type { FileRecord } from "../features/files/model/file.types";
import { MAX_FILE_SIZE } from "../features/upload/upload-service";
import { UploadQueueProvider } from "../features/upload/UploadQueueProvider";
import { UploadPage } from "./UploadPage";

const signedInAs = (id: string): AuthContextValue => ({
  user: { id, firstName: "Ada", lastName: "Lovelace", email: `${id}@example.test` },
  status: "authenticated",
  login: async () => {},
  verifyEmail: async () => {},
  resendVerificationEmail: async () => {},
  register: async () => ({
    user: {
      id: "test-user",
      firstName: "Test",
      lastName: "User",
      email: "test@example.com",
    },
  }),
  logout: () => {},
  retryRestore: async () => {},
});

const renderUpload = (repository: FilesRepository) => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const tree = (userId: string, page: ReactNode) => (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <AuthContext.Provider value={signedInAs(userId)}>
          <FilesContext.Provider value={repository}>
            <ToastProvider><UploadQueueProvider>{page}</UploadQueueProvider></ToastProvider>
          </FilesContext.Provider>
        </AuthContext.Provider>
      </MemoryRouter>
    </QueryClientProvider>
  );
  const view = render(tree("user-1", <UploadPage />));
  return { queryClient, rerender: (userId: string, page: ReactNode) => view.rerender(tree(userId, page)) };
};

const selectFiles = (files: File[]) => {
  fireEvent.change(document.querySelector('input[type="file"]')!, { target: { files } });
};

const queueItem = (name: string) => {
  const item = screen.getAllByRole("listitem").find((entry) => entry.textContent?.includes(name));
  if (!item) throw new Error(`No queued file named ${name}`);
  return item;
};

const deferredUpload = () => {
  let finish!: (file: FileRecord) => void;
  const pending = new Promise<FileRecord>((resolve) => { finish = resolve; });
  return { pending, finish: (file: FileRecord) => finish(file) };
};

const cancellableUpload = () => vi.fn((_file: File, _onProgress?: (percent: number) => void, signal?: AbortSignal) =>
  new Promise<FileRecord>((_resolve, reject) => {
    signal?.addEventListener("abort", () => reject(new ApiError({ message: "Upload was cancelled.", code: "UPLOAD_CANCELLED" })));
  }));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("upload queue states", () => {
  it("rejects unsupported and oversized files before upload", () => {
    const uploadFile = vi.fn(async () => normalFileFixtures[0]!);
    renderUpload({ ...createMockFilesRepository(), uploadFile });
    const oversized = new File(["x"], "huge.pdf", { type: "application/pdf" });
    Object.defineProperty(oversized, "size", { value: MAX_FILE_SIZE + 1 });
    selectFiles([new File(["x"], "run.exe", { type: "application/x-msdownload" }), oversized]);

    expect(queueItem("run.exe")).toHaveTextContent("This file type is not supported.");
    expect(queueItem("huge.pdf")).toHaveTextContent("File exceeds the 25 MB upload limit.");
    expect(screen.queryByRole("combobox", { name: "Category for run.exe" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "No files ready" })).toBeDisabled();
    expect(uploadFile).not.toHaveBeenCalled();
  });

  it("shows fixed file-type categories for a mixed queue and keeps them after upload", async () => {
    const uploadFile = vi.fn<FilesRepository["uploadFile"]>(async () => normalFileFixtures[0]!);
    renderUpload({ ...createMockFilesRepository(), uploadFile });
    const files = [
      new File(["pdf"], "notes.pdf", { type: "application/pdf" }),
      new File(["png"], "photo.png", { type: "image/png" }),
      new File(["mp4"], "clip.mp4", { type: "video/mp4" }),
      new File(["mp3"], "song.mp3", { type: "audio/mpeg" }),
      new File(["zip"], "backup.zip", { type: "application/zip" }),
    ];
    selectFiles(files);
    const categories = ["Documents", "Images", "Videos", "Audio", "Archives"];
    files.forEach((file, index) => {
      expect(screen.getByLabelText(`Category for ${file.name}: ${categories[index]}`)).toHaveTextContent(categories[index]!);
    });
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Upload 5 files" }));
    await waitFor(() => expect(queueItem("backup.zip")).toHaveTextContent("Uploaded to Archives"));
    expect(uploadFile.mock.calls.map(([file]) => file.name)).toEqual(files.map((file) => file.name));
    files.forEach((file, index) => expect(queueItem(file.name)).toHaveTextContent(`Uploaded to ${categories[index]}`));
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
  });

  it("shows progress, keeps categories read-only, and refreshes files after success", async () => {
    const upload = deferredUpload();
    const uploadFile = vi.fn((_file: File, onProgress?: (percent: number) => void) => {
      onProgress?.(40);
      return upload.pending;
    });
    const { queryClient } = renderUpload({ ...createMockFilesRepository(), uploadFile });
    const invalidate = vi.spyOn(queryClient, "invalidateQueries");
    selectFiles([new File(["notes"], "notes.txt", { type: "text/plain" })]);

    fireEvent.click(screen.getByRole("button", { name: "Upload 1 file" }));
    expect(queueItem("notes.txt")).toHaveTextContent("Uploading 40%");
    expect(screen.getByRole("progressbar", { name: "Upload progress for notes.txt" })).toHaveValue(40);
    expect(screen.getByLabelText("Category for notes.txt: Documents")).toHaveTextContent("Documents");
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    expect(uploadFile).toHaveBeenCalledWith(expect.any(File), expect.any(Function), expect.any(AbortSignal));

    await act(async () => upload.finish(normalFileFixtures[0]!));
    expect(queueItem("notes.txt")).toHaveTextContent("Uploaded");
    expect(screen.getByRole("link", { name: "View uploaded files" })).toHaveAttribute("href", "/files");
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["files"] });
  });

  it("offers retry for transient failures and completes on a later attempt", async () => {
    const uploadFile = vi.fn(async () => normalFileFixtures[0]!)
      .mockRejectedValueOnce(new ApiError({ message: "Offline", code: "NETWORK_ERROR", retryable: true }));
    renderUpload({ ...createMockFilesRepository(), uploadFile });
    selectFiles([new File(["notes"], "notes.txt", { type: "text/plain" })]);

    fireEvent.click(screen.getByRole("button", { name: "Upload 1 file" }));
    await waitFor(() => expect(queueItem("notes.txt")).toHaveTextContent("Could not connect. Check your connection and try again."));
    fireEvent.click(await screen.findByRole("button", { name: "Retry" }));
    fireEvent.click(screen.getByRole("button", { name: "Upload 1 file" }));
    await waitFor(() => expect(queueItem("notes.txt")).toHaveTextContent("Uploaded"));
    expect(uploadFile).toHaveBeenCalledTimes(2);
  });

  it("does not offer retry for a permanent backend rejection", async () => {
    const uploadFile = vi.fn(async () => { throw new ApiError({ message: "Invalid upload", code: "INVALID_UPLOAD", status: 400 }); });
    renderUpload({ ...createMockFilesRepository(), uploadFile });
    selectFiles([new File(["notes"], "notes.txt", { type: "text/plain" })]);

    fireEvent.click(screen.getByRole("button", { name: "Upload 1 file" }));
    await waitFor(() => expect(queueItem("notes.txt")).toHaveTextContent("This file could not be uploaded. Check it and try again."));
    expect(screen.queryByRole("button", { name: "Retry" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "No files ready" })).toBeDisabled();
  });

  it("explains a proxy size rejection instead of reporting unexpected data", async () => {
    const uploadFile = vi.fn(async () => { throw new ApiError({ message: "Too large", code: "PAYLOAD_TOO_LARGE", status: 413 }); });
    renderUpload({ ...createMockFilesRepository(), uploadFile });
    selectFiles([new File(["notes"], "notes.txt", { type: "text/plain" })]);

    fireEvent.click(screen.getByRole("button", { name: "Upload 1 file" }));
    await waitFor(() => expect(queueItem("notes.txt")).toHaveTextContent("The server rejected this file because it is too large."));
  });

  it("keeps per-file outcomes separate in a mixed batch", async () => {
    const uploadFile = vi.fn(async () => normalFileFixtures[0]!)
      .mockRejectedValueOnce(new ApiError({ message: "Offline", code: "NETWORK_ERROR", retryable: true }));
    renderUpload({ ...createMockFilesRepository(), uploadFile });
    selectFiles([
      new File(["one"], "first.txt", { type: "text/plain" }),
      new File(["two"], "second.txt", { type: "text/plain" }),
    ]);

    fireEvent.click(screen.getByRole("button", { name: "Upload 2 files" }));
    await waitFor(() => expect(uploadFile).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(queueItem("first.txt")).toHaveTextContent("Could not connect. Check your connection and try again."));
    expect(queueItem("second.txt")).toHaveTextContent("Uploaded");
    expect(screen.getByText("1 file uploaded.")).toBeVisible();
  });

  it("cancels the active upload and leaves the rest of the queue ready", async () => {
    const uploadFile = cancellableUpload();
    renderUpload({ ...createMockFilesRepository(), uploadFile });
    selectFiles([
      new File(["one"], "first.txt", { type: "text/plain" }),
      new File(["two"], "second.txt", { type: "text/plain" }),
    ]);

    fireEvent.click(screen.getByRole("button", { name: "Upload 2 files" }));
    fireEvent.click(screen.getByRole("button", { name: "Cancel upload" }));
    await waitFor(() => expect(queueItem("first.txt")).toHaveTextContent("Upload cancelled."));
    expect(queueItem("second.txt")).toHaveTextContent("Ready");
    expect(uploadFile).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "Retry" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Upload 1 file" })).toBeEnabled();
    expect(screen.queryByRole("button", { name: "Cancel upload" })).not.toBeInTheDocument();
  });

  it("asks the browser to confirm leaving only while files are uploading", async () => {
    const upload = deferredUpload();
    renderUpload({ ...createMockFilesRepository(), uploadFile: () => upload.pending });
    selectFiles([new File(["notes"], "notes.txt", { type: "text/plain" })]);
    fireEvent.click(screen.getByRole("button", { name: "Upload 1 file" }));

    const during = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(during);
    expect(during.defaultPrevented).toBe(true);

    await act(async () => upload.finish(normalFileFixtures[0]!));
    await waitFor(() => expect(queueItem("notes.txt")).toHaveTextContent("Uploaded"));
    const after = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(after);
    expect(after.defaultPrevented).toBe(false);
  });

  it("keeps uploading while the user is on another page", async () => {
    const upload = deferredUpload();
    const { rerender } = renderUpload({ ...createMockFilesRepository(), uploadFile: () => upload.pending });
    selectFiles([new File(["notes"], "notes.txt", { type: "text/plain" })]);
    fireEvent.click(screen.getByRole("button", { name: "Upload 1 file" }));

    rerender("user-1", <p>Another page</p>);
    expect(screen.queryByText("notes.txt")).not.toBeInTheDocument();
    await act(async () => upload.finish(normalFileFixtures[0]!));
    expect(await screen.findByText("1 file uploaded.")).toBeVisible();

    rerender("user-1", <UploadPage />);
    expect(queueItem("notes.txt")).toHaveTextContent("Uploaded");
  });

  it("stops and clears the queue when a different account signs in", async () => {
    const uploadFile = cancellableUpload();
    const { rerender } = renderUpload({ ...createMockFilesRepository(), uploadFile });
    selectFiles([new File(["notes"], "notes.txt", { type: "text/plain" })]);
    fireEvent.click(screen.getByRole("button", { name: "Upload 1 file" }));

    rerender("user-2", <UploadPage />);
    expect(screen.queryByRole("listitem")).not.toBeInTheDocument();
    await waitFor(() => expect(uploadFile.mock.calls[0]?.[2]?.aborted).toBe(true));
    expect(screen.getByRole("button", { name: "Choose files first" })).toBeDisabled();
    expect(screen.queryByText(/uploaded\./)).not.toBeInTheDocument();
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
