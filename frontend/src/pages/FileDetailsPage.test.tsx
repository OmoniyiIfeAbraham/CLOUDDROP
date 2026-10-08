import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "../components/ui/ToastProvider";
import { FilesContext } from "../features/files/api/files-context";
import { createMockFilesRepository } from "../features/files/api/files-mock-repository";
import type { FilesRepository } from "../features/files/api/files-repository";
import { normalFileFixtures } from "../features/files/api/files.fixtures";
import { ApiError } from "../features/files/api/api-error";
import { FileDetailsPage } from "./FileDetailsPage";
import { FilesPage } from "./FilesPage";

const file = normalFileFixtures[0]!;

const renderDetails = (repository: FilesRepository) => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[`/files/${file.id}`]}>
        <FilesContext.Provider value={repository}>
          <ToastProvider>
            <Routes>
              <Route path="/files/:fileId" element={<FileDetailsPage />} />
              <Route path="/files" element={<FilesPage />} />
            </Routes>
          </ToastProvider>
        </FilesContext.Provider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
};

afterEach(cleanup);

describe("file details", () => {
  it("shows file metadata without exposing the backend storage key", async () => {
    const base = createMockFilesRepository();
    renderDetails({
      ...base,
      getFile: async (id) => ({ ...await base.getFile(id), s3Key: "private/users/secret-object" }),
    });

    expect(await screen.findByRole("heading", { name: file.originalName })).toBeVisible();
    expect(screen.getByRole("region", { name: "File information" })).toHaveTextContent(file.mimeType);
    expect(document.body).not.toHaveTextContent("private/users/secret-object");
    expect(screen.getByRole("button", { name: "Download" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Share" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Delete" })).toBeVisible();
  });

  it("retries a failed details request", async () => {
    const base = createMockFilesRepository();
    const getFile = vi.fn((id: string) => base.getFile(id))
      .mockRejectedValueOnce(new ApiError({ message: "Unavailable", code: "FILE_RETRIEVAL_FAILED", status: 500, retryable: true }));
    renderDetails({ ...base, getFile });

    expect(await screen.findByText("File unavailable")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByRole("heading", { name: file.originalName })).toBeVisible();
    expect(getFile).toHaveBeenCalledTimes(2);
  });

  it("returns to the library after deleting the open file", async () => {
    renderDetails(createMockFilesRepository());
    expect(await screen.findByRole("heading", { name: file.originalName })).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    fireEvent.click(screen.getByRole("button", { name: "Delete file" }));
    await waitFor(() => expect(screen.getByRole("heading", { name: "My files" })).toBeVisible());
    expect(screen.queryByRole("link", { name: file.originalName })).not.toBeInTheDocument();
  });
});
