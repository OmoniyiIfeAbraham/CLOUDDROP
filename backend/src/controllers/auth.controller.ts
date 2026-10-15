import type { Request, Response } from "express";
import {
  registerUser,
  loginUser,
  getCurrentUser,
  verifyEmail as verifyEmailService,
  resendVerificationEmail,
  requestPasswordReset,
  resetPassword as resetPasswordService,
} from "../services/auth.service.js";
import { validateRequest } from "../utils/validation.utils.js";
import {
  registerSchema,
  loginSchema,
  verifyEmailSchema,
  resendVerificationSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from "../utils/auth.validation.js";

export const register = async (req: Request, res: Response) => {
  const { firstName, lastName, email, password } = validateRequest(
    registerSchema,
    req.body,
  );

  const result = await registerUser(
    firstName,
    lastName,
    email,
    password,
  );

  res.status(201).json({
    success: true,
    message: result.message,
    data: {
      user: result.user,
    },
  });
};

export const login = async (req: Request, res: Response) => {
  const { email, password } = validateRequest(
    loginSchema,
    req.body,
  );

  const result = await loginUser(email, password);

  res.status(200).json({
    success: true,
    message: "Login successful",
    data: result,
  });
};

export const verifyEmail = async (req: Request, res: Response) => {
  const { email, code } = validateRequest(
    verifyEmailSchema,
    req.body,
  );

  const result = await verifyEmailService(email, code);

  res.status(200).json({
    success: true,
    message: result.message,
    data: {
      user: result.user,
      token: result.token,
    },
  });
};

export const resendVerification = async (
  req: Request,
  res: Response,
) => {
  const { email } = validateRequest(
    resendVerificationSchema,
    req.body,
  );

  const result = await resendVerificationEmail(email);

  res.status(200).json({
    success: true,
    message: result.message,
  });
};

export const me = async (req: Request, res: Response) => {
  const userId = (req as Request & { userId?: string }).userId;

  if (!userId) {
    res.status(401).json({
      success: false,
      message: "Authentication required",
      error: {
        code: "UNAUTHORIZED",
      },
    });
    return;
  }

  const user = await getCurrentUser(userId);

  res.status(200).json({
    success: true,
    message: "User retrieved successfully",
    data: {
      user,
    },
  });
};


export const forgotPassword = async (req: Request, res: Response) => {
  const { email } = validateRequest(forgotPasswordSchema, req.body);
  const result = await requestPasswordReset(email);

  res.status(200).json({
    success: true,
    message: result.message,
  });
};

export const resetPassword = async (req: Request, res: Response) => {
  const { token, newPassword } = validateRequest(
    resetPasswordSchema,
    req.body,
  );

  const result = await resetPasswordService(token, newPassword);

  res.status(200).json({
    success: true,
    message: result.message,
  });
};
