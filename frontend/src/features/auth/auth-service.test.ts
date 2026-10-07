import { beforeEach, describe, expect, it } from "vitest";
import { mockAuthService } from "./auth-service";

describe("demo auth service", () => {
  beforeEach(() => sessionStorage.clear());

  it("creates a session and restores its user", async () => {
    const result = await mockAuthService.register({
      firstName: "Ada",
      lastName: "Okafor",
      email: "ada@example.com",
      password: "securepass123",
    });
    expect(result.user.email).toBe("ada@example.com");
    await expect(mockAuthService.me(result.token)).resolves.toMatchObject({ firstName: "Ada" });
  });

  it("rejects an unknown session token", async () => {
    await expect(mockAuthService.me("expired")).rejects.toMatchObject({ code: "UNAUTHORIZED", status: 401 });
  });

  it("keeps distinct stable demo identities across account switches", async () => {
    const first = await mockAuthService.login({ email: "demo@clouddrop.app", password: "securepass123" });
    const second = await mockAuthService.register({
      firstName: "Ada",
      lastName: "Lovelace",
      email: "ADA@example.com",
      password: "securepass123",
    });
    const secondAgain = await mockAuthService.login({ email: "ada@example.com", password: "securepass123" });

    expect(first.user.id).not.toBe(second.user.id);
    expect(secondAgain.user).toEqual(second.user);
  });
});
