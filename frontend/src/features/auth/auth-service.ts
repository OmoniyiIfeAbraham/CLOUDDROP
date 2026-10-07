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

export interface AuthService {
  login(credentials: Credentials): Promise<AuthResult>;
  register(details: Registration): Promise<AuthResult>;
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
    return apiClient.request<AuthResult>("/auth/register", {
      auth: "optional",
      method: "POST",
      body: JSON.stringify(details),
    });
  },
  async me() {
    const result = await apiClient.request<{ user: User }>("/auth/me");
    return result.user;
  },
};

const MOCK_USER_KEY = "clouddrop.demo-user";
const DEMO_TOKEN = "clouddrop-demo-session";
const demoUser: User = {
  id: "demo-user",
  firstName: "Michael",
  lastName: "Okafor",
  email: "demo@clouddrop.app",
};

export const mockAuthService: AuthService = {
  async login({ email, password }) {
    if (!email.trim() || !password.trim()) {
      throw new ApiError({ message: "Email and password are required.", code: "BAD_REQUEST", status: 400 });
    }
    const user = email === demoUser.email
      ? demoUser
      : { ...demoUser, email };
    sessionStorage.setItem(MOCK_USER_KEY, JSON.stringify(user));
    return { user, token: DEMO_TOKEN };
  },
  async register({ firstName, lastName, email, password }) {
    if (!firstName.trim() || !lastName.trim() || !email.trim() || !password.trim()) {
      throw new ApiError({ message: "All fields are required.", code: "BAD_REQUEST", status: 400 });
    }
    const user = { id: crypto.randomUUID(), firstName, lastName, email };
    sessionStorage.setItem(MOCK_USER_KEY, JSON.stringify(user));
    return { user, token: DEMO_TOKEN };
  },
  async me(token) {
    if (token !== DEMO_TOKEN) {
      throw new ApiError({ message: "Invalid session.", code: "UNAUTHORIZED", status: 401 });
    }
    const stored = sessionStorage.getItem(MOCK_USER_KEY);
    return stored ? JSON.parse(stored) as User : demoUser;
  },
};
