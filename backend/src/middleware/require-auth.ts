import type { NextFunction, Request, Response } from "express";
import { sendError } from "../utils/response.utils.js";

/**
 * Ownership gate for file routes.
 * Eunice's JWT middleware should populate `req.user` before this runs.
 * This file does not issue or verify tokens.
 */
export const requireAuth = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  if (!req.user?.id) {
    return sendError(res, 401, "Authentication required", "UNAUTHORIZED");
  }

  return next();
};
