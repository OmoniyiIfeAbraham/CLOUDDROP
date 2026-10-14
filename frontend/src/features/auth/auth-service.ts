import { ApiError } from "../files/api/api-error";
import { apiClient } from "../../lib/api";

export interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
}

export interface Credentials {
  email: string;
  password: string;
}

export interface Registration extends Credentials {
  firstName: string;
  lastName: string;
}

export interface AuthResult {
  user: User;
  token: string;
}

export interface RegistrationResult {
  user: User;
}

export interface AuthService {
  login(credentials: Credentials): Promise<AuthResult>;
  register(details: Registration): Promise<RegistrationResult>;
  verifyEmail(email: string, code: string): Promise<AuthResult>;
  resendVerificationEmail(email: string): Promise<void>;
  me(token: string): Promise<User>;
}

export const httpAuthService: AuthService = {
  login(credentials) {
    return apiClient.request<AuthResult>("/auth/login", {
      auth: "optional",
      method: "POST",
      body: JSON.stringify(credentials),
    });
  },

  register(details) {
    return apiClient.request<RegistrationResult>("/auth/register", {
      auth: "optional",
      method: "POST",
      body: JSON.stringify(details),
    });
  },

  verifyEmail(email, code) {
    return apiClient.request<AuthResult>("/auth/verify-email", {
      auth: "optional",
      method: "POST",
      body: JSON.stringify({ email, code }),
    });
  },

  async resendVerificationEmail(email) {
    await apiClient.request<void>("/auth/resend-verification", {
      auth: "optional",
      method: "POST",
      body: JSON.stringify({ email }),
      allowEmptyData: true,
    });
  },

  async me() {
    const result = await apiClient.request<{ user: User }>("/auth/me");
    return result.user;
  },
};

const MOCK_USER_KEY = "clouddrop.demo-user";
const DEMO_TOKEN = "clouddrop-demo-session";
const DEMO_VERIFICATION_CODE = "123456";

const demoUser: User = {
  id: "demo-user",
  firstName: "Michael",
  lastName: "Okafor",
  email: "demo@clouddrop.app",
};

const demoAccounts = new Map<string, User>([[demoUser.email, demoUser]]);
const pendingVerifications = new Map<string, User>();

const normalizeEmail = (email: string): string => email.trim().toLowerCase();

export const mockAuthService: AuthService = {
  async login({ email, password }) {
    if (!email.trim() || !password.trim()) {
      throw new ApiError({
        message: "Email and password are required.",
        code: "BAD_REQUEST",
        status: 400,
      });
    }

    const normalizedEmail = normalizeEmail(email);
    const user = demoAccounts.get(normalizedEmail) ?? {
      ...demoUser,
      id: `demo-user:${normalizedEmail}`,
      email: normalizedEmail,
    };

    demoAccounts.set(normalizedEmail, user);
    sessionStorage.setItem(MOCK_USER_KEY, JSON.stringify(user));

    return { user, token: DEMO_TOKEN };
  },

  async register({ firstName, lastName, email, password }) {
    if (!firstName.trim() || !lastName.trim() || !email.trim() || !password.trim()) {
      throw new ApiError({
        message: "All fields are required.",
        code: "BAD_REQUEST",
        status: 400,
      });
    }

    const normalizedEmail = normalizeEmail(email);
    const user = {
      id: `demo-user:${normalizedEmail}`,
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: normalizedEmail,
    };

    pendingVerifications.set(normalizedEmail, user);

    return { user };
  },

  async verifyEmail(email, code) {
    const normalizedEmail = normalizeEmail(email);
    const user = pendingVerifications.get(normalizedEmail);

    if (!user || code !== DEMO_VERIFICATION_CODE) {
      throw new ApiError({
        message: "Invalid or expired verification code.",
        code: "INVALID_VERIFICATION_CODE",
        status: 400,
      });
    }

    pendingVerifications.delete(normalizedEmail);
    demoAccounts.set(normalizedEmail, user);
    sessionStorage.setItem(MOCK_USER_KEY, JSON.stringify(user));

    return { user, token: DEMO_TOKEN };
  },

  async resendVerificationEmail(email) {
    // Demo mode uses the fixed verification code shown on the page.
    // No email is sent.
    void email;
  },

  async me(token: string) {
    if (token !== DEMO_TOKEN) {
      throw new ApiError({
        message: "Your session has ended. Please sign in again.",
        code: "UNAUTHORIZED",
        status: 401,
      });
    }

    const stored = sessionStorage.getItem(MOCK_USER_KEY);
    return stored ? JSON.parse(stored) as User : demoUser;
  },
};
