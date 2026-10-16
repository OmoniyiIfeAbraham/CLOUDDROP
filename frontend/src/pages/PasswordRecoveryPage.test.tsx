import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AuthContext, type AuthContextValue } from "../features/auth/auth-context";
import { passwordRecoveryService } from "../features/auth/password-recovery-service";
import { ApiError } from "../features/files/api/api-error";
import { ForgotPasswordPage, ResetPasswordPage } from "./PasswordRecoveryPage";

const Location = () => { const location = useLocation(); return <output data-testid="location">{location.pathname + location.search}</output>; };
const renderPage = (path = "/forgot-password") => {
  const logout = vi.fn();
  const value = { logout } as unknown as AuthContextValue;
  render(<MemoryRouter initialEntries={[path]}><AuthContext.Provider value={value}>
    <Routes>
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route path="/login" element={<h1>Sign in</h1>} />
    </Routes><Location />
  </AuthContext.Provider></MemoryRouter>);
  return { logout };
};
const fill = (name: string, value: string) => fireEvent.change(screen.getByLabelText(name, { exact: true }), { target: { value } });
const submitPassword = () => fireEvent.click(screen.getByRole("button", { name: "Reset password" }));
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe("forgot password", () => {
  it("validates and focuses email before requesting a reset", async () => {
    const request = vi.spyOn(passwordRecoveryService, "requestReset").mockResolvedValue();
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: "Send reset link" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Enter a valid email address");
    expect(screen.getByLabelText("Email address")).toHaveAccessibleDescription("Enter a valid email address");
    expect(screen.getByLabelText("Email address")).toHaveFocus();
    expect(request).not.toHaveBeenCalled();
  });
  it("shows a generic confirmation for any email and moves focus to it", async () => {
    const request = vi.spyOn(passwordRecoveryService, "requestReset").mockResolvedValue();
    renderPage();
    fill("Email address", "unregistered@example.com");
    fireEvent.click(screen.getByRole("button", { name: "Send reset link" }));
    const heading = await screen.findByRole("heading", { name: "Check your email" });
    expect(heading).toHaveFocus();
    expect(screen.getByText(/If an account exists for that email/)).toBeVisible();
    expect(request).toHaveBeenCalledWith("unregistered@example.com");
    expect(screen.queryByRole("button", { name: "Send reset link" })).not.toBeInTheDocument();
  });
  it("keeps the form usable after a network failure", async () => {
    vi.spyOn(passwordRecoveryService, "requestReset").mockRejectedValue(new ApiError({ message: "Offline", code: "NETWORK_ERROR" }));
    renderPage(); fill("Email address", "ada@example.com");
    fireEvent.click(screen.getByRole("button", { name: "Send reset link" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Could not connect");
    expect(screen.getByRole("button", { name: "Send reset link" })).toBeEnabled();
  });
});

describe("reset password", () => {
  it.each(["", "?token=", "?token=%20", "?token=first&token=second"])("requires a single nonempty token (%s)", (query) => {
    renderPage(`/reset-password${query}`);
    expect(screen.getByRole("heading", { name: "Reset link required" })).toBeVisible();
    expect(screen.queryByLabelText("New password", { exact: true })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Request a new reset link" })).toHaveAttribute("href", "/forgot-password");
  });
  it("validates password length and confirmation before sending a request", async () => {
    const reset = vi.spyOn(passwordRecoveryService, "resetPassword").mockResolvedValue();
    renderPage("/reset-password?token=test-token");
    fill("New password", "short"); fill("Confirm password", "other"); submitPassword();
    expect(await screen.findByText("Use at least 8 characters")).toBeVisible();
    expect(screen.getByLabelText("New password", { exact: true })).toHaveFocus();
    fill("New password", "a-long-password"); submitPassword();
    expect(await screen.findByText("Passwords do not match")).toBeVisible();
    expect(reset).not.toHaveBeenCalled();
  });
  it("reads the query token, clears this session on success and removes the token and password fields", async () => {
    const reset = vi.spyOn(passwordRecoveryService, "resetPassword").mockResolvedValue();
    const { logout } = renderPage("/reset-password?token=test%2Btoken");
    fill("New password", "a-long-password"); fill("Confirm password", "a-long-password"); submitPassword();
    expect(await screen.findByRole("heading", { name: "Password updated" })).toHaveFocus();
    expect(reset).toHaveBeenCalledWith("test+token", "a-long-password");
    expect(logout).toHaveBeenCalledOnce();
    expect(screen.getByTestId("location")).toHaveTextContent(/^\/reset-password$/);
    expect(screen.queryByLabelText("New password", { exact: true })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute("href", "/login");
  });
  it("offers a fresh link for an expired, invalid or already used token", async () => {
    vi.spyOn(passwordRecoveryService, "resetPassword").mockRejectedValue(new ApiError({ message: "Invalid", code: "INVALID_OR_EXPIRED_RESET_TOKEN", status: 400 }));
    renderPage("/reset-password?token=used-token");
    fill("New password", "a-long-password"); fill("Confirm password", "a-long-password"); submitPassword();
    expect(await screen.findByRole("heading", { name: "This reset link is no longer valid" })).toHaveFocus();
    expect(screen.getByRole("link", { name: "Request a new reset link" })).toBeVisible();
    expect(screen.queryByRole("button", { name: "Reset password" })).not.toBeInTheDocument();
  });
  it("blocks repeat submission while pending, and allows retry after a server error", async () => {
    let reject!: (reason: unknown) => void;
    vi.spyOn(passwordRecoveryService, "resetPassword").mockReturnValue(new Promise((_, fail) => { reject = fail; }));
    renderPage("/reset-password?token=test-token");
    fill("New password", "a-long-password"); fill("Confirm password", "a-long-password"); submitPassword();
    await waitFor(() => expect(screen.getByRole("button", { name: "Resetting password..." })).toBeDisabled());
    reject(new ApiError({ message: "Server error", code: "HTTP_ERROR", status: 500 }));
    expect(await screen.findByRole("alert")).toHaveTextContent("We could not reset your password");
    expect(screen.getByRole("button", { name: "Reset password" })).toBeEnabled();
  });
});
