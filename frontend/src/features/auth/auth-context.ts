import { createContext, useContext } from "react";
import type { Credentials, Registration, User } from "./auth-service";

export interface AuthContextValue {
  user: User | null;
  status: "loading" | "authenticated" | "anonymous" | "restore-error";
  login: (credentials: Credentials) => Promise<void>;
  register: (details: Registration) => Promise<void>;
  logout: () => void;
  retryRestore: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export const useAuth = (): AuthContextValue => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider.");
  return context;
};
