import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { SESSION_EXPIRED_EVENT } from "../../lib/api";
import { sessionToken, USE_MOCK_API } from "../../lib/runtime";
import { httpAuthService, mockAuthService } from "./auth-service";
import type { AuthResult, Credentials, Registration, User } from "./auth-service";
import { AuthContext } from "./auth-context";
import type { AuthContextValue } from "./auth-context";
import { isApiError } from "../files/api/api-error";
const service = USE_MOCK_API ? mockAuthService : httpAuthService;

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const queryClient = useQueryClient();
  const [user, setUser] = useState<User | null>(null);
  const [status, setStatus] = useState<AuthContextValue["status"]>("loading");
  const sessionVersion = useRef(0);

  const logout = useCallback(() => {
    sessionVersion.current += 1;
    sessionToken.clear();
    queryClient.clear();
    setUser(null);
    setStatus("anonymous");
  }, [queryClient]);

  const retryRestore = useCallback(async () => {
    const token = sessionToken.get();
    if (!token) {
      setStatus("anonymous");
      return;
    }
    const version = ++sessionVersion.current;
    setStatus("loading");
    try {
      const currentUser = await service.me(token);
      if (version === sessionVersion.current) {
        setUser(currentUser);
        setStatus("authenticated");
      }
    } catch (error) {
      if (version !== sessionVersion.current) return;
      if (isApiError(error) && (error.code === "UNAUTHORIZED" || error.status === 401)) {
        logout();
      } else {
        setStatus("restore-error");
      }
    }
  }, [logout]);

  useEffect(() => {
    let active = true;
    const token = sessionToken.get();
    if (!token) {
      queueMicrotask(() => {
        if (active) setStatus("anonymous");
      });
    } else {
      queueMicrotask(() => {
        if (active) void retryRestore();
      });
    }

    window.addEventListener(SESSION_EXPIRED_EVENT, logout);
    return () => {
      active = false;
      sessionVersion.current += 1;
      window.removeEventListener(SESSION_EXPIRED_EVENT, logout);
    };
  }, [logout, retryRestore]);

  const acceptSession = useCallback((result: AuthResult) => {
    sessionVersion.current += 1;
    queryClient.clear();
    sessionToken.set(result.token);
    setUser(result.user);
    setStatus("authenticated");
  }, [queryClient]);

  const login = useCallback(async (credentials: Credentials) => {
    acceptSession(await service.login(credentials));
  }, [acceptSession]);

  const register = useCallback(async (details: Registration) => {
    acceptSession(await service.register(details));
  }, [acceptSession]);

  const value = useMemo(() => ({ user, status, login, register, logout, retryRestore }), [user, status, login, register, logout, retryRestore]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
