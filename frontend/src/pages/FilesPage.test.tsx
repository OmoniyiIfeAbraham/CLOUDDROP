import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { ToastProvider } from "../components/ui/ToastProvider";
import { ApiError } from "../features/files/api/api-error";
import { FilesContext } from "../features/files/api/files-context";
import { createMockFilesRepository } from "../features/files/api/files-mock-repository";
import type { FilesRepository } from "../features/files/api/files-repository";
import { normalFileFixtures } from "../features/files/api/files.fixtures";
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

  it("offers retry after a retrieval failure", async () => {
    const base = createMockFilesRepository({ files: [] });
    const listFiles = vi.fn()
      .mockRejectedValueOnce(new ApiError({ message: "Unavailable", code: "FILES_RETRIEVAL_FAILED", status: 503, retryable: true }))
      .mockResolvedValue([]);
    renderFiles({ ...base, listFiles });
    expect(await screen.findByText("Files unavailable")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByText("Your library is empty")).toBeVisible();
    expect(listFiles).toHaveBeenCalledTimes(2);
  });
});
