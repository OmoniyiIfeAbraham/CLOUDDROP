import type { NextFunction, Request, Response } from "express";
import { sendError } from "../utils/response.utils.js";

/**
 * Ownership / presence gate for protected routes.
 * Expects JWT authMiddleware (or equivalent) to have already run and
 * populated either `req.user.id` or `req.userId`.
 * This middleware does not itself verify tokens.
 */
export const requireAuth = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const userId =
    req.user?.id ?? (req as Request & { userId?: string }).userId;

  if (!userId) {
    return sendError(res, 401, "Authentication required", "UNAUTHORIZED");
  }

  // Normalise so downstream code can reliably use either shape
  if (!req.user) {
    req.user = { id: userId };
  }
  (req as Request & { userId?: string }).userId = userId;

  return next();
};
