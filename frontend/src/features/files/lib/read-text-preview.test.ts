// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { MAX_TEXT_PREVIEW_BYTES, readTextPreview } from "./read-text-preview";

describe("bounded text preview", () => {
  it("decodes UTF-8 characters split across network chunks", async () => {
    const bytes = new TextEncoder().encode("Résumé 👋");
    const response = new Response(new ReadableStream({ start(controller) {
      for (const byte of bytes) controller.enqueue(Uint8Array.of(byte));
      controller.close();
    } }));
    expect(await readTextPreview(response)).toEqual({ text: "Résumé 👋", truncated: false });
  });

  it("cancels a large response after the preview limit without splitting a character", async () => {
    const cancel = vi.fn();
    const bytes = new TextEncoder().encode("a".repeat(MAX_TEXT_PREVIEW_BYTES - 1) + "é" + "rest");
    const response = new Response(new ReadableStream({ start(controller) { controller.enqueue(bytes); }, cancel }));
    const preview = await readTextPreview(response);
    expect(preview).toEqual({ text: "a".repeat(MAX_TEXT_PREVIEW_BYTES - 1), truncated: true });
    expect(cancel).toHaveBeenCalledOnce();
  });

  it("does not mark an exactly-at-limit file as truncated", async () => {
    const text = "x".repeat(MAX_TEXT_PREVIEW_BYTES);
    expect(await readTextPreview(new Response(text))).toEqual({ text, truncated: false });
  });
});
