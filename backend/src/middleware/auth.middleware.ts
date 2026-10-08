import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";

interface AuthRequest extends Request {
  userId?: string;
}

/**
 * JWT authentication middleware (Eunice).
 * Populates both `req.userId` (legacy) and `req.user.id` (typed Express extension)
 * so requireAuth and other consumers work consistently.
 */
export const authMiddleware = (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({
      success: false,
      message: "Authentication required",
      error: {
        code: "UNAUTHORIZED",
      },
    });
    return;
  }

  const token = authHeader.split(" ")[1];

  if (!token) {
    res.status(401).json({
      success: false,
      message: "Authentication required",
      error: {
        code: "UNAUTHORIZED",
      },
    });
    return;
  }

  const secret = process.env.JWT_SECRET;

  if (!secret) {
    res.status(500).json({
      success: false,
      message: "JWT secret is not configured",
      error: {
        code: "INTERNAL_SERVER_ERROR",
      },
    });
    return;
  }

  try {
    const decoded = jwt.verify(token, secret) as { userId: string };

    // Support both conventions used across the codebase
    req.userId = decoded.userId;
    req.user = { id: decoded.userId };

    next();
  } catch {
    res.status(401).json({
      success: false,
      message: "Invalid or expired token",
      error: {
        code: "UNAUTHORIZED",
      },
    });
  }
};
