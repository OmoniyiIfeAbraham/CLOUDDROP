import { describe, expect, it } from "vitest";
import { mockFailureFixtures, normalFileFixtures } from "../files.fixtures";
import { createMockFilesRepository } from "../files-mock-repository";

describe("MockFilesRepository", () => {
  it("searches case-insensitively and mutates only its own file state", async () => {
    const repository = createMockFilesRepository();

    const searchResults = await repository.searchFiles("PROPOSAL");
    expect(searchResults).toHaveLength(1);
    expect(searchResults[0]?.id).toBe("file-document-1");

    await repository.deleteFile("file-document-1");

    expect(await repository.listFiles()).toHaveLength(
      normalFileFixtures.length - 1,
    );
    expect(normalFileFixtures).toHaveLength(6);
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
      expiresIn: 10_800,
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
