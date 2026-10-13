import { useState } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { Dialog } from "./Dialog";

afterEach(cleanup);
const Review = ({ disableInvoker = false, removeInvoker = false }) => {
  const [open, setOpen] = useState(false);
  const [removed, setRemoved] = useState(false);
  const [trigger, setTrigger] = useState<HTMLElement | null>(null);
  return <main tabIndex={-1} aria-label="Files">
    {!removed && <button disabled={open && disableInvoker} onClick={(event) => { setTrigger(event.currentTarget); setOpen(true); }}>Review file</button>}
    <Dialog title="Review" open={open} returnFocusTo={trigger} onClose={() => { setOpen(false); if (removeInvoker) setRemoved(true); }}><p>File details</p></Dialog>
  </main>;
};

describe("dialog focus restoration", () => {
  it("returns focus to an invoking control even when activation did not focus it", () => {
    render(<Review />);
    const button = screen.getByRole("button", { name: "Review file" });
    expect(button).not.toHaveFocus();
    fireEvent.click(button);
    fireEvent.click(screen.getByRole("button", { name: "Close dialog" }));
    expect(button).toHaveFocus();
  });
  it("restores a control disabled while the dialog was preparing", () => {
    render(<Review disableInvoker />);
    const button = screen.getByRole("button", { name: "Review file" });
    fireEvent.click(button);
    expect(button).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Close dialog" }));
    expect(button).toBeEnabled(); expect(button).toHaveFocus();
  });
  it("focuses the workspace when a completed action removes its invoking control", () => {
    render(<Review removeInvoker />);
    fireEvent.click(screen.getByRole("button", { name: "Review file" }));
    fireEvent.click(screen.getByRole("button", { name: "Close dialog" }));
    expect(screen.getByRole("main", { name: "Files" })).toHaveFocus();
  });
});
