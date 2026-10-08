import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { errorMiddleware } from "./middleware/error.middleware.js";
import { notFoundMiddleware } from "./middleware/not-found.middleware.js";
import { validateEnv } from "./utils/env.utils.js";
import morgan from "morgan";
import authRoutes from "./routes/auth.routes.js";
import { filesRoutes } from "./routes/files.routes.js";
import { categoriesRoutes } from "./routes/categories.routes.js";
import { dashboardRoutes } from "./routes/dashboard.routes.js";

dotenv.config();

validateEnv();

const app = express();

app.use(cors());
app.use(morgan("dev"));
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({
    success: true,
    message: "CloudDrop API is running",
  });
});

// Auth (Eunice) — register / login / me
app.use("/api/v1/auth", authRoutes);

// File domain (stubbed for Phase 2) — requires auth via requireAuth
app.use("/api/v1/files", filesRoutes);

// Categories & dashboard
app.use("/api/v1/categories", categoriesRoutes);
app.use("/api/v1/dashboard", dashboardRoutes);

app.use(notFoundMiddleware);
app.use(errorMiddleware);

const PORT = process.env.PORT || 5000;

if (process.env.NODE_ENV !== "test") {
  app.listen(PORT, () => {
    console.log(`CloudDrop API running on port ${PORT}`);
  });
}

export default app;
