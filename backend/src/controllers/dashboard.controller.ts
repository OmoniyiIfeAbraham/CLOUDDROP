import type { NextFunction, Request, Response } from "express";
import { ApiError } from "../utils/api-error.js";
import { sendSuccess } from "../utils/response.utils.js";
import { getDashboardStats as fetchDashboardStats } from "../services/dashboard.service.js";

const getUserId = (req: Request): string => {
  const userId =
    req.user?.id ?? (req as Request & { userId?: string }).userId;

  if (!userId) {
    throw new ApiError(401, "Authentication required", "UNAUTHORIZED");
  }

  return userId;
};

export const getDashboardStats = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = getUserId(req);

    const stats = await fetchDashboardStats(userId);

    return sendSuccess(
      res,
      "Dashboard stats retrieved successfully",
      stats
    );
  } catch (error) {
    next(error);
  }
};