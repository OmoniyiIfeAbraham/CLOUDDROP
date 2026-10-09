import "@testing-library/jest-dom/vitest";
import { configure } from "@testing-library/react";

// Role queries recompute styles from the full stylesheet in jsdom, so the first query
// in a file can exceed the 1 s default on a busy machine.
configure({ asyncUtilTimeout: 3000 });

if (!HTMLDialogElement.prototype.showModal) {
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute("open");
    this.dispatchEvent(new Event("close"));
  };
}
