import { GetObjectCommand } from "@aws-sdk/client-s3";
import { create as createContentDisposition } from "content-disposition";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { getSignedUrlMock } = vi.hoisted(() => ({
  getSignedUrlMock: vi.fn(),
}));

vi.mock("@aws-sdk/s3-request-presigner", () => ({
  getSignedUrl: getSignedUrlMock,
}));

import { generateDownloadUrl } from "../src/services/s3-download.service.js";
import { S3_BUCKET_NAME, s3Client } from "../src/config/s3.js";

describe("S3 download URL", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSignedUrlMock.mockResolvedValue(
      "https://example.test/signed-download",
    );
  });

  it("requests an attachment with the original filename", async () => {
    const filename = "notes report.pdf";

    const url = await generateDownloadUrl(
      "users/u1/files/f1/notes.pdf",
      600,
      filename,
    );

    expect(url).toBe("https://example.test/signed-download");
    expect(getSignedUrlMock).toHaveBeenCalledOnce();

    const [client, command, options] =
      getSignedUrlMock.mock.calls[0] as [
        typeof s3Client,
        GetObjectCommand,
        { expiresIn: number },
      ];

    expect(client).toBe(s3Client);
    expect(command).toBeInstanceOf(GetObjectCommand);
    expect(command.input).toMatchObject({
      Bucket: S3_BUCKET_NAME,
      Key: "users/u1/files/f1/notes.pdf",
      ResponseContentDisposition: createContentDisposition(
        filename,
        { type: "attachment" },
      ),
      ResponseContentType: "application/octet-stream",
    });
    expect(options.expiresIn).toBe(600);
  });

  it.each([
    'my "report".pdf',
    "résumé – final.pdf",
  ])("safely builds the attachment header for filename: %s", async (filename) => {
    await generateDownloadUrl("users/u1/files/f1/file", 600, filename);

    const [, command] = getSignedUrlMock.mock.calls[0] as [
      typeof s3Client,
      GetObjectCommand,
      { expiresIn: number },
    ];

    expect(command.input.ResponseContentDisposition).toBe(
      createContentDisposition(filename, { type: "attachment" }),
    );
    expect(command.input.ResponseContentType).toBe(
      "application/octet-stream",
    );
  });

  it("preserves the default expiry of 600 seconds", async () => {
    await generateDownloadUrl("users/u1/files/f1/file.pdf", undefined, "file.pdf");

    const [, , options] = getSignedUrlMock.mock.calls[0] as [
      typeof s3Client,
      GetObjectCommand,
      { expiresIn: number },
    ];

    expect(options.expiresIn).toBe(600);
  });

  it("preserves a caller-supplied expiry", async () => {
    await generateDownloadUrl("users/u1/files/f1/file.pdf", 120, "file.pdf");

    const [, , options] = getSignedUrlMock.mock.calls[0] as [
      typeof s3Client,
      GetObjectCommand,
      { expiresIn: number },
    ];

    expect(options.expiresIn).toBe(120);
  });

  it("keeps the existing behavior when no filename is provided", async () => {
    await generateDownloadUrl("users/u1/files/f1/file.pdf");

    const [, command] = getSignedUrlMock.mock.calls[0] as [
      typeof s3Client,
      GetObjectCommand,
      { expiresIn: number },
    ];

    expect(command.input.ResponseContentDisposition).toBeUndefined();
    expect(command.input.ResponseContentType).toBeUndefined();
  });
});
