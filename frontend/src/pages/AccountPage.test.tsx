import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AuthContext } from "../features/auth/auth-context";
import type { AuthContextValue } from "../features/auth/auth-context";
import { ApiError } from "../features/files/api/api-error";
import { FilesContext } from "../features/files/api/files-context";
import { createMockFilesRepository } from "../features/files/api/files-mock-repository";
import { UploadQueueContext } from "../features/upload/upload-queue-context";
import type { UploadQueueValue } from "../features/upload/upload-queue-context";
import { AccountPage } from "./AccountPage";

const signedIn = (overrides: Partial<AuthContextValue> = {}): AuthContextValue => ({
  user: { id: "user-one", firstName: "Ada", lastName: "Okafor", email: "ada@example.com" },
  status: "authenticated",
  login: async () => {},
  register: async () => ({ user: { id: "user-one", firstName: "Ada", lastName: "Okafor", email: "ada@example.com" } }),
  verifyEmail: async () => {},
  resendVerificationEmail: async () => {},
  logout: () => {},
  retryRestore: async () => {},
  deleteAccount: async () => {},
  notice: null,
  ...overrides,
});

const queue = (uploading = false): UploadQueueValue => ({
  queue: [], uploading, addFiles: () => {}, retry: () => {}, remove: () => {}, clear: () => {}, uploadAll: async () => {}, cancel: () => {},
});

const renderAccount = ({ auth = signedIn(), files = createMockFilesRepository(), uploading = false } = {}) => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={["/account"]}>
        <AuthContext.Provider value={auth}>
          <FilesContext.Provider value={files}>
            <UploadQueueContext.Provider value={queue(uploading)}>
              <Routes>
                <Route path="/account" element={<AccountPage />} />
                <Route path="/login" element={<h1>Sign-in page</h1>} />
              </Routes>
            </UploadQueueContext.Provider>
          </FilesContext.Provider>
        </AuthContext.Provider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
};

const openDeleteDialog = () => {
  fireEvent.click(screen.getByRole("button", { name: "Delete account" }));
  return screen.getByRole("dialog", { name: "Delete your account?" });
};

afterEach(cleanup);

describe("account page", () => {
  it("shows the profile and requires typing DELETE before deleting", async () => {
    const deleteAccount = vi.fn().mockResolvedValue(undefined);
    renderAccount({ auth: signedIn({ deleteAccount }) });
    expect(screen.getByText("Ada Okafor")).toBeVisible();
    expect(screen.getByText("ada@example.com")).toBeVisible();

    const dialog = openDeleteDialog();
    const confirm = screen.getAllByRole("button", { name: "Delete account" }).find((button) => dialog.contains(button))!;
    expect(confirm).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Type DELETE to confirm"), { target: { value: "delete" } });
    expect(confirm).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Type DELETE to confirm"), { target: { value: "DELETE" } });
    expect(confirm).toBeEnabled();

    fireEvent.click(confirm);
    expect(await screen.findByRole("heading", { name: "Sign-in page" })).toBeVisible();
    expect(deleteAccount).toHaveBeenCalledTimes(1);
  });

  it("names the files that will be deleted, or says there are none", async () => {
    const first = renderAccount();
    openDeleteDialog();
    expect(await screen.findByText(/all 6 of your files and any share links/)).toBeVisible();
    first.unmount();

    renderAccount({ files: createMockFilesRepository({ files: [] }) });
    openDeleteDialog();
    expect(await screen.findByText("This permanently deletes your account. You have no stored files.")).toBeVisible();
  });

  it("explains a failed deletion and keeps the user signed in", async () => {
    const deleteAccount = vi.fn().mockRejectedValue(
      new ApiError({ message: "Cleanup failed", code: "S3_CLEANUP_FAILED", status: 502, retryable: true }),
    );
    renderAccount({ auth: signedIn({ deleteAccount }) });
    const dialog = openDeleteDialog();
    fireEvent.change(screen.getByLabelText("Type DELETE to confirm"), { target: { value: "DELETE" } });
    fireEvent.click(screen.getAllByRole("button", { name: "Delete account" }).find((button) => dialog.contains(button))!);

    expect(await screen.findByRole("alert")).toHaveTextContent("Your account was not deleted because some files could not be removed.");
    expect(screen.queryByRole("heading", { name: "Sign-in page" })).not.toBeInTheDocument();
    await waitFor(() => expect(screen.getAllByRole("button", { name: "Delete account" }).find((button) => dialog.contains(button))).toBeEnabled());
  });

  it("blocks deletion while uploads are running", () => {
    renderAccount({ uploading: true });
    expect(screen.getByRole("button", { name: "Delete account" })).toBeDisabled();
    expect(screen.getByText("Wait for your uploads to finish, or cancel them, before deleting your account.")).toBeVisible();
  });
});
