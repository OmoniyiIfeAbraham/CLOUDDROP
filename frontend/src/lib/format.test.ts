import { describe, expect, it } from "vitest";
import { formatDuration } from "./format";

describe("formatDuration", () => {
  it("describes share lifetimes in hours or days", () => {
    expect(formatDuration(3600)).toBe("1 hour");
    expect(formatDuration(5 * 3600)).toBe("5 hours");
    expect(formatDuration(86_400)).toBe("1 day");
    expect(formatDuration(604_800)).toBe("7 days");
  });

  it("uses seconds or minutes for a short remaining lifetime", () => {
    expect(formatDuration(1)).toBe("1 second");
    expect(formatDuration(59.9)).toBe("1 minute");
    expect(formatDuration(90)).toBe("2 minutes");
    expect(formatDuration(180)).toBe("3 minutes");
  });

  it("keeps selected sharing durations readable near their creation boundary", () => {
    expect(formatDuration(3599)).toBe("1 hour");
    expect(formatDuration(86399)).toBe("1 day");
    expect(formatDuration(604799)).toBe("7 days");
  });
});
