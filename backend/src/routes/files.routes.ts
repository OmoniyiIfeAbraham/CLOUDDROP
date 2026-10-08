import { Router } from "express";
import {
  createShare,
  deleteFile,
  downloadFile,
  getFile,
  listFiles,
  uploadFile,
} from "../controllers/files.controller.js";
import { authMiddleware } from "../middleware/auth.middleware.js";
import { requireAuth } from "../middleware/require-auth.js";
import { upload } from "../middleware/upload.middleware.js";

const filesRoutes = Router();

// JWT verification + user population, then presence gate
filesRoutes.use(authMiddleware, requireAuth);

filesRoutes.post("/", upload.single("file"), uploadFile);
filesRoutes.get("/", listFiles);
filesRoutes.get("/:id", getFile);
filesRoutes.get("/:id/download", downloadFile);
filesRoutes.delete("/:id", deleteFile);
filesRoutes.post("/:id/share", createShare);

export { filesRoutes };
