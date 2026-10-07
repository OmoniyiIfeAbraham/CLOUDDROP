import type { ReactNode } from "react";
import { apiClient } from "../../../lib/api";
import { USE_MOCK_API } from "../../../lib/runtime";
import { createHttpFilesRepository } from "./files-http-repository";
import { createMockFilesRepository } from "./files-mock-repository";
import { FilesContext } from "./files-context";

const repository = USE_MOCK_API
  ? createMockFilesRepository()
  : createHttpFilesRepository(apiClient);

export const FilesProvider = ({ children }: { children: ReactNode }) => (
  <FilesContext.Provider value={repository}>{children}</FilesContext.Provider>
);
