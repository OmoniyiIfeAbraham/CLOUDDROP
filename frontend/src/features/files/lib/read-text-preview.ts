export const MAX_TEXT_PREVIEW_BYTES = 1024 * 1024;

// Read a bounded prefix so a large file cannot fill the preview's memory.
export const readTextPreview = async (response: Response): Promise<{ text: string; truncated: boolean }> => {
  if (!response.ok || !response.body) throw new Error("Preview unavailable");
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let text = "";
  let bytes = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) return { text: text + decoder.decode(), truncated: false };
      const remaining = MAX_TEXT_PREVIEW_BYTES - bytes;
      if (value.byteLength > remaining) {
        // Do not flush an incomplete UTF-8 character at the boundary.
        text += decoder.decode(value.subarray(0, remaining), { stream: true });
        return { text, truncated: true };
      }
      text += decoder.decode(value, { stream: true });
      bytes += value.byteLength;
    }
  } finally {
    await reader.cancel();
    reader.releaseLock();
  }
};
