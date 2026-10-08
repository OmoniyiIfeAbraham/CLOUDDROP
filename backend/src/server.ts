import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { errorMiddleware } from "./middleware/error.middleware.js";
import { notFoundMiddleware } from "./middleware/not-found.middleware.js";
import { validateEnv } from "./utils/env.utils.js";
import morgan from "morgan";
import authRoutes from "./routes/auth.routes.js";

dotenv.config();

validateEnv();

const app = express();

// Middleware
app.use(cors());
app.use(morgan("dev"));
app.use(express.json());

// Auth routes
app.use("/api/v1/auth", authRoutes);

app.use("/api/v1", (_req, _res, next) => {
  next();
});

// Health check
app.get("/health", (_req, res) => {
  res.json({
    success: true,
    message: "CloudDrop API is running",
  });
});

const PORT = process.env.PORT || 5000;

app.use(errorMiddleware);
app.use(notFoundMiddleware);

if (process.env.NODE_ENV !== "test") {
  app.listen(PORT, () => {
    console.log(`CloudDrop API running on port ${PORT}`);
  });
}

export default app;
