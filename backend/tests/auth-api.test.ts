import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import app from "../src/server.js";
import { ApiError } from "../src/utils/api-error.js";
import {
  registerUser,
  loginUser,
  getCurrentUser,
} from "../src/services/auth.service.js";
import { generateToken } from "../src/utils/auth.utils.js";

vi.mock("../src/services/auth.service.js", () => ({
  registerUser: vi.fn(),
  loginUser: vi.fn(),
  getCurrentUser: vi.fn(),
}));

const mockedRegisterUser = vi.mocked(registerUser);
const mockedLoginUser = vi.mocked(loginUser);
const mockedGetCurrentUser = vi.mocked(getCurrentUser);

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
});