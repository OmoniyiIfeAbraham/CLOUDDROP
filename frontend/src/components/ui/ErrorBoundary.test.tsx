import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ErrorBoundary } from "./ErrorBoundary";

const Broken = (): never => {
  throw new Error("render failed");
};

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("ErrorBoundary", () => {
  it("shows a recovery screen instead of a blank page", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    render(<ErrorBoundary><Broken /></ErrorBoundary>);

    expect(screen.getByRole("alert")).toHaveTextContent("Something went wrong");
    expect(screen.getByRole("button", { name: "Try again" })).toBeVisible();
  });

  it("renders its children when nothing fails", () => {
    render(<ErrorBoundary><p>Workspace</p></ErrorBoundary>);
    expect(screen.getByText("Workspace")).toBeVisible();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
