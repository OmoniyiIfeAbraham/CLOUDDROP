import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "../../components/ui/toast-context";
import { userMessage } from "../../lib/messages";
import { useAuth } from "../auth/auth-context";
import { isApiError } from "../files/api/api-error";
import { useFilesRepository } from "../files/api/files-context";
import type { Category } from "../files/model/file.types";
import { suggestCategory, validateUploadFile } from "./upload-service";
import { UploadQueueContext } from "./upload-queue-context";
import type { QueueItem } from "./upload-queue-context";

export const UploadQueueProvider = ({ children }: { children: ReactNode }) => {
  const repository = useFilesRepository();
  const queryClient = useQueryClient();
  const { notify } = useToast();
  const { user } = useAuth();
  const ownerId = user?.id ?? null;
  const [owner, setOwner] = useState(ownerId);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [uploading, setUploading] = useState(false);
  const activeUpload = useRef<AbortController | null>(null);
  const stopRequested = useRef(false);
  const session = useRef(0);

  // A queue belongs to one account, so a sign-out or account switch empties it.
  if (owner !== ownerId) {
    setOwner(ownerId);
    setQueue([]);
    setUploading(false);
  }

  useEffect(() => () => {
    session.current += 1;
    activeUpload.current?.abort();
  }, [ownerId]);

  useEffect(() => {
    if (!uploading) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [uploading]);

  const updateItem = useCallback((id: string, change: Partial<QueueItem>) => {
    setQueue((current) => current.map((item) => item.id === id ? { ...item, ...change } : item));
  }, []);

  const addFiles = useCallback((selected: FileList | File[]) => {
    const items = Array.from(selected).map((file): QueueItem => {
      const error = validateUploadFile(file);
      return {
        id: crypto.randomUUID(),
        file,
        category: suggestCategory(file.type),
        status: error ? "error" : "ready",
        progress: 0,
        ...(error ? { error, retryable: false } : {}),
      };
    });
    setQueue((current) => [...current, ...items]);
  }, []);

  const setCategory = useCallback((id: string, category: Category) => updateItem(id, { category }), [updateItem]);
  const retry = useCallback((id: string) => updateItem(id, { status: "ready", progress: 0, error: undefined, retryable: false }), [updateItem]);
  const remove = useCallback((id: string) => setQueue((current) => current.filter((item) => item.id !== id)), []);
  const clear = useCallback(() => setQueue((current) => current.filter((item) => item.status === "uploading")), []);

  const cancel = useCallback(() => {
    stopRequested.current = true;
    activeUpload.current?.abort();
  }, []);

  const uploadAll = useCallback(async () => {
    const pending = queue.filter((item) => item.status === "ready");
    if (uploading || !pending.length) return;
    const run = session.current;
    stopRequested.current = false;
    setUploading(true);
    let completed = 0;
    for (const item of pending) {
      if (stopRequested.current || run !== session.current) break;
      const controller = new AbortController();
      activeUpload.current = controller;
      updateItem(item.id, { status: "uploading", progress: 0 });
      try {
        await repository.uploadFile(item.file, item.category, (progress) => updateItem(item.id, { progress }), controller.signal);
        updateItem(item.id, { status: "complete", progress: 100 });
        completed += 1;
      } catch (error) {
        const cancelled = isApiError(error) && error.code === "UPLOAD_CANCELLED";
        updateItem(item.id, {
          status: "error",
          error: userMessage(error, "Upload failed. Please try again."),
          retryable: cancelled || !isApiError(error) || error.retryable,
        });
      } finally {
        activeUpload.current = null;
      }
    }
    if (run !== session.current) return;
    if (completed) {
      await queryClient.invalidateQueries({ queryKey: ["files"] });
      notify(`${completed} ${completed === 1 ? "file" : "files"} uploaded.`);
    }
    setUploading(false);
  }, [queue, uploading, repository, queryClient, notify, updateItem]);

  const value = useMemo(
    () => ({ queue, uploading, addFiles, setCategory, retry, remove, clear, uploadAll, cancel }),
    [queue, uploading, addFiles, setCategory, retry, remove, clear, uploadAll, cancel],
  );
  return <UploadQueueContext.Provider value={value}>{children}</UploadQueueContext.Provider>;
};
