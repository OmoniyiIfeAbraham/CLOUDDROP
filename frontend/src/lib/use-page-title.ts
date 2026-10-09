import { useEffect } from "react";

const APP_NAME = "CloudDrop";

// Names the browser tab after the current page and restores the previous title when the page closes.
export const usePageTitle = (title: string | undefined) => {
  useEffect(() => {
    if (!title) return;
    const previous = document.title;
    document.title = `${title} · ${APP_NAME}`;
    return () => {
      document.title = previous;
    };
  }, [title]);
};
