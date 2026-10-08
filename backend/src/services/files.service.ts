import { ApiError } from "../utils/api-error.js";

export const assertFileOwner = (fileUserId: string, requesterId: string): void => {
  if (fileUserId !== requesterId) {
    throw new ApiError(
      403,
      "You do not have access to this file",
      "FORBIDDEN"
    );
  }
};

export const getRequesterId = (userId: string | undefined): string => {
  if (!userId) {
    throw new ApiError(401, "Authentication required", "UNAUTHORIZED");
  }
  return userId;
};
