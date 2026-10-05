import { Router } from "express";
import { getDashboardStats } from "../controllers/dashboard.controller.js";
import { requireAuth } from "../middleware/require-auth.js";

const dashboardRoutes = Router();

dashboardRoutes.use(requireAuth);
dashboardRoutes.get("/stats", getDashboardStats);

export { dashboardRoutes };
