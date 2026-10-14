import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
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
    ...overrides,
  };

  render(
    <MemoryRouter>
      <AuthContext.Provider value={value}>
        <AuthPage mode={mode} />
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
      "Email verification failed. Check the code and try again.",
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
  });
});
