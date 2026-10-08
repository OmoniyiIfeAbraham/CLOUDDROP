import { createContext, useContext } from "react";
import type { FilesRepository } from "./files-repository";

export const FilesContext = createContext<FilesRepository | null>(null);

export const useFilesRepository = (): FilesRepository => {
  const repository = useContext(FilesContext);
  if (!repository) throw new Error("useFilesRepository must be used inside FilesProvider.");
  return repository;
};
