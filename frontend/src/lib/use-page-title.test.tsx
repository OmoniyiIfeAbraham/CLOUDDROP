import { renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { usePageTitle } from "./use-page-title";

afterEach(() => {
  document.title = "";
});

describe("usePageTitle", () => {
  it("names the tab after the page and restores the previous title when the page closes", () => {
    document.title = "CloudDrop";
    const { rerender, unmount } = renderHook(({ title }: { title: string | undefined }) => usePageTitle(title), {
      initialProps: { title: "My files" },
    });
    expect(document.title).toBe("My files · CloudDrop");

    rerender({ title: "Upload" });
    expect(document.title).toBe("Upload · CloudDrop");

    unmount();
    expect(document.title).toBe("CloudDrop");
  });

  it("leaves the title alone until a title is known", () => {
    document.title = "My files · CloudDrop";
    renderHook(() => usePageTitle(undefined));
    expect(document.title).toBe("My files · CloudDrop");
  });
});
