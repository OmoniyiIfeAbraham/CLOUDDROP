import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AuthContext } from "../features/auth/auth-context";
import type { AuthContextValue } from "../features/auth/auth-context";
import { ApiError } from "../features/files/api/api-error";
import { AuthPage } from "./AuthPage";

const renderAuthPage = (mode: "login" | "register", overrides: Partial<AuthContextValue>) => {
  const value: AuthContextValue = {
    user: null,
    status: "anonymous",
    login: async () => {},
    register: async () => {},
    logout: () => {},
    retryRestore: async () => {},
    ...overrides,
  };
  render(<MemoryRouter><AuthContext.Provider value={value}><AuthPage mode={mode} /></AuthContext.Provider></MemoryRouter>);
};

const fill = (label: string, value: string, exact = false) => {
  fireEvent.change(screen.getByLabelText(label, { exact }), { target: { value } });
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
    const login = vi.fn(async () => { throw new ApiError({ message: "Invalid email or password", code: "INVALID_CREDENTIALS", status: 401 }); });
    renderAuthPage("login", { login });
    fill("Email address", "ada@example.com");
    fill("Password", "wrongpass123", true);
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Incorrect email or password.");
    expect(screen.queryByText(/session has ended/)).not.toBeInTheDocument();
  });

  it("explains that an email is already registered", async () => {
    const register = vi.fn(async () => { throw new ApiError({ message: "Email already registered", code: "EMAIL_ALREADY_REGISTERED", status: 409 }); });
    renderAuthPage("register", { register });
    fill("First name", "Ada");
    fill("Last name", "Lovelace");
    fill("Email address", "ada@example.com");
    fill("Password", "securepass123", true);
    fireEvent.click(screen.getByRole("button", { name: "Create account" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("An account with this email already exists. Sign in instead.");
  });
});
