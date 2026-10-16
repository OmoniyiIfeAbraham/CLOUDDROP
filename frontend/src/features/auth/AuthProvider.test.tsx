import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SESSION_EXPIRED_EVENT } from "../../lib/api";
import { sessionToken } from "../../lib/runtime";
import { ApiError } from "../files/api/api-error";
import { AuthProvider } from "./AuthProvider";
import { useAuth } from "./auth-context";
import { httpAuthService } from "./auth-service";

const user = { id: "user-one", firstName: "Ada", lastName: "Okafor", email: "ada@example.com" };

const AuthProbe = () => {
  const { status, user: currentUser, login, logout, retryRestore, deleteAccount, notice } = useAuth();
  return (
    <>
      <output data-testid="auth-status">{status}</output>
      <output data-testid="auth-notice">{notice}</output>
      <span>{currentUser?.email}</span>
      <button type="button" onClick={() => void deleteAccount().catch(() => {})}>Delete account</button>
      <button type="button" onClick={logout}>Sign out</button>
      <button type="button" onClick={() => void retryRestore()}>Retry restore</button>
      <button type="button" onClick={() => void login({ email: "next@example.com", password: "securepass123" })}>Switch account</button>
    </>
  );
};

const renderAuth = () => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  queryClient.setQueryData(["files", "all"], [{ id: "previous-user-file" }]);
  render(<QueryClientProvider client={queryClient}><AuthProvider><AuthProbe /></AuthProvider></QueryClientProvider>);
  return queryClient;
};

afterEach(() => {
  cleanup();
  sessionStorage.clear();
  vi.restoreAllMocks();
});

describe("AuthProvider session boundaries", () => {
  it("clears cached files on explicit logout", async () => {
    sessionToken.set("stored-token");
    vi.spyOn(httpAuthService, "me").mockResolvedValue(user);
    const queryClient = renderAuth();
    await waitFor(() => expect(screen.getByTestId("auth-status")).toHaveTextContent("authenticated"));

    fireEvent.click(screen.getByRole("button", { name: "Sign out" }));
    expect(screen.getByTestId("auth-status")).toHaveTextContent("anonymous");
    expect(sessionToken.get()).toBeNull();
    expect(queryClient.getQueryData(["files", "all"])).toBeUndefined();
  });

  it("clears cached files when the API expires a session", async () => {
    sessionToken.set("stored-token");
    vi.spyOn(httpAuthService, "me").mockResolvedValue(user);
    const queryClient = renderAuth();
    await waitFor(() => expect(screen.getByTestId("auth-status")).toHaveTextContent("authenticated"));

    act(() => window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT)));
    expect(screen.getByTestId("auth-status")).toHaveTextContent("anonymous");
    expect(sessionToken.get()).toBeNull();
    expect(queryClient.getQueryData(["files", "all"])).toBeUndefined();
  });

  it("clears cached files before accepting a different account", async () => {
    sessionToken.set("stored-token");
    vi.spyOn(httpAuthService, "me").mockResolvedValue(user);
    vi.spyOn(httpAuthService, "login").mockResolvedValue({ user: { ...user, id: "user-two", email: "next@example.com" }, token: "next-token" });
    const queryClient = renderAuth();
    await waitFor(() => expect(screen.getByTestId("auth-status")).toHaveTextContent("authenticated"));

    fireEvent.click(screen.getByRole("button", { name: "Switch account" }));
    await waitFor(() => expect(screen.getByText("next@example.com")).toBeVisible());
    expect(sessionToken.get()).toBe("next-token");
    expect(queryClient.getQueryData(["files", "all"])).toBeUndefined();
  });

  it("keeps a token on a transient restore failure and retries", async () => {
    sessionToken.set("stored-token");
    vi.spyOn(httpAuthService, "me")
      .mockRejectedValueOnce(new ApiError({ message: "Offline", code: "NETWORK_ERROR", retryable: true }))
      .mockResolvedValueOnce(user);
    renderAuth();
    await waitFor(() => expect(screen.getByTestId("auth-status")).toHaveTextContent("restore-error"));
    expect(sessionToken.get()).toBe("stored-token");

    fireEvent.click(screen.getByRole("button", { name: "Retry restore" }));
    await waitFor(() => expect(screen.getByTestId("auth-status")).toHaveTextContent("authenticated"));
  });

  it("drops an invalid token and clears cached files during restore", async () => {
    sessionToken.set("expired-token");
    vi.spyOn(httpAuthService, "me").mockRejectedValue(new ApiError({ message: "Expired", code: "UNAUTHORIZED", status: 401 }));
    const queryClient = renderAuth();
    await waitFor(() => expect(screen.getByTestId("auth-status")).toHaveTextContent("anonymous"));
    expect(sessionToken.get()).toBeNull();
    expect(queryClient.getQueryData(["files", "all"])).toBeUndefined();
  });

  it("signs out when the account no longer exists", async () => {
    sessionToken.set("orphaned-token");
    vi.spyOn(httpAuthService, "me").mockRejectedValue(new ApiError({ message: "User not found", code: "USER_NOT_FOUND", status: 404 }));
    renderAuth();
    await waitFor(() => expect(screen.getByTestId("auth-status")).toHaveTextContent("anonymous"));
    expect(sessionToken.get()).toBeNull();
  });
});

describe("AuthProvider account deletion", () => {
  it("signs out, clears the token and cache, and leaves a notice after the backend confirms", async () => {
    sessionToken.set("stored-token");
    vi.spyOn(httpAuthService, "me").mockResolvedValue(user);
    const remove = vi.spyOn(httpAuthService, "deleteAccount").mockResolvedValue();
    const queryClient = renderAuth();
    await waitFor(() => expect(screen.getByTestId("auth-status")).toHaveTextContent("authenticated"));

    fireEvent.click(screen.getByRole("button", { name: "Delete account" }));
    await waitFor(() => expect(screen.getByTestId("auth-status")).toHaveTextContent("anonymous"));
    expect(remove).toHaveBeenCalledTimes(1);
    expect(sessionToken.get()).toBeNull();
    expect(queryClient.getQueryData(["files", "all"])).toBeUndefined();
    expect(screen.getByTestId("auth-notice")).toHaveTextContent("Your account and all of its files have been deleted.");
  });

  it("keeps the session when the backend refuses the deletion", async () => {
    sessionToken.set("stored-token");
    vi.spyOn(httpAuthService, "me").mockResolvedValue(user);
    vi.spyOn(httpAuthService, "deleteAccount").mockRejectedValue(
      new ApiError({ message: "Cleanup failed", code: "S3_CLEANUP_FAILED", status: 502, retryable: true }),
    );
    renderAuth();
    await waitFor(() => expect(screen.getByTestId("auth-status")).toHaveTextContent("authenticated"));

    fireEvent.click(screen.getByRole("button", { name: "Delete account" }));
    await waitFor(() => expect(httpAuthService.deleteAccount).toHaveBeenCalled());
    expect(screen.getByTestId("auth-status")).toHaveTextContent("authenticated");
    expect(sessionToken.get()).toBe("stored-token");
    expect(screen.getByTestId("auth-notice")).toBeEmptyDOMElement();
  });
});
