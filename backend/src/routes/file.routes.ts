import { Router } from "express";
import {
  getFiles,
  searchFiles,
  getFile,
  removeFile,
} from "../controllers/file.controller.js";
import { uploadFile } from "../controllers/upload.controller.js";
import { downloadFile } from "../controllers/download.controller.js";
import { shareFile } from "../controllers/share.controller.js";
import { authMiddleware } from "../middleware/auth.middleware.js";
import { upload } from "../middleware/upload.middleware.js";

const router = Router();

router.get("/", authMiddleware, getFiles);
router.get("/search", authMiddleware, searchFiles);

router.post(
  "/upload",
  authMiddleware,
  upload.single("file"),
  uploadFile,
);

router.get(
  "/:id/download",
  authMiddleware,
  downloadFile,
);

router.get(
  "/:id/share",
  authMiddleware,
  shareFile,
);

router.get("/:id", authMiddleware, getFile);
router.delete("/:id", authMiddleware, removeFile);

export default router;
