import { describe, expect, it } from "vitest";
import { manyFileFixtures, mockFailureFixtures, normalFileFixtures } from "../files.fixtures";
import { createMockFilesRepository } from "../files-mock-repository";

describe("MockFilesRepository", () => {
  it("searches case-insensitively and mutates only its own file state", async () => {
    const repository = createMockFilesRepository();

    const searchResults = await repository.listFiles({ search: "PROPOSAL" });
    expect(searchResults.files).toHaveLength(1);
    expect(searchResults.files[0]?.id).toBe("file-document-1");

    await repository.deleteFile("file-document-1");

    expect((await repository.listFiles()).total).toBe(normalFileFixtures.length - 1);
    expect(normalFileFixtures).toHaveLength(6);
  });

  it("pages and filters newest first, like the backend", async () => {
    const second = await createMockFilesRepository({ files: manyFileFixtures }).listFiles({ page: 2, limit: 10 });
    expect(second).toMatchObject({ page: 2, limit: 10, total: 30, totalPages: 3 });
    expect(second.files[0]?.originalName).toBe("report-11.pdf");

    const images = await createMockFilesRepository().listFiles({ category: "Images" });
    expect(images.files.map((file) => file.category)).toEqual(["Images"]);
    expect(images).toMatchObject({ total: 1, totalPages: 1 });
  });

  it("counts created share links in the dashboard totals", async () => {
    const repository = createMockFilesRepository();
    await repository.getTemporaryShare("file-document-1");
    expect(await repository.getDashboardStats()).toMatchObject({ totalFiles: 6, sharedFiles: 1 });
  });

  it("supplies temporary URLs with the documented expirations", async () => {
    const repository = createMockFilesRepository();

    await expect(
      repository.getDownload("file-document-1"),
    ).resolves.toMatchObject({
      expiresIn: 600,
      downloadUrl: "https://example.invalid/download/file-document-1",
    });

    await expect(
      repository.getTemporaryShare("file-document-1"),
    ).resolves.toMatchObject({
      expiresIn: 86_400,
      shareUrl: "https://example.invalid/share/file-document-1",
    });
  });

  it("can model a retrieval failure", async () => {
    const repository = createMockFilesRepository({
      failures: { list: mockFailureFixtures.retrieval },
    });

    await expect(repository.listFiles()).rejects.toMatchObject({
      code: "FILES_RETRIEVAL_FAILED",
      retryable: true,
    });
  });
});
