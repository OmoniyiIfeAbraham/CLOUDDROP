import { Router } from "express";
import {
  createShare,
  deleteFile,
  downloadFile,
  getFile,
  listFiles,
  uploadFile,
} from "../controllers/files.controller.js";
import { requireAuth } from "../middleware/require-auth.js";

const filesRoutes = Router();

filesRoutes.use(requireAuth);

filesRoutes.post("/", uploadFile);
filesRoutes.get("/", listFiles);
filesRoutes.get("/:id", getFile);
filesRoutes.get("/:id/download", downloadFile);
filesRoutes.delete("/:id", deleteFile);
filesRoutes.post("/:id/share", createShare);

export { filesRoutes };
