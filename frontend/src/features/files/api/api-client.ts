import {
  isApiFailure,
  isApiSuccess,
  isSuccessEnvelope,
} from "./contracts";
import { ApiError } from "./api-error";

export type TokenGetter = () => string | null | Promise<string | null>;

export type HttpMethod = "DELETE" | "GET" | "PATCH" | "POST" | "PUT";

export interface FetchRequestInit {
  method?: HttpMethod;
  headers?: Record<string, string>;
  body?: string;
}

export interface FetchResponse {
  ok: boolean;
  status: number;
  text: () => Promise<string>;
}

export type FetchImplementation = (
  input: string,
  init?: FetchRequestInit,
) => Promise<FetchResponse>;

export interface ApiClientOptions {
  baseUrl: string;
  getToken: TokenGetter;
  fetchImpl?: FetchImplementation;
  onUnauthorized?: (token: string) => void;
}

export interface ApiClientRequestOptions {
  method?: HttpMethod;
  auth?: "optional" | "required";
  query?: Record<string, boolean | number | string | null | undefined>;
  headers?: Record<string, string>;
  body?: string;
  allowEmptyData?: boolean;
}

export interface ApiClient {
  request<T>(
    path: string,
    options?: ApiClientRequestOptions,
  ): Promise<T>;
}

const globalFetch = (): FetchImplementation | undefined =>
  (globalThis as unknown as { fetch?: FetchImplementation }).fetch;

const isRetryableStatus = (status: number): boolean =>
  status === 429 || status >= 500;

const buildUrl = (
  baseUrl: string,
  path: string,
  query: ApiClientRequestOptions["query"],
): string => {
  const normalizedBaseUrl = baseUrl.replace(/\/+$/, "");
  const normalizedPath = path.startsWith("/") ? path : "/" + path;
  const parameters = new URLSearchParams();

  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined && value !== null) {
      parameters.set(key, String(value));
    }
  }

  const queryString = parameters.toString();
  const url = normalizedBaseUrl + normalizedPath;

  return queryString ? url + "?" + queryString : url;
};

const parseResponseBody = (body: string, status: number): unknown => {
  if (!body.trim()) {
    return undefined;
  }

  try {
    return JSON.parse(body) as unknown;
  } catch {
    if (status === 401) return undefined;
    throw new ApiError({
      message: "The API returned an invalid response.",
      code: status >= 400 ? "HTTP_ERROR" : "INVALID_RESPONSE",
      status,
      retryable: isRetryableStatus(status),
    });
  }
};

export const createApiClient = (options: ApiClientOptions): ApiClient => {
  const fetchImpl = options.fetchImpl ?? globalFetch();

  if (!fetchImpl) {
    throw new Error("A fetch implementation is required.");
  }

  return {
    async request<T>(
      path: string,
      requestOptions: ApiClientRequestOptions = {},
    ): Promise<T> {
      const auth = requestOptions.auth ?? "required";
      const token = await options.getToken();

      if (auth === "required" && !token) {
        throw new ApiError({
          message: "Authentication is required.",
          code: "UNAUTHORIZED",
          status: 401,
        });
      }

      const headers: Record<string, string> = {
        Accept: "application/json",
        ...requestOptions.headers,
      };

      if (token) {
        headers.Authorization = "Bearer " + token;
      }

      if (requestOptions.body && !headers["Content-Type"]) {
        headers["Content-Type"] = "application/json";
      }

      let response: FetchResponse;

      try {
        const fetchOptions: FetchRequestInit = {
          method: requestOptions.method ?? "GET",
          headers,
        };

        if (requestOptions.body !== undefined) {
          fetchOptions.body = requestOptions.body;
        }

        response = await fetchImpl(
          buildUrl(options.baseUrl, path, requestOptions.query),
          fetchOptions,
        );
      } catch (error) {
        if (error instanceof ApiError) {
          throw error;
        }

        throw new ApiError({
          message: "The network request failed.",
          code: "NETWORK_ERROR",
          retryable: true,
        });
      }

      let rawBody: string;

      try {
        rawBody = await response.text();
      } catch {
        if (response.status === 401) {
          if (auth === "required" && token) options.onUnauthorized?.(token);
          throw new ApiError({
            message: "Authentication is required.",
            code: "UNAUTHORIZED",
            status: 401,
          });
        }
        throw new ApiError({
          message: "The API response could not be read.",
          code: "INVALID_RESPONSE",
          status: response.status,
          retryable: isRetryableStatus(response.status),
        });
      }

      const payload = parseResponseBody(rawBody, response.status);

      if (!response.ok) {
        if (response.status === 401) {
          if (auth === "required" && token) options.onUnauthorized?.(token);
          throw new ApiError({
            message: isApiFailure(payload) ? payload.message : "Authentication is required.",
            code: "UNAUTHORIZED",
            status: 401,
          });
        }

        if (isApiFailure(payload)) {
          throw new ApiError({
            message: payload.message,
            code: payload.error.code,
            status: response.status,
            retryable: isRetryableStatus(response.status),
          });
        }

        throw new ApiError({
          message: "The API request failed.",
          code: "HTTP_ERROR",
          status: response.status,
          retryable: isRetryableStatus(response.status),
        });
      }

      if (isApiFailure(payload)) {
        throw new ApiError({
          message: payload.message,
          code: payload.error.code,
          status: response.status,
          retryable: isRetryableStatus(response.status),
        });
      }

      if (isApiSuccess<T>(payload)) {
        return payload.data;
      }

      if (requestOptions.allowEmptyData && isSuccessEnvelope(payload)) {
        return undefined as T;
      }

      throw new ApiError({
        message: "The API returned an invalid response.",
        code: "INVALID_RESPONSE",
        status: response.status,
        retryable: false,
      });
    },
  };
};
