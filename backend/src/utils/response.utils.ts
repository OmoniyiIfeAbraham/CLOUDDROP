import type { Response } from "express";

export const sendSuccess = (
  res: Response,
  message: string,
  data: unknown = {}
) => {
  return res.status(200).json({
    success: true,
    message,
    data,
  });
};

export const sendError = (
  res: Response,
  statusCode: number,
  message: string,
  code: string
) => {
  return res.status(statusCode).json({
    success: false,
    message,
    error: {
      code,
    },
  });
};
