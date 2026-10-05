export interface ApiSuccess<T> {
  success: true;
  message: string;
  data: T;
}

export interface ApiFailure {
  success: false;
  message: string;
  error: {
    code: string;
  };
}

export type ApiEnvelope<T> = ApiSuccess<T> | ApiFailure;

type UnknownRecord = Record<string, unknown>;

const isRecord = (value: unknown): value is UnknownRecord =>
  typeof value === "object" && value !== null;

export const isApiFailure = (value: unknown): value is ApiFailure => {
  if (!isRecord(value) || value.success !== false || typeof value.message !== "string") {
    return false;
  }

  return (
    isRecord(value.error) &&
    typeof value.error.code === "string"
  );
};

export const isApiSuccess = <T>(value: unknown): value is ApiSuccess<T> => {
  if (!isRecord(value) || value.success !== true || typeof value.message !== "string") {
    return false;
  }

  return "data" in value;
};

export const isSuccessEnvelope = (value: unknown): value is UnknownRecord =>
  isRecord(value) &&
  value.success === true &&
  typeof value.message === "string";
