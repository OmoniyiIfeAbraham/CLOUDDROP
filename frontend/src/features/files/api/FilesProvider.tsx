import type { ReactNode } from "react";
import { useAuth } from "../../auth/auth-context";
import { apiClient } from "../../../lib/api";
import { USE_MOCK_API } from "../../../lib/runtime";
import { createHttpFilesRepository } from "./files-http-repository";
import { FilesContext } from "./files-context";
import { mockRepositoryFor } from "./mock-repositories";

const httpRepository = createHttpFilesRepository(apiClient);

export const FilesProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const repository = USE_MOCK_API ? mockRepositoryFor(user?.id ?? "anonymous") : httpRepository;

  return <FilesContext.Provider value={repository}>{children}</FilesContext.Provider>;
};
