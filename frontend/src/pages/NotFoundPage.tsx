import { Link } from "react-router-dom";
import { ArrowLeft, CloudOff } from "lucide-react";
import { usePageTitle } from "../lib/use-page-title";
import { useEffect, useRef } from "react";

export const NotFoundPage = () => {
  usePageTitle("Page not found");
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { heading.current?.focus(); }, []);
  return (
    <main className="not-found" aria-labelledby="not-found-heading">
      <CloudOff size={44} />
      <h1 id="not-found-heading" ref={heading} tabIndex={-1}>Page not found</h1>
      <p>This page may have moved or the link may be incorrect.</p>
      <Link className="button button--primary" to="/"><ArrowLeft size={17} /> Back to CloudDrop</Link>
    </main>
  );
};
