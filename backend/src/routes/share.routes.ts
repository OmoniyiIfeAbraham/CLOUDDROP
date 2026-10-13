import { Router } from "express";
import rateLimit from "express-rate-limit";
import { getPublicShareDownload } from "../controllers/files.controller.js";

const shareRoutes = Router();

const shareRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many share-link requests. Please try again later.",
  },
});

shareRoutes.get("/:token", shareRateLimiter, getPublicShareDownload);

export default shareRoutes;
