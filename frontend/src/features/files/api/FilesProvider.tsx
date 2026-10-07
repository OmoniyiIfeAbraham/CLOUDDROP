import type { ReactNode } from "react";
import { useAuth } from "../../auth/auth-context";
import { apiClient } from "../../../lib/api";
import { USE_MOCK_API } from "../../../lib/runtime";
import { createHttpFilesRepository } from "./files-http-repository";
import { createMockFilesRepository } from "./files-mock-repository";
import { FilesContext } from "./files-context";
import type { FilesRepository } from "./files-repository";

const httpRepository = createHttpFilesRepository(apiClient);
const mockRepositories = new Map<string, FilesRepository>();

export const FilesProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  let repository = httpRepository;

  if (USE_MOCK_API) {
    const userId = user?.id ?? "anonymous";
    const existing = mockRepositories.get(userId);
    if (existing) {
      repository = existing;
    } else {
      repository = userId === "demo-user"
        ? createMockFilesRepository()
        : createMockFilesRepository({ files: [] });
      mockRepositories.set(userId, repository);
    }
  }

  return <FilesContext.Provider value={repository}>{children}</FilesContext.Provider>;
};
