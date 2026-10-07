import { ApiError } from "../features/files/api/api-error";

const knownMessages: Record<string, string> = {
  UNAUTHORIZED: "Your session has ended. Please sign in again.",
  INVALID_RESPONSE: "The server returned unexpected data. Please try again.",
  NETWORK_ERROR: "Could not connect. Check your connection and try again.",
  NOT_FOUND: "That file is no longer available.",
  FILE_TOO_LARGE: "This file exceeds the 2 GB upload limit.",
  UNSUPPORTED_FILE_TYPE: "This file type is not supported.",
  INVALID_UPLOAD: "Check the file and category, then try again.",
  FILES_RETRIEVAL_FAILED: "Your files could not be loaded.",
  SEARCH_FAILED: "Search could not be completed.",
  DELETE_FAILED: "The file could not be deleted.",
  DOWNLOAD_FAILED: "The download link could not be created.",
  SHARE_FAILED: "The share link could not be created.",
};

export const userMessage = (error: unknown, fallback = "Something went wrong. Please try again."): string => {
  if (error instanceof ApiError) {
    return knownMessages[error.code] ?? fallback;
  }

  return fallback;
};
