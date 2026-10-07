export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "/api/v1";
export const USE_MOCK_API = import.meta.env.VITE_USE_MOCK_API === "true";

const TOKEN_KEY = "clouddrop.access-token";

export const sessionToken = {
  get(): string | null {
    return sessionStorage.getItem(TOKEN_KEY);
  },
  set(token: string): void {
    sessionStorage.setItem(TOKEN_KEY, token);
  },
  clear(): void {
    sessionStorage.removeItem(TOKEN_KEY);
  },
};
