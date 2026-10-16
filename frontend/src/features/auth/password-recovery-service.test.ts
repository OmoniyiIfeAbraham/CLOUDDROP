import { afterEach, describe, expect, it, vi } from "vitest";
import { DEMO_RESET_TOKEN, httpPasswordRecoveryService, mockPasswordRecoveryService } from "./password-recovery-service";

vi.mock("../../lib/api", async () => {
  const { createApiClient } = await import("../files/api/api-client");
  return { apiClient: createApiClient({ baseUrl: "/api/v1", getToken: () => null,
    fetchImpl: (url, options) => fetch(url, options),
  }) };
});

afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

describe("password recovery HTTP contract", () => {
  it("accepts the generic forgot response without a session or data field", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ success: true, message: "If an account exists..." })));
    vi.stubGlobal("fetch", fetcher);
    await expect(httpPasswordRecoveryService.requestReset("ada@example.com")).resolves.toBeUndefined();
    expect(fetcher).toHaveBeenCalledWith("/api/v1/auth/forgot-password", expect.objectContaining({
      method: "POST", body: JSON.stringify({ email: "ada@example.com" }),
    }));
  });
  it("submits the token and newPassword and accepts a message-only reset response", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ success: true, message: "Password reset successful." })));
    vi.stubGlobal("fetch", fetcher);
    await expect(httpPasswordRecoveryService.resetPassword("test-token", "new-password")).resolves.toBeUndefined();
    expect(fetcher).toHaveBeenCalledWith("/api/v1/auth/reset-password", expect.objectContaining({
      method: "POST", body: JSON.stringify({ token: "test-token", newPassword: "new-password" }),
    }));
  });
  it("preserves the invalid/expired-token code from the backend", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({
      success: false, message: "Invalid or expired", error: { code: "INVALID_OR_EXPIRED_RESET_TOKEN" },
    }), { status: 400 })));
    await expect(httpPasswordRecoveryService.resetPassword("invalid-token", "new-password")).rejects.toMatchObject({
      code: "INVALID_OR_EXPIRED_RESET_TOKEN", status: 400,
    });
  });
});

describe("password recovery demo", () => {
  it("allows one use of the sample link without making an HTTP request", async () => {
    vi.stubGlobal("fetch", vi.fn());
    await mockPasswordRecoveryService.requestReset("ada@example.com");
    await mockPasswordRecoveryService.resetPassword(DEMO_RESET_TOKEN, "new-password");
    await expect(mockPasswordRecoveryService.resetPassword(DEMO_RESET_TOKEN, "another-password")).rejects.toMatchObject({ code: "INVALID_OR_EXPIRED_RESET_TOKEN" });
    expect(fetch).not.toHaveBeenCalled();
  });
  it("expires demo links after 30 minutes", async () => {
    vi.useFakeTimers();
    await mockPasswordRecoveryService.requestReset("ada@example.com");
    vi.advanceTimersByTime(30 * 60 * 1000);
    await expect(mockPasswordRecoveryService.resetPassword(DEMO_RESET_TOKEN, "new-password")).rejects.toMatchObject({ code: "INVALID_OR_EXPIRED_RESET_TOKEN" });
  });
});
