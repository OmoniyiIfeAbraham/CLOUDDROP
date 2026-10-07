import { describe, expect, it, vi } from "vitest";
import {
  createApiClient,
  type FetchImplementation,
  type FetchRequestInit,
  type FetchResponse,
} from "../api-client";
import { ApiError } from "../api-error";

const response = (status: number, body: string): FetchResponse => ({
  ok: status >= 200 && status < 300,
  status,
  text: async () => body,
});

const successBody = (data: unknown): string =>
  JSON.stringify({
    success: true,
    message: "Request successful",
    data,
  });

const failureBody = (code: string, message: string): string =>
  JSON.stringify({
    success: false,
    message,
    error: { code },
  });

describe("ApiClient", () => {
  it("adds the Bearer token and returns only envelope data", async () => {
    const requests: Array<{ input: string; init: FetchRequestInit | undefined }> = [];
    const fetchImpl: FetchImplementation = async (input, init) => {
      requests.push({ input, init });
      return response(200, successBody({ files: [] }));
    };
    const client = createApiClient({
      baseUrl: "/api/v1",
      getToken: () => "token-123",
      fetchImpl,
    });

    const data = await client.request<{ files: unknown[] }>("/files");

    expect(data).toEqual({ files: [] });
    expect(requests[0]).toEqual({
      input: "/api/v1/files",
      init: {
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: "Bearer token-123",
        },
      },
    });
  });

  it("returns a predictable unauthorized error without a token", async () => {
    const fetchImpl: FetchImplementation = async () =>
      response(200, successBody({ files: [] }));
    const client = createApiClient({
      baseUrl: "/api/v1",
      getToken: () => null,
      fetchImpl,
    });

    await expect(client.request("/files")).rejects.toMatchObject({
      name: "ApiError",
      code: "UNAUTHORIZED",
      status: 401,
    });
  });

  it("normalizes network failures", async () => {
    const fetchImpl: FetchImplementation = async () => {
      throw new Error("offline");
    };
    const client = createApiClient({
      baseUrl: "/api/v1",
      getToken: () => "token-123",
      fetchImpl,
    });

    await expect(client.request("/files")).rejects.toMatchObject({
      name: "ApiError",
      code: "NETWORK_ERROR",
      retryable: true,
    });
  });

  it("normalizes a non-JSON failed response", async () => {
    const client = createApiClient({
      baseUrl: "/api/v1",
      getToken: () => "token-123",
      fetchImpl: async () => response(502, "gateway error"),
    });

    await expect(client.request("/files")).rejects.toMatchObject({
      name: "ApiError",
      code: "HTTP_ERROR",
      status: 502,
      retryable: true,
    });
  });

  it("normalizes an API envelope failure", async () => {
    const client = createApiClient({
      baseUrl: "/api/v1",
      getToken: () => "token-123",
      fetchImpl: async () =>
        response(400, failureBody("BAD_REQUEST", "Search query is required")),
    });

    await expect(client.request("/files/search")).rejects.toMatchObject({
      name: "ApiError",
      code: "BAD_REQUEST",
      message: "Search query is required",
      status: 400,
    });
  });

  it("normalizes a 401 response from an expired or invalid token", async () => {
    const client = createApiClient({
      baseUrl: "/api/v1",
      getToken: () => "expired-token",
      fetchImpl: async () =>
        response(401, failureBody("UNAUTHORIZED", "Invalid or expired token")),
    });

    await expect(client.request("/files")).rejects.toBeInstanceOf(ApiError);
    await expect(client.request("/files")).rejects.toMatchObject({
      code: "UNAUTHORIZED",
      status: 401,
    });
  });

  it("normalizes an HTML 401 and notifies the session owner", async () => {
    let expired = false;
    const client = createApiClient({
      baseUrl: "/api/v1",
      getToken: () => "expired-token",
      fetchImpl: async () => response(401, "<html>Unauthorized</html>"),
      onUnauthorized: () => { expired = true; },
    });

    await expect(client.request("/files")).rejects.toMatchObject({
      code: "UNAUTHORIZED",
      status: 401,
    });
    expect(expired).toBe(true);
  });

  it("normalizes an unreadable 401 and notifies the session owner", async () => {
    let expired = false;
    const client = createApiClient({
      baseUrl: "/api/v1",
      getToken: () => "expired-token",
      fetchImpl: async () => ({ ok: false, status: 401, text: async () => { throw new Error("stream failed"); } }),
      onUnauthorized: () => { expired = true; },
    });

    await expect(client.request("/files")).rejects.toMatchObject({ code: "UNAUTHORIZED", status: 401 });
    expect(expired).toBe(true);
  });

  it("passes the request token to the session owner", async () => {
    const onUnauthorized = vi.fn();
    const client = createApiClient({
      baseUrl: "/api/v1",
      getToken: () => "request-token",
      fetchImpl: async () => response(401, failureBody("UNAUTHORIZED", "Expired")),
      onUnauthorized,
    });

    await expect(client.request("/files")).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    expect(onUnauthorized).toHaveBeenCalledExactlyOnceWith("request-token");
  });

  it("does not expire an existing session for an optional login request", async () => {
    const onUnauthorized = vi.fn();
    const client = createApiClient({
      baseUrl: "/api/v1",
      getToken: () => "current-token",
      fetchImpl: async () => response(401, failureBody("INVALID_CREDENTIALS", "Invalid credentials")),
      onUnauthorized,
    });

    await expect(client.request("/auth/login", { auth: "optional", method: "POST" })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    expect(onUnauthorized).not.toHaveBeenCalled();
  });
});
