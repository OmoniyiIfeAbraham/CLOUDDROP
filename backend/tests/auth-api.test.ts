import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import app from "../src/server.js";
import { ApiError } from "../src/utils/api-error.js";
import {
  registerUser,
  loginUser,
  getCurrentUser,
  verifyEmail,
  resendVerificationEmail,
} from "../src/services/auth.service.js";
import { generateToken } from "../src/utils/auth.utils.js";

vi.mock("../src/services/auth.service.js", () => ({
  registerUser: vi.fn(),
  loginUser: vi.fn(),
  getCurrentUser: vi.fn(),
  verifyEmail: vi.fn(),
  resendVerificationEmail: vi.fn(),
}));

const mockedRegisterUser = vi.mocked(registerUser);
const mockedLoginUser = vi.mocked(loginUser);
const mockedGetCurrentUser = vi.mocked(getCurrentUser);
const mockedVerifyEmail = vi.mocked(verifyEmail);
const mockedResendVerificationEmail = vi.mocked(resendVerificationEmail);

describe("Authentication API error handling", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("returns 401 for invalid login credentials", async () => {
    mockedLoginUser.mockRejectedValue(
      new ApiError(401, "Invalid email or password", "INVALID_CREDENTIALS"),
    );

    const response = await request(app)
      .post("/api/v1/auth/login")
      .send({
        email: "student@example.com",
        password: "wrong-password",
      });

    expect(response.status).toBe(401);
    expect(response.body.success).toBe(false);
    expect(response.body.message).toBe("Invalid email or password");
    expect(response.body.error.code).toBe("INVALID_CREDENTIALS");
  });

  it("returns 409 when an email is already registered", async () => {
    mockedRegisterUser.mockRejectedValue(
      new ApiError(409, "Email already registered", "EMAIL_ALREADY_REGISTERED"),
    );

    const response = await request(app)
      .post("/api/v1/auth/register")
      .send({
        firstName: "Test",
        lastName: "User",
        email: "student@example.com",
        password: "test-password",
      });

    expect(response.status).toBe(409);
    expect(response.body.success).toBe(false);
    expect(response.body.message).toBe("Email already registered");
    expect(response.body.error.code).toBe("EMAIL_ALREADY_REGISTERED");
  });

  it("returns 404 when the authenticated user cannot be found", async () => {
    mockedGetCurrentUser.mockRejectedValue(
      new ApiError(404, "User not found", "USER_NOT_FOUND"),
    );

    const token = generateToken("missing-test-user");

    const response = await request(app)
      .get("/api/v1/auth/me")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(404);
    expect(response.body.success).toBe(false);
    expect(response.body.message).toBe("User not found");
    expect(response.body.error.code).toBe("USER_NOT_FOUND");
  });

  it("returns a token after successful email verification", async () => {
    mockedVerifyEmail.mockResolvedValue({
      user: {
        id: "verified-user",
        firstName: "Test",
        lastName: "User",
        email: "student@example.com",
      },
      token: "verified-login-token",
      message: "Email verified successfully.",
    });

    const response = await request(app)
      .post("/api/v1/auth/verify-email")
      .send({
        email: "student@example.com",
        code: "123456",
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.token).toBe("verified-login-token");
    expect(response.body.data.user.email).toBe("student@example.com");
  });

  it("rejects a verification code that is not six digits", async () => {
    const response = await request(app)
      .post("/api/v1/auth/verify-email")
      .send({
        email: "student@example.com",
        code: "123",
      });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
    expect(mockedVerifyEmail).not.toHaveBeenCalled();
  });

  it("returns an error when a verification code is invalid", async () => {
    mockedVerifyEmail.mockRejectedValue(
      new ApiError(
        400,
        "Invalid or expired verification code",
        "INVALID_VERIFICATION_CODE",
      ),
    );

    const response = await request(app)
      .post("/api/v1/auth/verify-email")
      .send({
        email: "student@example.com",
        code: "123456",
      });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("INVALID_VERIFICATION_CODE");
  });

  it("handles verification resend requests", async () => {
    mockedResendVerificationEmail.mockResolvedValue({
      message:
        "If an unverified account exists for that email, a verification code will be sent when permitted.",
    });

    const response = await request(app)
      .post("/api/v1/auth/resend-verification")
      .send({
        email: "student@example.com",
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.message).toContain("If an unverified account exists");
  });

  it("rejects a malformed email on a resend request", async () => {
    const response = await request(app)
      .post("/api/v1/auth/resend-verification")
      .send({
        email: "not-an-email",
      });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
    expect(mockedResendVerificationEmail).not.toHaveBeenCalled();
  });
});
