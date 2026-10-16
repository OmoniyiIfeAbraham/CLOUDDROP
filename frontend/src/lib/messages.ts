import { ApiError } from "../features/files/api/api-error";

const knownMessages: Record<string, string> = {
  UNAUTHORIZED: "Your session has ended. Please sign in again.",
  INVALID_CREDENTIALS: "Incorrect email or password.",
  EMAIL_ALREADY_REGISTERED: "An account with this email already exists. Sign in instead.",
  EMAIL_NOT_VERIFIED: "Verify your email before signing in. Enter your code or request a new one.",
  VERIFICATION_EMAIL_FAILED: "We could not send the verification email. Please try resending the code in a moment.",
  INVALID_VERIFICATION_CODE: "That code is incorrect or has expired. Check it or request a new code.",
  VERIFICATION_ATTEMPTS_EXCEEDED: "Too many incorrect codes. Request a new verification code before trying again.",
  EMAIL_ALREADY_VERIFIED: "Your email is already verified. Sign in to continue.",
  INVALID_RESPONSE: "The server returned unexpected data. Please try again.",
  NETWORK_ERROR: "Could not connect. Check your connection and try again.",
  FILE_TOO_LARGE: "This file exceeds the 25 MB upload limit.",
  PAYLOAD_TOO_LARGE: "The server rejected this file because it is too large.",
  UNSUPPORTED_FILE_TYPE: "This file type is not supported.",
  INVALID_FILE_UPLOAD: "This file could not be uploaded. Check it and try again.",
  INVALID_UPLOAD: "This file could not be uploaded. Check it and try again.",
  UPLOAD_CANCELLED: "Upload cancelled.",
  FILES_RETRIEVAL_FAILED: "Your files could not be loaded.",
  SEARCH_FAILED: "Search could not be completed.",
  DELETE_FAILED: "The file could not be deleted.",
  DOWNLOAD_FAILED: "The download link could not be created.",
  PREVIEW_NOT_SUPPORTED: "A preview is not available for this file type. Use Download to save it.",
  SHARE_FAILED: "The share link could not be created.",
};

// A 404 only means "this file is gone" when the request was about one file.
const fileMessages: Record<string, string> = {
  NOT_FOUND: "That file is no longer available.",
};

export const userMessage = (error: unknown, fallback = "Something went wrong. Please try again."): string => {
  if (error instanceof ApiError) {
    return knownMessages[error.code] ?? fallback;
  }

  return fallback;
};

export const fileMessage = (error: unknown, fallback?: string): string => {
  if (error instanceof ApiError && fileMessages[error.code]) {
    return fileMessages[error.code]!;
  }

  return userMessage(error, fallback);
};
