import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { getTokenVersionForAuth } from "../services/auth.service.js";

interface AuthRequest extends Request {
  userId?: string;
}

const unauthorized = (res: Response, message: string) => {
  res.status(401).json({
    success: false,
    message,
    error: { code: "UNAUTHORIZED" },
  });
};

/**
 * Verifies the JWT and checks its session version against the database.
 * Older tokens without a tokenVersion claim are treated as version 0.
 */
export const authMiddleware = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    unauthorized(res, "Authentication required");
    return;
  }

  const token = authHeader.slice("Bearer ".length).trim();

  if (!token) {
    unauthorized(res, "Authentication required");
    return;
  }

  const secret = process.env.JWT_SECRET;

  if (!secret) {
    res.status(500).json({
      success: false,
      message: "JWT secret is not configured",
      error: { code: "INTERNAL_SERVER_ERROR" },
    });
    return;
  }

  let userId: string;
  let tokenVersion: number;

  try {
    const decoded = jwt.verify(token, secret);

    if (
      typeof decoded !== "object" ||
      decoded === null ||
      typeof decoded.userId !== "string" ||
      decoded.userId.length === 0
    ) {
      unauthorized(res, "Invalid or expired token");
      return;
    }

    userId = decoded.userId;
    tokenVersion = decoded.tokenVersion === undefined
      ? 0
      : decoded.tokenVersion;

    if (!Number.isSafeInteger(tokenVersion) || tokenVersion < 0) {
      unauthorized(res, "Invalid or expired token");
      return;
    }
  } catch {
    unauthorized(res, "Invalid or expired token");
    return;
  }

  try {
    const currentVersion = await getTokenVersionForAuth(userId);

    if (currentVersion === null || currentVersion !== tokenVersion) {
      unauthorized(res, "Invalid or expired token");
      return;
    }

    req.userId = userId;
    req.user = { id: userId };
    next();
  } catch (error) {
    console.error("Authentication session lookup failed:", error);
    res.status(500).json({
      success: false,
      message: "Unable to verify authentication",
      error: { code: "INTERNAL_SERVER_ERROR" },
    });
  }
};
