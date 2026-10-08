import { createContext, useContext } from "react";
import type { Category } from "../files/model/file.types";

export interface QueueItem {
  id: string;
  file: File;
  category: Category;
  status: "ready" | "uploading" | "complete" | "error";
  progress: number;
  error?: string | undefined;
  retryable?: boolean;
}

export interface UploadQueueValue {
  queue: QueueItem[];
  uploading: boolean;
  addFiles: (files: FileList | File[]) => void;
  setCategory: (id: string, category: Category) => void;
  retry: (id: string) => void;
  remove: (id: string) => void;
  clear: () => void;
  uploadAll: () => Promise<void>;
  cancel: () => void;
}

export const UploadQueueContext = createContext<UploadQueueValue | null>(null);

export const useUploadQueue = (): UploadQueueValue => {
  const context = useContext(UploadQueueContext);
  if (!context) throw new Error("useUploadQueue must be used inside UploadQueueProvider.");
  return context;
};
