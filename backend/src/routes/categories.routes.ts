import { Router } from "express";
import { listCategories } from "../controllers/categories.controller.js";
import { authMiddleware } from "../middleware/auth.middleware.js";
import { requireAuth } from "../middleware/require-auth.js";

const categoriesRoutes = Router();

categoriesRoutes.use(authMiddleware, requireAuth);
categoriesRoutes.get("/", listCategories);

export { categoriesRoutes };
