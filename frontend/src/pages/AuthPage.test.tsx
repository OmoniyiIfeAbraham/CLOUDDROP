import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AuthContext } from "../features/auth/auth-context";
import type { AuthContextValue } from "../features/auth/auth-context";
import { ApiError } from "../features/files/api/api-error";
import { AuthPage } from "./AuthPage";

const renderAuthPage = (
  mode: "login" | "register",
  overrides: Partial<AuthContextValue> = {},
) => {
  const value: AuthContextValue = {
    user: null,
    status: "anonymous",
    login: async () => {},
    verifyEmail: async () => {},
    resendVerificationEmail: async () => {},
    register: async () => ({
      user: {
        id: "test-user",
        firstName: "Test",
        lastName: "User",
        email: "ada@example.com",
      },
    }),
    logout: () => {},
    retryRestore: async () => {},
    deleteAccount: async () => {},
    notice: null,
    ...overrides,
  };

  render(
    <MemoryRouter initialEntries={[`/${mode}`]}>
      <AuthContext.Provider value={value}>
        <Routes>
          <Route path="/login" element={<AuthPage key="login" mode="login" />} />
          <Route path="/register" element={<AuthPage key="register" mode="register" />} />
          <Route path="/" element={<h1>Workspace</h1>} />
        </Routes>
      </AuthContext.Provider>
    </MemoryRouter>,
  );
};

const fill = (label: string, value: string, exact = false) => {
  fireEvent.change(screen.getByLabelText(label, { exact }), {
    target: { value },
  });
};

const completeRegistration = async (expectVerification = true) => {
  fill("First name", "Ada");
  fill("Last name", "Lovelace");
  fill("Email address", "ada@example.com");
  fill("Password", "securepass123", true);
  fireEvent.click(screen.getByRole("button", { name: "Create account" }));
  if (expectVerification) {
    await screen.findByRole("heading", { name: "Verify your email" });
  }
};

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  sessionStorage.clear();
});

describe("signed-out notices", () => {
  it("confirms a deleted account on the sign-in page", () => {
    renderAuthPage("login", { notice: "Your account and all of its files have been deleted." });
    expect(screen.getByRole("status")).toHaveTextContent("Your account and all of its files have been deleted.");
  });
});

describe("sign-in and registration errors", () => {
  it("associates validation errors with their fields and focuses the first invalid registration field", async () => {
    const register = vi.fn();
    renderAuthPage("register", { register });

    fill("Email address", "ada@example.com");
    fill("Password", "securepass123", true);
    fireEvent.click(screen.getByRole("button", { name: "Create account" }));

    expect(await screen.findByText("Enter your first name")).toBeVisible();
    expect(screen.getByLabelText("First name")).toHaveAccessibleDescription("Enter your first name");
    expect(screen.getByLabelText("Last name")).toHaveAccessibleDescription("Enter your last name");
    expect(screen.getByLabelText("First name")).toHaveFocus();
    expect(register).not.toHaveBeenCalled();
  });

  it("gives email and password fields their validation descriptions", async () => {
    renderAuthPage("login", {});
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

    expect(await screen.findByText("Enter a valid email address")).toBeVisible();
    expect(screen.getByLabelText("Email address")).toHaveAccessibleDescription("Enter a valid email address");
    expect(screen.getByLabelText("Password", { exact: true })).toHaveAccessibleDescription("Use at least 8 characters");
  });

  it("tells the user the email or password is wrong, not that a session ended", async () => {
    const login = vi.fn(async () => {
      throw new ApiError({
        message: "Invalid email or password",
        code: "INVALID_CREDENTIALS",
        status: 401,
      });
    });

    renderAuthPage("login", { login });
    fill("Email address", "ada@example.com");
    fill("Password", "wrongpass123", true);
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Incorrect email or password.");
    expect(screen.queryByText(/session has ended/)).not.toBeInTheDocument();
  });

  it("explains that an email is already registered", async () => {
    const register = vi.fn(async () => {
      throw new ApiError({
        message: "Email already registered",
        code: "EMAIL_ALREADY_REGISTERED",
        status: 409,
      });
    });

    renderAuthPage("register", { register });
    await completeRegistration(false);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "An account with this email already exists. Sign in instead.",
    );
  });
});

