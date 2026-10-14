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
import { dashboardStatsFixture, normalFileFixtures } from "../features/files/api/files.fixtures";
import type { DashboardStats, FilePage } from "../features/files/model/file.types";
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
  it("shows server totals and the five newest files", async () => {
    const base = createMockFilesRepository();
    const listFiles = vi.fn(base.listFiles);
    renderDashboard({ ...base, listFiles });
    expect(await screen.findByRole("link", { name: "application-data.bin" })).toBeVisible();

    const overview = screen.getByRole("region", { name: "Storage overview" });
    expect(within(within(overview).getByText("Total files").parentElement!).getByText("6", { exact: true })).toBeVisible();
    expect(within(within(overview).getByText("Categories used").parentElement!).getByText("6", { exact: true })).toBeVisible();
    expect(within(overview).getByText(formatBytes(normalFileFixtures.reduce((sum, file) => sum + file.size, 0)))).toBeVisible();
    expect(screen.getByRole("link", { name: "product-demo.mp4" })).toBeVisible();
    expect(screen.queryByRole("link", { name: "capstone-proposal.pdf" })).not.toBeInTheDocument();
    expect(listFiles).toHaveBeenCalledWith({ page: 1, limit: 5 });
  });

  it("uses the totals from the stats endpoint, not the recent files", async () => {
    const base = createMockFilesRepository();
    renderDashboard({ ...base, getDashboardStats: async () => ({ ...dashboardStatsFixture, totalFiles: 42 }) });
    expect(await screen.findByRole("link", { name: "application-data.bin" })).toBeVisible();
    const overview = screen.getByRole("region", { name: "Storage overview" });
    expect(within(within(overview).getByText("Total files").parentElement!).getByText("42", { exact: true })).toBeVisible();
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
    let resolveFiles!: (page: FilePage) => void;
    let resolveStats!: (stats: DashboardStats) => void;
    const pendingFiles = new Promise<FilePage>((resolve) => { resolveFiles = resolve; });
    const pendingStats = new Promise<DashboardStats>((resolve) => { resolveStats = resolve; });
    const base = createMockFilesRepository();
    renderDashboard({ ...base, listFiles: () => pendingFiles, getDashboardStats: () => pendingStats });

    expect(screen.getByRole("status", { name: "Loading files" })).toBeVisible();
    expect(screen.getByText("Total files").closest(".stats-grid")).toHaveAttribute("aria-busy", "true");
    await act(async () => {
      resolveStats(dashboardStatsFixture);
      resolveFiles(await base.listFiles({ page: 1, limit: 5 }));
    });
    expect(await screen.findByRole("link", { name: "application-data.bin" })).toBeVisible();
    expect(screen.getByText("Total files").closest(".stats-grid")).toHaveAttribute("aria-busy", "false");
  });

  it("keeps recent files visible and offers retry when the totals fail", async () => {
    const base = createMockFilesRepository();
    const getDashboardStats = vi.fn()
      .mockRejectedValueOnce(new ApiError({ message: "Unavailable", code: "FILES_RETRIEVAL_FAILED", status: 503, retryable: true }))
      .mockResolvedValue(dashboardStatsFixture);
    renderDashboard({ ...base, getDashboardStats });

    expect(await screen.findByRole("heading", { name: "Overview unavailable" })).toBeVisible();
    expect(await screen.findByRole("link", { name: "application-data.bin" })).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    const overview = await screen.findByRole("region", { name: "Storage overview" });
    expect(await within(overview).findByText("Total files")).toBeVisible();
    expect(getDashboardStats).toHaveBeenCalledTimes(2);
  });

  it("offers retry when recent files fail", async () => {
    const base = createMockFilesRepository();
    const listFiles = vi.fn(base.listFiles)
      .mockRejectedValueOnce(new ApiError({ message: "Unavailable", code: "FILES_RETRIEVAL_FAILED", status: 503, retryable: true }));
    renderDashboard({ ...base, listFiles });

    expect(await screen.findByRole("heading", { name: "Recent files unavailable" })).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByRole("link", { name: "application-data.bin" })).toBeVisible();
  });
});
