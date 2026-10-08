import { Router } from "express";
import { listCategories } from "../controllers/categories.controller.js";

const categoriesRoutes = Router();

categoriesRoutes.get("/", listCategories);

export { categoriesRoutes };
