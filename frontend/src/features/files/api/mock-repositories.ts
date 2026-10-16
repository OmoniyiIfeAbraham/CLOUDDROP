import { createMockFilesRepository } from "./files-mock-repository";
import type { FilesRepository } from "./files-repository";

// Demo mode keeps one in-memory library per account for the life of the page.
const repositories = new Map<string, FilesRepository>();

export const mockRepositoryFor = (userId: string): FilesRepository => {
  const existing = repositories.get(userId);
  if (existing) return existing;
  const repository = userId === "demo-user"
    ? createMockFilesRepository()
    : createMockFilesRepository({ files: [] });
  repositories.set(userId, repository);
  return repository;
};

export const forgetMockRepository = (userId: string): void => {
  repositories.delete(userId);
};
