import { apiClient } from "../../lib/api";
import { USE_MOCK_API } from "../../lib/runtime";
import { ApiError } from "../files/api/api-error";

export interface PasswordRecoveryService {
  requestReset(email: string): Promise<void>;
  resetPassword(token: string, newPassword: string): Promise<void>;
}

export const httpPasswordRecoveryService: PasswordRecoveryService = {
  async requestReset(email) {
    await apiClient.request<void>("/auth/forgot-password", {
      auth: "optional",
      method: "POST",
      body: JSON.stringify({ email }),
      allowEmptyData: true,
    });
  },
  async resetPassword(token, newPassword) {
    await apiClient.request<void>("/auth/reset-password", {
      auth: "optional",
      method: "POST",
      body: JSON.stringify({ token, newPassword }),
      allowEmptyData: true,
    });
  },
};

// This sample link exists only in demo mode; it never authorizes a real reset.
export const DEMO_RESET_TOKEN = "clouddrop-demo-reset";
let demoResetExpiresAt = 0;

export const mockPasswordRecoveryService: PasswordRecoveryService = {
  async requestReset() {
    demoResetExpiresAt = Date.now() + 30 * 60 * 1000;
  },
  async resetPassword(token) {
    if (token !== DEMO_RESET_TOKEN || Date.now() >= demoResetExpiresAt) {
      throw new ApiError({
        message: "Invalid or expired demo reset link.",
        code: "INVALID_OR_EXPIRED_RESET_TOKEN",
        status: 400,
      });
    }
    demoResetExpiresAt = 0;
  },
};

export const passwordRecoveryService = USE_MOCK_API
  ? mockPasswordRecoveryService
  : httpPasswordRecoveryService;
