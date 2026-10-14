import { createContext, useContext } from "react";
import type {
  Credentials,
  Registration,
  RegistrationResult,
  User,
} from "./auth-service";

export interface AuthContextValue {
  user: User | null;
  status: "loading" | "authenticated" | "anonymous" | "restore-error";
  login: (credentials: Credentials) => Promise<void>;
  register: (details: Registration) => Promise<RegistrationResult>;
  verifyEmail: (email: string, code: string) => Promise<void>;
  resendVerificationEmail: (email: string) => Promise<void>;
  logout: () => void;
  retryRestore: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | undefined>(
  undefined,
);

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }

  return context;
}
