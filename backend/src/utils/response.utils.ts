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