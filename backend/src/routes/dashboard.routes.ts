import { Router } from "express";
import { getDashboardStats } from "../controllers/dashboard.controller.js";
import { authMiddleware } from "../middleware/auth.middleware.js";
import { requireAuth } from "../middleware/require-auth.js";

const dashboardRoutes = Router();

dashboardRoutes.use(authMiddleware, requireAuth);
dashboardRoutes.get("/stats", getDashboardStats);

export { dashboardRoutes };
