import { createApiClient } from "../features/files/api/api-client";
import { API_BASE_URL, sessionToken } from "./runtime";

export const SESSION_EXPIRED_EVENT = "clouddrop:session-expired";

export const apiClient = createApiClient({
  baseUrl: API_BASE_URL,
  getToken: () => sessionToken.get(),
  onUnauthorized: () => {
    sessionToken.clear();
    window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
  },
});
