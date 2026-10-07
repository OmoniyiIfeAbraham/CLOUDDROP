import { Link } from "react-router-dom";
import { ArrowLeft, CloudOff } from "lucide-react";

export const NotFoundPage = () => (
  <div className="not-found">
    <CloudOff size={44} />
    <h1>Page not found</h1>
    <p>This page may have moved or the link may be incorrect.</p>
    <Link className="button button--primary" to="/"><ArrowLeft size={17} /> Back to CloudDrop</Link>
  </div>
);
