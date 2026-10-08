import { describe, expect, it } from "vitest";
import { createApiClient, type FetchRequestInit, type FetchResponse } from "../api-client";
import { createHttpFilesRepository } from "../files-http-repository";
import { normalFileFixtures } from "../files.fixtures";

const file = normalFileFixtures[0]!;
const success = (data?: unknown, status = 200): FetchResponse => ({
  ok: true,
  status,
  text: async () => JSON.stringify({ success: true, message: "OK", ...(data === undefined ? {} : { data }) }),
});

describe("HTTP file actions", () => {
  it("validates list and search data and removes backend-only metadata", async () => {
    const paths: string[] = [];
    const replies = [
      success({ files: [{ ...file, s3Key: "private/key" }] }),
      success({ files: [{ ...file, s3Key: "private/key" }] }),
      success({ files: [{ ...file, s3Key: "private/key" }] }),
    ];
    const client = createApiClient({
      baseUrl: "/api/v1",
      getToken: () => "token-123",
      fetchImpl: async (path: string) => {
        paths.push(path);
        return replies.shift()!;
      },
    });
    const repository = createHttpFilesRepository(client);

    await expect(repository.listFiles()).resolves.toEqual([file]);
    await expect(repository.searchFiles(" proposal ")).resolves.toEqual([file]);
    await expect(repository.searchFiles("   ")).resolves.toEqual([file]);
    expect(paths).toEqual(["/api/v1/files", "/api/v1/files?search=proposal", "/api/v1/files"]);
  });

  it("rejects malformed file payloads before pages render them", async () => {
    const replies = [success({ files: "not-an-array" }), success({ file: { ...file, category: "Unknown" } })];
    const client = createApiClient({
      baseUrl: "/api/v1",
      getToken: () => "token-123",
      fetchImpl: async () => replies.shift()!,
    });
    const repository = createHttpFilesRepository(client);

    await expect(repository.listFiles()).rejects.toMatchObject({ code: "INVALID_RESPONSE" });
    await expect(repository.getFile(file.id)).rejects.toMatchObject({ code: "INVALID_RESPONSE" });
  });

  it("uses the implemented detail, download, share, and delete routes", async () => {
    const calls: Array<{ path: string; method: string | undefined; authorization: string | undefined }> = [];
    const results = [
      success({ file: { ...file, s3Key: "private/key" } }),
      success({ file: { ...file, s3Key: "private/key" }, downloadUrl: "https://example.invalid/download", expiresIn: 600 }),
      success({ file: { ...file, s3Key: "private/key" }, token: "share-token", shareUrl: "https://example.invalid/share", expiresAt: "2026-10-09T12:00:00.000Z", expiresIn: 86_400 }, 201),
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
    expect(await repository.getDownload(file.id)).toEqual({
      file: { id: file.id, originalName: file.originalName, mimeType: file.mimeType, size: file.size },
      downloadUrl: "https://example.invalid/download",
      expiresIn: 600,
    });
    expect(await repository.getTemporaryShare(file.id)).toEqual({
      file: { id: file.id, originalName: file.originalName, mimeType: file.mimeType },
      shareUrl: "https://example.invalid/share",
      expiresIn: 86_400,
    });
    await expect(repository.deleteFile(file.id)).resolves.toBeUndefined();
    expect(calls).toEqual([
      { path: `/api/v1/files/${file.id}`, method: "GET", authorization: "Bearer token-123" },
      { path: `/api/v1/files/${file.id}/download`, method: "GET", authorization: "Bearer token-123" },
      { path: `/api/v1/files/${file.id}/share`, method: "POST", authorization: "Bearer token-123" },
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
