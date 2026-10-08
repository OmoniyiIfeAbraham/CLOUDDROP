import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "../components/ui/ToastProvider";
import { AuthContext } from "../features/auth/auth-context";
import { ApiError } from "../features/files/api/api-error";
import { FilesContext } from "../features/files/api/files-context";
import { createMockFilesRepository } from "../features/files/api/files-mock-repository";
import type { FilesRepository } from "../features/files/api/files-repository";
import { normalFileFixtures } from "../features/files/api/files.fixtures";
import type { FileRecord } from "../features/files/model/file.types";
import { formatBytes } from "../lib/format";
import { DashboardPage } from "./DashboardPage";

const renderDashboard = (repository: FilesRepository) => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <AuthContext.Provider value={{
          user: { id: "user-one", firstName: "Ada", lastName: "Lovelace", email: "ada@example.com" },
          status: "authenticated",
          login: async () => {},
          register: async () => {},
          logout: () => {},
          retryRestore: async () => {},
        }}>
          <FilesContext.Provider value={repository}>
            <ToastProvider><DashboardPage /></ToastProvider>
          </FilesContext.Provider>
        </AuthContext.Provider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
};

afterEach(cleanup);

describe("dashboard states", () => {
  it("derives totals and the five newest files from the file list", async () => {
    renderDashboard(createMockFilesRepository());
    expect(await screen.findByRole("link", { name: "application-data.bin" })).toBeVisible();

    const overview = screen.getByRole("region", { name: "Storage overview" });
    expect(within(within(overview).getByText("Total files").parentElement!).getByText("6", { exact: true })).toBeVisible();
    expect(within(within(overview).getByText("Categories used").parentElement!).getByText("6", { exact: true })).toBeVisible();
    expect(within(overview).getByText(formatBytes(normalFileFixtures.reduce((sum, file) => sum + file.size, 0)))).toBeVisible();
    expect(screen.getByRole("link", { name: "product-demo.mp4" })).toBeVisible();
    expect(screen.queryByRole("link", { name: "capstone-proposal.pdf" })).not.toBeInTheDocument();
  });

  it("shows zero totals and an upload action for an empty account", async () => {
    renderDashboard(createMockFilesRepository({ files: [] }));
    expect(await screen.findByText("No files yet")).toBeVisible();
    const overview = screen.getByRole("region", { name: "Storage overview" });
    expect(within(within(overview).getByText("Total files").parentElement!).getByText("0", { exact: true })).toBeVisible();
    expect(within(within(overview).getByText("Categories used").parentElement!).getByText("0", { exact: true })).toBeVisible();
    expect(screen.getByRole("link", { name: "Upload a file" })).toHaveAttribute("href", "/upload");
  });

  it("keeps overview and recent files in a loading state until data arrives", async () => {
    let resolveFiles!: (files: FileRecord[]) => void;
    const pending = new Promise<FileRecord[]>((resolve) => { resolveFiles = resolve; });
    const base = createMockFilesRepository();
    renderDashboard({ ...base, listFiles: () => pending });

    expect(screen.getByRole("status", { name: "Loading files" })).toBeVisible();
    expect(screen.getByText("Total files").closest(".stats-grid")).toHaveAttribute("aria-busy", "true");
    await act(async () => resolveFiles(normalFileFixtures));
    expect(await screen.findByRole("link", { name: "application-data.bin" })).toBeVisible();
    expect(screen.getByText("Total files").closest(".stats-grid")).toHaveAttribute("aria-busy", "false");
  });

  it("offers retry after an overview failure", async () => {
    const base = createMockFilesRepository();
    const listFiles = vi.fn()
      .mockRejectedValueOnce(new ApiError({ message: "Unavailable", code: "FILES_RETRIEVAL_FAILED", status: 503, retryable: true }))
      .mockResolvedValue(normalFileFixtures);
    renderDashboard({ ...base, listFiles });

    expect(await screen.findByRole("heading", { name: "Overview unavailable" })).toBeVisible();
    expect(screen.queryByRole("link", { name: "application-data.bin" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByRole("link", { name: "application-data.bin" })).toBeVisible();
    expect(listFiles).toHaveBeenCalledTimes(2);
  });
});
