import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import app from "../src/server.js";
import { generateToken } from "../src/utils/auth.utils.js";
import { getFileById } from "../src/services/file.service.js";
import { generateDownloadUrl } from "../src/services/s3-download.service.js";

vi.mock("../src/services/file.service.js", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../src/services/file.service.js")>();

  return {
    ...actual,
    getFileById: vi.fn(),
  };
});

vi.mock("../src/services/s3-download.service.js", () => ({
  generateDownloadUrl: vi.fn(),
}));

const mockedGetFileById = vi.mocked(getFileById);
const mockedGenerateDownloadUrl = vi.mocked(generateDownloadUrl);

const token = generateToken("validation-test-user");

describe("File View API", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("rejects unauthenticated requests", async () => {
    const response = await request(app).get(
      "/api/v1/files/test-file-id/view",
    );

    expect(response.status).toBe(401);
    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe("UNAUTHORIZED");
  });

  it("returns downloadUrl with inline delivery when disposition=inline", async () => {
    mockedGetFileById.mockResolvedValue({
      id: "test-file-id",
      userId: "validation-test-user",
      originalName: "notes.txt",
      s3Key: "users/validation-test-user/files/test-file-id/notes.txt",
      mimeType: "text/plain",
      size: 100,
    } as Awaited<ReturnType<typeof getFileById>>);

    mockedGenerateDownloadUrl.mockResolvedValue(
      "https://example.com/signed-inline-url",
    );

    const response = await request(app)
      .get("/api/v1/files/test-file-id/download?disposition=inline")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.data.downloadUrl).toBe(
      "https://example.com/signed-inline-url",
    );
    expect(response.body.data.expiresIn).toBe(600);
    expect(response.body.data.file).toEqual({
      id: "test-file-id",
      originalName: "notes.txt",
      mimeType: "text/plain",
      size: 100,
    });
    expect(mockedGenerateDownloadUrl).toHaveBeenCalledWith(
      "users/validation-test-user/files/test-file-id/notes.txt",
      600,
      "notes.txt",
      "text/plain",
      "inline",
    );
  });

  it("keeps normal downloads as attachments by default", async () => {
    mockedGetFileById.mockResolvedValue({
      id: "test-file-id",
      userId: "validation-test-user",
      originalName: "notes.txt",
      s3Key: "users/validation-test-user/files/test-file-id/notes.txt",
      mimeType: "text/plain",
      size: 100,
    } as Awaited<ReturnType<typeof getFileById>>);

    mockedGenerateDownloadUrl.mockResolvedValue(
      "https://example.com/signed-attachment-url",
    );

    const response = await request(app)
      .get("/api/v1/files/test-file-id/download")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.data.downloadUrl).toBe(
      "https://example.com/signed-attachment-url",
    );
    expect(mockedGenerateDownloadUrl).toHaveBeenCalledWith(
      "users/validation-test-user/files/test-file-id/notes.txt",
      600,
      "notes.txt",
    );
  });

  it("rejects inline downloads for unsupported file types", async () => {
    mockedGetFileById.mockResolvedValue({
      id: "test-file-id",
      userId: "validation-test-user",
      originalName: "report.pptx",
      s3Key: "users/validation-test-user/files/test-file-id/report.pptx",
      mimeType: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      size: 100,
    } as Awaited<ReturnType<typeof getFileById>>);

    const response = await request(app)
      .get("/api/v1/files/test-file-id/download?disposition=inline")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(415);
    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe("PREVIEW_NOT_SUPPORTED");
    expect(mockedGenerateDownloadUrl).not.toHaveBeenCalled();
  });

  it("returns an inline view URL for an owned file", async () => {
    mockedGetFileById.mockResolvedValue({
      id: "test-file-id",
      userId: "validation-test-user",
      originalName: "preview.pdf",
      s3Key: "users/validation-test-user/files/test-file-id/preview.pdf",
      mimeType: "application/pdf",
      size: 1024,
    } as Awaited<ReturnType<typeof getFileById>>);

    mockedGenerateDownloadUrl.mockResolvedValue(
      "https://example.com/signed-view-url",
    );

    const response = await request(app)
      .get("/api/v1/files/test-file-id/view")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.viewUrl).toBe(
      "https://example.com/signed-view-url",
    );
    expect(response.body.data.expiresIn).toBe(600);
    expect(response.body.data.file).toEqual({
      id: "test-file-id",
      originalName: "preview.pdf",
      mimeType: "application/pdf",
      size: 1024,
    });

    expect(mockedGetFileById).toHaveBeenCalledWith(
      "test-file-id",
      "validation-test-user",
    );
    expect(mockedGenerateDownloadUrl).toHaveBeenCalledWith(
      "users/validation-test-user/files/test-file-id/preview.pdf",
      600,
      "preview.pdf",
      "application/pdf",
      "inline",
    );
  });

  it("returns 404 when the file is not owned by the requester or does not exist", async () => {
    mockedGetFileById.mockResolvedValue(null);

    const response = await request(app)
      .get("/api/v1/files/another-users-file/view")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(404);
    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe("NOT_FOUND");
    expect(mockedGenerateDownloadUrl).not.toHaveBeenCalled();
  });

  it.each([
    ["Word document", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
    ["spreadsheet", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"],

    ["archive", "application/zip"],
    ["HTML", "text/html"],
    ["SVG", "image/svg+xml"],
    ["PowerPoint", "application/vnd.openxmlformats-officedocument.presentationml.presentation"],
  ])("rejects inline preview for an unsupported %s", async (_label, mimeType) => {
    mockedGetFileById.mockResolvedValue({
      id: "test-file-id",
      userId: "validation-test-user",
      originalName: "uploaded-file",
      s3Key: "users/validation-test-user/files/test-file-id/uploaded-file",
      mimeType,
      size: 1024,
    } as Awaited<ReturnType<typeof getFileById>>);

    const response = await request(app)
      .get("/api/v1/files/test-file-id/view")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(415);
    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe("PREVIEW_NOT_SUPPORTED");
    expect(mockedGenerateDownloadUrl).not.toHaveBeenCalled();
  });

  it.each([
    ["text file", "text/plain", "notes.txt"],
    ["MP4 video", "video/mp4", "clip.mp4"],
    ["MP3 audio", "audio/mpeg", "audio.mp3"],
  ])(
    "allows inline preview for a supported %s",
    async (_label, mimeType, originalName) => {
      mockedGetFileById.mockResolvedValue({
        id: "test-preview-id",
        userId: "validation-test-user",
        originalName,
        s3Key: `users/validation-test-user/files/test-preview-id/${originalName}`,
        mimeType,
        size: 1024,
      } as Awaited<ReturnType<typeof getFileById>>);

      mockedGenerateDownloadUrl.mockResolvedValue(
        "https://example.com/signed-preview-url",
      );

      const response = await request(app)
        .get("/api/v1/files/test-preview-id/view")
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.viewUrl).toBe(
        "https://example.com/signed-preview-url",
      );

      expect(mockedGenerateDownloadUrl).toHaveBeenCalledWith(
        `users/validation-test-user/files/test-preview-id/${originalName}`,
        600,
        originalName,
        mimeType,
        "inline",
      );
    },
  );

  it("allows inline preview for a supported image", async () => {
    mockedGetFileById.mockResolvedValue({
      id: "test-image-id",
      userId: "validation-test-user",
      originalName: "photo.png",
      s3Key: "users/validation-test-user/files/test-image-id/photo.png",
      mimeType: "image/png",
      size: 2048,
    } as Awaited<ReturnType<typeof getFileById>>);

    mockedGenerateDownloadUrl.mockResolvedValue(
      "https://example.com/signed-image-view-url",
    );

    const response = await request(app)
      .get("/api/v1/files/test-image-id/view")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(mockedGenerateDownloadUrl).toHaveBeenCalledWith(
      "users/validation-test-user/files/test-image-id/photo.png",
      600,
      "photo.png",
      "image/png",
      "inline",
    );
  });
});
