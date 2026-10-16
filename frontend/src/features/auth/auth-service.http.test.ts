import { afterEach, describe, expect, it, vi } from "vitest";
import { httpAuthService } from "./auth-service";

vi.mock("../../lib/api", async () => {
  const { createApiClient } = await import("../files/api/api-client");
  return { apiClient: createApiClient({ baseUrl: "/api/v1", getToken: () => "session-token",
    fetchImpl: (url, options) => fetch(url, options),
  }) };
});

afterEach(() => { vi.unstubAllGlobals(); });

describe("delete account HTTP contract", () => {
  it("sends DELETE /auth/me with the bearer token and accepts a message-only response", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ success: true, message: "Account deleted successfully" })));
    vi.stubGlobal("fetch", fetcher);
    await expect(httpAuthService.deleteAccount()).resolves.toBeUndefined();
    expect(fetcher).toHaveBeenCalledWith("/api/v1/auth/me", expect.objectContaining({
      method: "DELETE",
      headers: expect.objectContaining({ Authorization: "Bearer session-token" }),
    }));
  });

  it("preserves the backend's failure code so the page can explain it", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({
      success: false, message: "File cleanup was incomplete.", error: { code: "S3_CLEANUP_FAILED" },
    }), { status: 502 })));
    await expect(httpAuthService.deleteAccount()).rejects.toMatchObject({ code: "S3_CLEANUP_FAILED", status: 502 });
  });
});
