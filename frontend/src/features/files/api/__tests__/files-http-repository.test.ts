import { describe, expect, it } from "vitest";
import { createApiClient, type FetchRequestInit, type FetchResponse } from "../api-client";
import { createHttpFilesRepository } from "../files-http-repository";
import { normalFileFixtures } from "../files.fixtures";

const file = normalFileFixtures[0]!;
const success = (data?: unknown): FetchResponse => ({
  ok: true,
  status: 200,
  text: async () => JSON.stringify({ success: true, message: "OK", ...(data === undefined ? {} : { data }) }),
});

describe("HTTP file actions", () => {
  it("uses the implemented detail, download, share, and delete routes", async () => {
    const calls: Array<{ path: string; method: string | undefined; authorization: string | undefined }> = [];
    const results = [
      success({ file }),
      success({ file, downloadUrl: "https://example.invalid/download", expiresIn: 600 }),
      success({ file, shareUrl: "https://example.invalid/share", expiresIn: 10_800 }),
      success(),
    ];
    const client = createApiClient({
      baseUrl: "/api/v1",
      getToken: () => "token-123",
      fetchImpl: async (path: string, init?: FetchRequestInit) => {
        calls.push({ path, method: init?.method, authorization: init?.headers?.Authorization });
        return results.shift()!;
      },
    });
    const repository = createHttpFilesRepository(client);

    expect(await repository.getFile(file.id)).toEqual(file);
    expect((await repository.getDownload(file.id)).expiresIn).toBe(600);
    expect((await repository.getTemporaryShare(file.id)).expiresIn).toBe(10_800);
    await expect(repository.deleteFile(file.id)).resolves.toBeUndefined();
    expect(calls).toEqual([
      { path: `/api/v1/files/${file.id}`, method: "GET", authorization: "Bearer token-123" },
      { path: `/api/v1/files/${file.id}/download`, method: "GET", authorization: "Bearer token-123" },
      { path: `/api/v1/files/${file.id}/share`, method: "GET", authorization: "Bearer token-123" },
      { path: `/api/v1/files/${file.id}`, method: "DELETE", authorization: "Bearer token-123" },
    ]);
  });

  it("preserves a failed delete instead of treating it as success", async () => {
    const client = createApiClient({
      baseUrl: "/api/v1",
      getToken: () => "token-123",
      fetchImpl: async () => ({
        ok: false,
        status: 500,
        text: async () => JSON.stringify({ success: false, message: "File could not be deleted", error: { code: "DELETE_FAILED" } }),
      }),
    });

    await expect(createHttpFilesRepository(client).deleteFile(file.id)).rejects.toMatchObject({
      code: "DELETE_FAILED",
      status: 500,
      retryable: true,
    });
  });
});
