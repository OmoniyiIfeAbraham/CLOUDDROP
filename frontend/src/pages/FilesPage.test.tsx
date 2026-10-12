import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "../components/ui/ToastProvider";
import { ApiError } from "../features/files/api/api-error";
import { FilesContext } from "../features/files/api/files-context";
import { createMockFilesRepository } from "../features/files/api/files-mock-repository";
import type { FilesRepository } from "../features/files/api/files-repository";
import { manyFileFixtures, normalFileFixtures } from "../features/files/api/files.fixtures";
import type { FileListQuery, FilePage, FileRecord } from "../features/files/model/file.types";
import { FilesPage } from "./FilesPage";

const renderFiles = (repository: FilesRepository) => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <FilesContext.Provider value={repository}>
          <ToastProvider><FilesPage /></ToastProvider>
        </FilesContext.Provider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
};

const pageOf = (files: FileRecord[]): FilePage => ({ files, page: 1, limit: 10, total: files.length, totalPages: files.length ? 1 : 0 });

afterEach(cleanup);

describe("file library states", () => {
  it("distinguishes an empty library from a filtered result", async () => {
    const first = renderFiles(createMockFilesRepository({ files: [] }));
    expect(await screen.findByText("Your library is empty")).toBeVisible();
    first.unmount();

    renderFiles(createMockFilesRepository({ files: [normalFileFixtures[0]!] }));
    expect(await screen.findByRole("link", { name: "capstone-proposal.pdf" })).toBeVisible();
    fireEvent.change(screen.getByLabelText("Category"), { target: { value: "Images" } });
    expect(await screen.findByText("No matching files")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));
    expect(await screen.findByRole("link", { name: "capstone-proposal.pdf" })).toBeVisible();
  });

  it("asks the backend for the selected category", async () => {
    const base = createMockFilesRepository();
    const listFiles = vi.fn((query?: FileListQuery) => base.listFiles(query));
    renderFiles({ ...base, listFiles });
    expect(await screen.findByRole("link", { name: "capstone-proposal.pdf" })).toBeVisible();

    fireEvent.change(screen.getByLabelText("Category"), { target: { value: "Images" } });
    expect(await screen.findByRole("link", { name: "architecture-diagram.png" })).toBeVisible();
    expect(screen.queryByRole("link", { name: "capstone-proposal.pdf" })).not.toBeInTheDocument();
    expect(listFiles).toHaveBeenLastCalledWith({ search: "", category: "Images", page: 1, limit: 10 });
    expect(screen.getByText("1 file")).toBeVisible();
  });

  it("offers retry after a retrieval failure", async () => {
    const base = createMockFilesRepository({ files: [] });
    const listFiles = vi.fn()
      .mockRejectedValueOnce(new ApiError({ message: "Unavailable", code: "FILES_RETRIEVAL_FAILED", status: 503, retryable: true }))
      .mockResolvedValue(pageOf([]));
    renderFiles({ ...base, listFiles });
    expect(await screen.findByText("Files unavailable")).toBeVisible();
    expect(screen.getByText("File count unavailable")).toBeVisible();
    expect(screen.queryByText("0 files")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByText("Your library is empty")).toBeVisible();
    expect(listFiles).toHaveBeenCalledTimes(2);
  });

  it("shows loading rows before the initial file list arrives", async () => {
    let resolveFiles!: (page: FilePage) => void;
    const pending = new Promise<FilePage>((resolve) => { resolveFiles = resolve; });
    const base = createMockFilesRepository();
    renderFiles({ ...base, listFiles: () => pending });

    expect(screen.getByRole("status", { name: "Loading files" })).toBeVisible();
    await act(async () => resolveFiles(pageOf([])));
    expect(await screen.findByText("Your library is empty")).toBeVisible();
  });

  it("pages through the backend's pages", async () => {
    renderFiles(createMockFilesRepository({ files: manyFileFixtures }));
    expect(await screen.findByRole("link", { name: "report-1.pdf" })).toBeVisible();
    expect(screen.getByText("30 files")).toBeVisible();
    expect(screen.getByText("Page 1 of 3")).toBeVisible();
    expect(screen.queryByRole("link", { name: "report-11.pdf" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Next page" }));
    expect(await screen.findByRole("link", { name: "report-11.pdf" })).toBeVisible();
    expect(screen.getByText("Page 2 of 3")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Next page" }));
    expect(await screen.findByRole("link", { name: "report-30.pdf" })).toBeVisible();
    expect(screen.getByText("Page 3 of 3")).toBeVisible();
    expect(screen.getByRole("button", { name: "Next page" })).toBeDisabled();
  });

  it("steps back a page when the only file on the last page is deleted", async () => {
    renderFiles(createMockFilesRepository({ files: manyFileFixtures.slice(0, 11) }));
    expect(await screen.findByText("Page 1 of 2")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Next page" }));
    expect(await screen.findByRole("link", { name: "report-11.pdf" })).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "Delete report-11.pdf" }));
    fireEvent.click(screen.getByRole("button", { name: "Delete file" }));
    expect(await screen.findByRole("link", { name: "report-1.pdf" })).toBeVisible();
    expect(screen.getByText("10 files")).toBeVisible();
    expect(screen.queryByText(/Page \d of/)).not.toBeInTheDocument();
  });

  it("keeps the current rows visible and disables paging while the next page loads", async () => {
    const base = createMockFilesRepository({ files: manyFileFixtures });
    let finishPage!: (page: FilePage) => void;
    const pending = new Promise<FilePage>((resolve) => { finishPage = resolve; });
    const listFiles = vi.fn((query?: FileListQuery) => query?.page === 2 ? pending : base.listFiles(query));
    renderFiles({ ...base, listFiles });
    expect(await screen.findByRole("link", { name: "report-1.pdf" })).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Next page" }));
    expect(screen.getByText("Loading page 2...")).toBeVisible();
    expect(screen.getByRole("button", { name: "Previous page" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Next page" })).toBeDisabled();
    expect(screen.getByRole("link", { name: "report-1.pdf" })).toBeVisible();
    await act(async () => finishPage(await base.listFiles({ page: 2, limit: 10 })));
    expect(await screen.findByRole("link", { name: "report-11.pdf" })).toBeVisible();
    expect(screen.getByText("Page 2 of 3")).toBeVisible();
    expect(screen.getByRole("button", { name: "Next page" })).toBeEnabled();
  });

  it("never shows results from an earlier rapid search", async () => {
    let resolveFirstSearch!: (page: FilePage) => void;
    const firstSearch = new Promise<FilePage>((resolve) => { resolveFirstSearch = resolve; });
    const base = createMockFilesRepository();
    const listFiles = vi.fn((query?: FileListQuery) => query?.search === "proposal"
      ? firstSearch
      : base.listFiles(query));
    renderFiles({ ...base, listFiles });
    expect(await screen.findByRole("link", { name: "product-demo.mp4" })).toBeVisible();

    fireEvent.change(screen.getByRole("searchbox", { name: "Search files" }), { target: { value: "proposal" } });
    expect(screen.getByText("Searching...")).toBeVisible();
    expect(screen.queryByRole("link", { name: "product-demo.mp4" })).not.toBeInTheDocument();
    await waitFor(() => expect(listFiles).toHaveBeenCalledWith(expect.objectContaining({ search: "proposal" })));

    fireEvent.change(screen.getByRole("searchbox", { name: "Search files" }), { target: { value: "architecture" } });
    expect(screen.getByText("Searching...")).toBeVisible();
    expect(await screen.findByRole("link", { name: "architecture-diagram.png" })).toBeVisible();
    await act(async () => resolveFirstSearch(pageOf([normalFileFixtures[0]!])));
    expect(screen.queryByRole("link", { name: "capstone-proposal.pdf" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "architecture-diagram.png" })).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "Clear search" }));
    expect(await screen.findByRole("link", { name: "product-demo.mp4" })).toBeVisible();
    expect(screen.getByRole("searchbox", { name: "Search files" })).toHaveValue("");
  });
});
