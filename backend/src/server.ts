import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { errorMiddleware } from "./middleware/error.middleware.js";
import { notFoundMiddleware } from "./middleware/not-found.middleware.js";

dotenv.config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
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

app.listen(PORT, () => {
  console.log(`CloudDrop API running on port ${PORT}`);
});


