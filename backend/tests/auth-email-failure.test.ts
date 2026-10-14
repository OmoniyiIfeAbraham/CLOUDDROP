import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findUnique: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  updateMany: vi.fn(),
  sendVerificationEmail: vi.fn(),
}));

vi.mock("../src/generated/prisma/client.js", () => ({
  PrismaClient: class {
    user = {
      findUnique: mocks.findUnique,
      create: mocks.create,
      update: mocks.update,
      updateMany: mocks.updateMany,
    };
  },
}));

vi.mock("@prisma/adapter-pg", () => ({
  PrismaPg: vi.fn(),
}));

vi.mock("../src/services/email.service.js", () => ({
  sendVerificationEmail: mocks.sendVerificationEmail,
}));

vi.mock("../src/utils/auth.utils.js", () => ({
  hashPassword: vi.fn().mockResolvedValue("test-password-hash"),
  comparePassword: vi.fn(),
  generateToken: vi.fn(),
}));

describe("Authentication email delivery failures", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.resetModules();

    vi.stubEnv(
      "DATABASE_URL",
      "postgresql://test:test@localhost:5432/cloud_drop_test",
    );
    vi.stubEnv("NODE_ENV", "test");
  });

  it("clears the verification code when registration email delivery fails", async () => {
    mocks.findUnique.mockResolvedValue(null);

    mocks.create.mockResolvedValue({
      id: "test-user-id",
      firstName: "Test",
      lastName: "User",
      email: "student@example.com",
    });

    mocks.sendVerificationEmail.mockRejectedValue(
      new Error("Simulated email provider failure"),
    );

    const { registerUser } = await import(
      "../src/services/auth.service.js"
    );

    await expect(
      registerUser(
        "Test",
        "User",
        "student@example.com",
        "test-password",
      ),
    ).rejects.toThrow(
      "Your account was created, but the verification email could not be sent.",
    );

    expect(mocks.updateMany).toHaveBeenCalledWith({
      where: {
        id: "test-user-id",
        emailVerificationCodeHash: expect.any(String),
        emailVerificationSentAt: expect.any(Date),
      },
      data: {
        emailVerificationCodeHash: null,
        emailVerificationExpiresAt: null,
        emailVerificationSentAt: null,
        emailVerificationAttempts: 0,
      },
    });
  });

  it("clears the replacement code when resend email delivery fails", async () => {
    mocks.findUnique.mockResolvedValue({
      id: "test-user-id",
      firstName: "Test",
      lastName: "User",
      email: "student@example.com",
      emailVerified: false,
      emailVerificationCodeHash: "previous-hash",
      emailVerificationExpiresAt: new Date(Date.now() + 300_000),
      emailVerificationSentAt: new Date(Date.now() - 120_000),
      emailVerificationAttempts: 2,
    });

    mocks.update.mockResolvedValue({});

    mocks.sendVerificationEmail.mockRejectedValue(
      new Error("Simulated email provider failure"),
    );

    const { resendVerificationEmail } = await import(
      "../src/services/auth.service.js"
    );

    await expect(
      resendVerificationEmail("student@example.com"),
    ).rejects.toThrow(
      "Unable to send the verification email right now.",
    );

    expect(mocks.updateMany).toHaveBeenCalledWith({
      where: {
        id: "test-user-id",
        emailVerificationCodeHash: expect.any(String),
        emailVerificationSentAt: expect.any(Date),
      },
      data: {
        emailVerificationCodeHash: null,
        emailVerificationExpiresAt: null,
        emailVerificationSentAt: null,
        emailVerificationAttempts: 0,
      },
    });
  });
});
