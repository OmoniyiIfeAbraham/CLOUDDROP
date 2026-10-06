import type { NextFunction, Request, Response } from "express";
import { ApiError } from "../utils/api-error.js";

export const getDashboardStats = async (
  _req: Request,
  _res: Response,
  next: NextFunction
) => {
  try {
    throw new ApiError(
      501,
      "Dashboard stats will be implemented in Phase 3",
      "NOT_IMPLEMENTED"
    );
  } catch (error) {
    next(error);
  }
};
