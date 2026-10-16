import { useEffect, useState } from "react";
import { readTextPreview } from "../lib/read-text-preview";

export const TextPreview = ({ url, filename, onError }: { url: string; filename: string; onError: () => void }) => {
  const [preview, setPreview] = useState<{ text: string; truncated: boolean } | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    void fetch(url, {
      signal: controller.signal,
      credentials: "omit",
      referrerPolicy: "no-referrer",
    }).then(readTextPreview).then((result) => {
      if (active) setPreview(result);
    }).catch(() => {
      if (active) onError();
    });
    return () => { active = false; controller.abort(); };
  }, [url, onError]);

  if (!preview) return <p className="dialog__intro" role="status">Loading text preview...</p>;
  return <div className="text-preview">
    {preview.truncated && <p className="dialog__intro" role="status">Showing the first 1 MB. Download the file to read the rest.</p>}
    <pre className="text-preview__content" role="region" aria-label={`Preview of ${filename}`} tabIndex={0}>{preview.text || "This file is empty."}</pre>
  </div>;
};
