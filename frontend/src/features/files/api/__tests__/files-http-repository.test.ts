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
  it("requests pages with search and category, and removes backend-only metadata", async () => {
    const paths: string[] = [];
    const page = (files: unknown[]) => success({ files, pagination: { page: 1, limit: 10, total: files.length, totalPages: 1 } });
    const replies = [
      page([{ ...file, s3Key: "private/key" }]),
      page([{ ...file, s3Key: "private/key" }]),
      page([]),
      page([]),
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

    await expect(repository.listFiles()).resolves.toEqual({ files: [file], page: 1, limit: 10, total: 1, totalPages: 1 });
    await repository.listFiles({ search: " proposal " });
    await repository.listFiles({ search: "   ", category: "Images", page: 2, limit: 5 });
    await repository.listFiles({ search: "", category: undefined });
    expect(paths).toEqual([
      "/api/v1/files?page=1&limit=10",
      "/api/v1/files?search=proposal&page=1&limit=10",
      "/api/v1/files?category=Images&page=2&limit=5",
      "/api/v1/files?page=1&limit=10",
    ]);
  });

  it("rejects malformed file payloads before pages render them", async () => {
    const replies = [
      success({ files: "not-an-array", pagination: { page: 1, limit: 10, total: 0, totalPages: 0 } }),
      success({ files: [] }),
      success({ file: { ...file, category: "Unknown" } }),
    ];
    const client = createApiClient({
      baseUrl: "/api/v1",
      getToken: () => "token-123",
      fetchImpl: async () => replies.shift()!,
    });
    const repository = createHttpFilesRepository(client);

    await expect(repository.listFiles()).rejects.toMatchObject({ code: "INVALID_RESPONSE" });
    await expect(repository.listFiles()).rejects.toMatchObject({ code: "INVALID_RESPONSE" });
    await expect(repository.getFile(file.id)).rejects.toMatchObject({ code: "INVALID_RESPONSE" });
  });

  it("retains a short CloudDrop share URL and absolute expiry while discarding the separate token", async () => {
    const expiresAt = "2026-11-13T10:00:00.000Z";
    const shareUrl = "https://clouddrop-c8.duckdns.org/s/Ab7kP2xQ";
    const sharedFile = { id: file.id, originalName: file.originalName, mimeType: file.mimeType };
    const client = createApiClient({ baseUrl: "/api/v1", getToken: () => "token-123", fetchImpl: async () => success({ file: sharedFile, shareUrl, expiresIn: 86400, expiresAt, token: "not-needed-by-ui" }) });
    expect(await createHttpFilesRepository(client).getTemporaryShare(file.id, 24)).toEqual({ file: sharedFile, shareUrl, expiresIn: 86400, expiresAt });
  });

  it("reads dashboard totals from the stats endpoint", async () => {
    const paths: string[] = [];
    const filesByCategory = { Documents: 2, Images: 1, Videos: 0, Audio: 0, Archives: 0, Other: 0 };
    const replies = [
      success({ totalFiles: 3, totalStorage: 4096, sharedFiles: 1, filesByCategory }),
      success({ totalFiles: 3, totalStorage: 4096, sharedFiles: 1, filesByCategory: { Documents: 2 } }),
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

    await expect(repository.getDashboardStats()).resolves.toEqual({ totalFiles: 3, totalStorageBytes: 4096, sharedFiles: 1, filesByCategory });
    await expect(repository.getDashboardStats()).rejects.toMatchObject({ code: "INVALID_RESPONSE" });
    expect(paths[0]).toBe("/api/v1/dashboard/stats");
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
      expiresAt: "2026-10-09T12:00:00.000Z",
    });
    await expect(repository.deleteFile(file.id)).resolves.toBeUndefined();
    expect(calls).toEqual([
      { path: `/api/v1/files/${file.id}`, method: "GET", authorization: "Bearer token-123" },
      { path: `/api/v1/files/${file.id}/download?disposition=attachment`, method: "GET", authorization: "Bearer token-123" },
      { path: `/api/v1/files/${file.id}/share`, method: "POST", authorization: "Bearer token-123" },
      { path: `/api/v1/files/${file.id}`, method: "DELETE", authorization: "Bearer token-123" },
    ]);
  });

  it("requests inline delivery only for the separate View action", async () => {
    const paths: string[] = [];
    const client = createApiClient({ baseUrl: "/api/v1", getToken: () => "token-123", fetchImpl: async (path: string) => {
      paths.push(path); return success({ file, downloadUrl: "https://example.invalid/preview", expiresIn: 600 });
    } });
    await createHttpFilesRepository(client).getDownload(file.id, "inline");
    expect(paths).toEqual([`/api/v1/files/${file.id}/download?disposition=inline`]);
  });

  it("sends the chosen share lifetime to the backend", async () => {
    const bodies: Array<string | undefined> = [];
    const client = createApiClient({
      baseUrl: "/api/v1",
      getToken: () => "token-123",
      fetchImpl: async (_path: string, init?: FetchRequestInit) => {
        bodies.push(init?.body);
        return success({ file, shareUrl: "https://example.invalid/share", expiresIn: 604_800 }, 201);
      },
    });
    const repository = createHttpFilesRepository(client);

    await repository.getTemporaryShare(file.id, 168);
    await repository.getTemporaryShare(file.id);
    expect(bodies).toEqual([JSON.stringify({ ttlHours: 168 }), undefined]);
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
