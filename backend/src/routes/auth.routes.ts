import { Router } from "express";
import {
  register,
  login,
  me,
  verifyEmail,
  resendVerification,
} from "../controllers/auth.controller.js";
import { authMiddleware } from "../middleware/auth.middleware.js";

const router = Router();

router.post("/register", register);
router.post("/verify-email", verifyEmail);
router.post("/resend-verification", resendVerification);
router.post("/login", login);
router.get("/me", authMiddleware, me);

export default router;
