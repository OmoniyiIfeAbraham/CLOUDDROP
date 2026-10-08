import type { Request, Response } from "express";
import {
  registerUser,
  loginUser,
  getCurrentUser,
} from "../services/auth.service.js";

export const register = async (req: Request, res: Response) => {
  const { firstName, lastName, email, password } = req.body;

  const result = await registerUser(
    firstName,
    lastName,
    email,
    password,
  );

  res.status(201).json({
    success: true,
    message: "Registration successful",
    data: result,
  });
};

export const login = async (req: Request, res: Response) => {
  const { email, password } = req.body;

  const result = await loginUser(email, password);

  res.status(200).json({
    success: true,
    message: "Login successful",
    data: result,
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
