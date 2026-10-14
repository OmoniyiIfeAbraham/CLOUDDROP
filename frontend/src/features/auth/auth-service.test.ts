import { beforeEach, describe, expect, it } from "vitest";
import { mockAuthService } from "./auth-service";

describe("demo auth service", () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it("requires email verification before restoring a registered user", async () => {
    const registration = await mockAuthService.register({
      firstName: "Ada",
      lastName: "Lovelace",
      email: "ada@example.com",
      password: "securepass123",
    });

    expect(registration.user).toMatchObject({
      firstName: "Ada",
      lastName: "Lovelace",
      email: "ada@example.com",
    });

    const result = await mockAuthService.verifyEmail(
      "ada@example.com",
      "123456",
    );

    expect(result.user).toEqual(registration.user);
    expect(result.token).toBe("clouddrop-demo-session");

    await expect(
      mockAuthService.me(result.token),
    ).resolves.toEqual(registration.user);
  });

  it("rejects an unknown session token", async () => {
    await expect(
      mockAuthService.me("expired"),
    ).rejects.toMatchObject({
      code: "UNAUTHORIZED",
      status: 401,
    });
  });

  it("keeps verified demo identities stable across account switches", async () => {
    const first = await mockAuthService.login({
      email: "demo@clouddrop.app",
      password: "securepass123",
    });

    await mockAuthService.register({
      firstName: "Ada",
      lastName: "Lovelace",
      email: "ADA@example.com",
      password: "securepass123",
    });

    const second = await mockAuthService.verifyEmail(
      "ada@example.com",
      "123456",
    );

    const secondAgain = await mockAuthService.login({
      email: "ada@example.com",
      password: "securepass123",
    });

    expect(first.user.id).not.toBe(second.user.id);
    expect(secondAgain.user).toEqual(second.user);
  });

  it("rejects an incorrect verification code", async () => {
    await mockAuthService.register({
      firstName: "Ada",
      lastName: "Lovelace",
      email: "ada@example.com",
      password: "securepass123",
    });

    await expect(
      mockAuthService.verifyEmail("ada@example.com", "000000"),
    ).rejects.toMatchObject({
      code: "INVALID_VERIFICATION_CODE",
      status: 400,
    });
  });
});
