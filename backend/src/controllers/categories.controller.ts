import type { Request, Response } from "express";
import { CATEGORIES } from "../lib/category.js";
import { sendSuccess } from "../utils/response.utils.js";

export const listCategories = (_req: Request, res: Response) => {
  return sendSuccess(res, "Categories retrieved", {
    categories: [...CATEGORIES],
  });
};
