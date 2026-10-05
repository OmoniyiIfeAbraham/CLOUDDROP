import type { NextFunction, Request, Response } from "express";
import { ApiError } from "../utils/api-error.js";

const phaseTwo = (feature: string): never => {
  throw new ApiError(
    501,
    `${feature} will be implemented in Phase 2`,
    "NOT_IMPLEMENTED"
  );
};

export const uploadFile = async (
  _req: Request,
  _res: Response,
  next: NextFunction
) => {
  try {
    phaseTwo("File upload");
  } catch (error) {
    next(error);
  }
};

export const listFiles = async (
  _req: Request,
  _res: Response,
  next: NextFunction
) => {
  try {
    phaseTwo("List files");
  } catch (error) {
    next(error);
  }
};

export const getFile = async (
  _req: Request,
  _res: Response,
  next: NextFunction
) => {
  try {
    phaseTwo("Get file details");
  } catch (error) {
    next(error);
  }
};

export const downloadFile = async (
  _req: Request,
  _res: Response,
  next: NextFunction
) => {
  try {
    phaseTwo("File download");
  } catch (error) {
    next(error);
  }
};

export const deleteFile = async (
  _req: Request,
  _res: Response,
  next: NextFunction
) => {
  try {
    phaseTwo("File delete");
  } catch (error) {
    next(error);
  }
};

export const createShare = async (
  _req: Request,
  _res: Response,
  next: NextFunction
) => {
  try {
    phaseTwo("Temporary file sharing");
  } catch (error) {
    next(error);
  }
};
