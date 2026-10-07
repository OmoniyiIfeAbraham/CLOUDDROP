import { afterEach, describe, expect, it, vi } from "vitest";
import { sessionToken } from "./runtime";

afterEach(() => {
  sessionToken.clear();
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe("shared API session handling", () => {
  it("does not clear a newer session when an old request returns 401", async () => {
    let finishRequest!: (value: { ok: boolean; status: number; text: () => Promise<string> }) => void;
    let requestStarted!: () => void;
    const started = new Promise<void>((resolve) => { requestStarted = resolve; });
    const response = new Promise<{ ok: boolean; status: number; text: () => Promise<string> }>((resolve) => {
      finishRequest = resolve;
    });
    vi.stubGlobal("fetch", vi.fn(() => {
      requestStarted();
      return response;
    }));
    sessionToken.set("old-token");
    const { apiClient, SESSION_EXPIRED_EVENT } = await import("./api");
    const listener = vi.fn();
    window.addEventListener(SESSION_EXPIRED_EVENT, listener);

    const pending = apiClient.request("/files");
    await started;
    sessionToken.set("new-token");
    finishRequest({ ok: false, status: 401, text: async () => "Unauthorized" });
    await expect(pending).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    expect(sessionToken.get()).toBe("new-token");
    expect(listener).not.toHaveBeenCalled();
    window.removeEventListener(SESSION_EXPIRED_EVENT, listener);
  });
});