describe("email verification", () => {
  it("recovers when the account was created but its verification email could not be sent", async () => {
    const register = vi.fn().mockRejectedValue(new ApiError({
      message: "Account created but email delivery failed",
      code: "VERIFICATION_EMAIL_FAILED",
      status: 503,
    }));
    renderAuthPage("register", { register });
    await completeRegistration(false);

    expect(await screen.findByRole("heading", { name: "Verify your email" })).toBeVisible();
    expect(screen.getByRole("status")).toHaveTextContent("Your account was created");
    expect(screen.getByRole("button", { name: "Resend verification code" })).toBeEnabled();
    expect(screen.queryByText("We could not create your account. Please try again.")).not.toBeInTheDocument();
  });

  it("opens verification when the backend rejects an unverified sign-in", async () => {
    const login = vi.fn().mockRejectedValue(new ApiError({
      message: "Please verify your email before logging in.",
      code: "EMAIL_NOT_VERIFIED",
      status: 403,
    }));
    renderAuthPage("login", { login });
    fill("Email address", "ada@example.com");
    fill("Password", "securepass123", true);
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

    expect(await screen.findByRole("heading", { name: "Verify your email" })).toBeVisible();
    expect(screen.getByText(/ada@example\.com/)).toBeVisible();
    expect(screen.getByRole("button", { name: "Back to sign in" })).toBeVisible();
    expect(screen.queryByText("Sign in failed. Check your details and try again.")).not.toBeInTheDocument();
  });

  it("opens the verification step after successful registration", async () => {
    const register = vi.fn(async () => ({
      user: {
        id: "ada-user",
        firstName: "Ada",
        lastName: "Lovelace",
        email: "ada@example.com",
      },
    }));

    renderAuthPage("register", { register });
    await completeRegistration();

    expect(await screen.findByRole("heading", { name: "Verify your email" })).toBeVisible();
    expect(screen.getByText(/ada@example\.com/)).toBeVisible();
    expect(screen.getByLabelText("Verification code")).toBeVisible();
    expect(screen.getByRole("button", { name: "Verify email" })).toBeVisible();
    expect(register).toHaveBeenCalledWith({
      firstName: "Ada",
      lastName: "Lovelace",
      email: "ada@example.com",
      password: "securepass123",
    });
  });

  it("verifies the email with the entered six-digit code", async () => {
    const verifyEmail = vi.fn(async () => {});
    renderAuthPage("register", { verifyEmail });

    await completeRegistration();

    fill("Verification code", "123456");
    fireEvent.click(screen.getByRole("button", { name: "Verify email" }));

    await waitFor(() => {
      expect(verifyEmail).toHaveBeenCalledWith("ada@example.com", "123456");
    });
  });

  it("shows an error when verification fails", async () => {
    const verifyEmail = vi.fn(async () => {
      throw new ApiError({
        message: "Invalid verification code",
        code: "INVALID_VERIFICATION_CODE",
        status: 400,
      });
    });

    renderAuthPage("register", { verifyEmail });
    await completeRegistration();

    fill("Verification code", "000000");
    fireEvent.click(screen.getByRole("button", { name: "Verify email" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "That code is incorrect or has expired. Check it or request a new code.",
    );
  });

  it("resends the verification email for the pending address", async () => {
    const resendVerificationEmail = vi.fn(async () => {});
    renderAuthPage("register", { resendVerificationEmail });

    await completeRegistration();

    fireEvent.click(screen.getByRole("button", { name: "Resend verification code" }));

    await waitFor(() => {
      expect(resendVerificationEmail).toHaveBeenCalledWith("ada@example.com");
    });

    expect(await screen.findByText(/new verification email will be sent/i)).toBeVisible();
    expect(screen.getByRole("status")).toHaveTextContent(/new verification email will be sent/i);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("lets an existing registration finish verification without registering again", async () => {
    const register = vi.fn().mockRejectedValue(new ApiError({ message: "Duplicate", code: "EMAIL_ALREADY_REGISTERED", status: 409 }));
    const resendVerificationEmail = vi.fn().mockResolvedValue(undefined);
    const verifyEmail = vi.fn().mockResolvedValue(undefined);
    renderAuthPage("register", { register, resendVerificationEmail, verifyEmail });
    await completeRegistration(false);
    fireEvent.click(await screen.findByRole("button", { name: "Finish email verification" }));
    expect(await screen.findByRole("heading", { name: "Verify your email" })).toHaveFocus();
    expect(resendVerificationEmail).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Resend verification code" }));
    await waitFor(() => expect(resendVerificationEmail).toHaveBeenCalledWith("ada@example.com"));
    fill("Verification code", "654321");
    fireEvent.click(screen.getByRole("button", { name: "Verify email" }));
    await waitFor(() => expect(verifyEmail).toHaveBeenCalledWith("ada@example.com", "654321"));
    expect(register).toHaveBeenCalledOnce();
  });

  it("prefills sign-in with the existing account email", async () => {
    const register = vi.fn().mockRejectedValue(new ApiError({ message: "Duplicate", code: "EMAIL_ALREADY_REGISTERED", status: 409 }));
    renderAuthPage("register", { register });
    await completeRegistration(false);
    fireEvent.click(await screen.findByRole("link", { name: "Sign in instead" }));
    expect(await screen.findByRole("heading", { name: /^Welcome back\b/ })).toBeVisible();
    expect(screen.getByLabelText("Email address")).toHaveValue("ada@example.com");
    expect(screen.getByLabelText("Password", { exact: true })).toHaveValue("");
  });

  it("offers recovery after an ambiguous registration response without claiming the account was created", async () => {
    const register = vi.fn().mockRejectedValue(new ApiError({ message: "Unavailable", code: "HTTP_ERROR", status: 502 }));
    renderAuthPage("register", { register });
    await completeRegistration(false);
    expect(await screen.findByRole("alert")).toHaveTextContent("We could not confirm account creation");
    expect(screen.queryByText(/Your account was created/)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Finish email verification" })).toBeEnabled();
  });

  it("keeps failed delivery visible and does not mark an untouched verification code invalid", async () => {
    const register = vi.fn().mockRejectedValue(new ApiError({ message: "Delivery failed", code: "VERIFICATION_EMAIL_FAILED", status: 503 }));
    const resendVerificationEmail = vi.fn()
      .mockRejectedValueOnce(new ApiError({ message: "Delivery failed", code: "VERIFICATION_EMAIL_FAILED", status: 503 }))
      .mockResolvedValueOnce(undefined);
    renderAuthPage("register", { register, resendVerificationEmail });
    await completeRegistration(false);
    expect(await screen.findByRole("alert")).toHaveTextContent("We could not send the verification email");
    expect(screen.getByLabelText("Verification code")).toHaveAttribute("aria-invalid", "false");
    fireEvent.click(screen.getByRole("button", { name: "Resend verification code" }));
    await waitFor(() => expect(resendVerificationEmail).toHaveBeenCalledOnce());
    expect(await screen.findByRole("alert")).toHaveTextContent("We could not send the verification email");
    fireEvent.click(screen.getByRole("button", { name: "Resend verification code" }));
    await waitFor(() => expect(screen.queryByRole("alert")).not.toBeInTheDocument());
    expect(screen.getByRole("status")).toHaveTextContent("If the account is eligible");
    expect(resendVerificationEmail).toHaveBeenCalledTimes(2);
  });

  it("clears the entered password when unverified sign-in moves into verification", async () => {
    const login = vi.fn().mockRejectedValue(new ApiError({ message: "Verify email", code: "EMAIL_NOT_VERIFIED", status: 403 }));
    renderAuthPage("login", { login });
    fill("Email address", "ADA@example.com"); fill("Password", "securepass123", true);
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
    expect(await screen.findByRole("heading", { name: "Verify your email" })).toBeVisible();
    expect(screen.getByText(/ada@example\.com/)).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Back to sign in" }));
    expect(screen.getByLabelText("Password", { exact: true })).toHaveValue("");
  });

  it("directs an already-verified account back to sign-in without accepting a session", async () => {
    const login = vi.fn().mockRejectedValue(new ApiError({ message: "Verify email", code: "EMAIL_NOT_VERIFIED", status: 403 }));
    const verifyEmail = vi.fn().mockRejectedValue(new ApiError({ message: "Already verified", code: "EMAIL_ALREADY_VERIFIED", status: 409 }));
    renderAuthPage("login", { login, verifyEmail });
    fill("Email address", "ada@example.com"); fill("Password", "securepass123", true);
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
    await screen.findByRole("heading", { name: "Verify your email" });
    fill("Verification code", "123456");
    fireEvent.click(screen.getByRole("button", { name: "Verify email" }));
    await waitFor(() => expect(screen.getByRole("heading", { name: "Email already verified" })).toHaveFocus());
    expect(sessionStorage.getItem("clouddrop.access-token") === null).toBe(true);
    fireEvent.click(screen.getByRole("link", { name: "Sign in" }));
    expect(await screen.findByRole("heading", { name: /^Welcome back\b/ })).toBeVisible();
  });

  it.each(["INVALID_VERIFICATION_CODE", "VERIFICATION_ATTEMPTS_EXCEEDED"])("gives actionable code feedback for %s", async (code) => {
    const verifyEmail = vi.fn().mockRejectedValue(new ApiError({ message: "Code rejected", code, status: 400 }));
    renderAuthPage("register", { verifyEmail });
    await completeRegistration();
    fill("Verification code", "000000");
    fireEvent.click(screen.getByRole("button", { name: "Verify email" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/request a new (verification )?code/i);
    expect(screen.getByLabelText("Verification code")).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByLabelText("Verification code")).toHaveFocus();
  });
});
