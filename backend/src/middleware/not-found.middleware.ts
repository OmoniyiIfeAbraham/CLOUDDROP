import type { Request, Response } from "express";

export const notFoundMiddleware = (
  _req: Request,
  res: Response
) => {
  res.status(404).json({
    success: false,
    message: "Route not found",
    error: {
      code: "NOT_FOUND",
    },
  });
};
