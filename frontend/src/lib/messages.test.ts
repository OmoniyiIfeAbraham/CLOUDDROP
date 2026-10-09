import { describe, expect, it } from "vitest";
import { ApiError } from "../features/files/api/api-error";
import { fileMessage, userMessage } from "./messages";

const notFound = new ApiError({ message: "Route not found", code: "NOT_FOUND", status: 404 });

describe("user-facing error messages", () => {
  it("only calls a 404 a missing file when the request was about a file", () => {
    expect(userMessage(notFound, "Your files could not be loaded.")).toBe("Your files could not be loaded.");
    expect(fileMessage(notFound, "The share link could not be created.")).toBe("That file is no longer available.");
  });

  it("falls back to shared messages and the caller's fallback", () => {
    const network = new ApiError({ message: "Offline", code: "NETWORK_ERROR", retryable: true });
    expect(fileMessage(network, "Could not delete.")).toBe("Could not connect. Check your connection and try again.");
    expect(fileMessage(new Error("boom"), "Could not delete.")).toBe("Could not delete.");
    expect(userMessage(new ApiError({ message: "Too large", code: "PAYLOAD_TOO_LARGE", status: 413 })))
      .toBe("The server rejected this file because it is too large.");
    expect(userMessage(new ApiError({ message: "Invalid email or password", code: "INVALID_CREDENTIALS", status: 401 })))
      .toBe("Incorrect email or password.");
    expect(userMessage(new ApiError({ message: "Email already registered", code: "EMAIL_ALREADY_REGISTERED", status: 409 })))
      .toBe("An account with this email already exists. Sign in instead.");
    expect(userMessage(new ApiError({ message: "Boom", code: "INTERNAL_SERVER_ERROR", status: 500 })))
      .toBe("Something went wrong. Please try again.");
  });
});
