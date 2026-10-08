import { describe, expect, it } from "vitest";
import { formatDuration } from "./format";

describe("formatDuration", () => {
  it("describes share lifetimes in hours or days", () => {
    expect(formatDuration(3600)).toBe("1 hour");
    expect(formatDuration(5 * 3600)).toBe("5 hours");
    expect(formatDuration(86_400)).toBe("1 day");
    expect(formatDuration(604_800)).toBe("7 days");
  });

  it("rounds a link that is about to expire up to one hour", () => {
    expect(formatDuration(90)).toBe("1 hour");
  });
});
