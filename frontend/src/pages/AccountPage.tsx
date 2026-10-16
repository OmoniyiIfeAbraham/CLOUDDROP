import { useId, useState } from "react";
import type { MouseEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Trash2 } from "lucide-react";
import { Dialog } from "../components/ui/Dialog";
import { useAuth } from "../features/auth/auth-context";
import { useFilesRepository } from "../features/files/api/files-context";
import { useUploadQueue } from "../features/upload/upload-queue-context";
import { userMessage } from "../lib/messages";

const CONFIRMATION_WORD = "DELETE";

const deletionSummary = (totalFiles: number | undefined): string => {
  if (totalFiles === undefined) return "This permanently deletes your account, all of your files and any share links you have created.";
  if (totalFiles === 0) return "This permanently deletes your account. You have no stored files.";
  const files = totalFiles === 1 ? "your 1 file" : `all ${totalFiles} of your files`;
  return `This permanently deletes your account, ${files} and any share links you have created. People with those links will lose access.`;
};

export const AccountPage = () => {
  const { user, deleteAccount } = useAuth();
  const repository = useFilesRepository();
  const { uploading } = useUploadQueue();
  const navigate = useNavigate();
  const confirmationId = useId();
  const stats = useQuery({
    queryKey: ["files", "stats"],
    queryFn: () => repository.getDashboardStats(),
  });
  const [open, setOpen] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");
  const [invokingControl, setInvokingControl] = useState<HTMLElement | null>(null);
  const confirmed = confirmation.trim() === CONFIRMATION_WORD;

  const openDialog = (event: MouseEvent<HTMLButtonElement>) => {
    setInvokingControl(event.currentTarget);
    setConfirmation("");
    setError("");
    setOpen(true);
  };

  const closeDialog = () => {
    if (!deleting) setOpen(false);
  };

  const confirmDelete = async () => {
    if (!confirmed || deleting) return;
    setDeleting(true);
    setError("");
    try {
      await deleteAccount();
      navigate("/login", { replace: true });
    } catch (deleteError) {
      setError(userMessage(deleteError, "Your account could not be deleted. Please try again."));
      setDeleting(false);
    }
  };

  return (
    <div className="page-content account-page">
      <div className="page-heading"><div><span className="eyebrow">YOUR ACCOUNT</span><h1>Account</h1><p>Your profile details and account options.</p></div></div>
      <section className="detail-section" aria-labelledby="profile-heading">
        <h2 id="profile-heading">Profile</h2>
        <dl>
          <div><dt>Name</dt><dd>{user?.firstName} {user?.lastName}</dd></div>
          <div><dt>Email</dt><dd>{user?.email}</dd></div>
        </dl>
      </section>
      <section className="detail-section account-danger" aria-labelledby="delete-heading">
        <h2 id="delete-heading">Delete account</h2>
        <p>Permanently delete your account, all of your files and any share links. This cannot be undone.</p>
        {uploading && <p className="account-danger__hint" id="delete-blocked">Wait for your uploads to finish, or cancel them, before deleting your account.</p>}
        <button className="button button--danger" type="button" onClick={openDialog} disabled={uploading} aria-describedby={uploading ? "delete-blocked" : undefined}><Trash2 size={16} /> Delete account</button>
      </section>
      <Dialog title="Delete your account?" open={open} closeDisabled={deleting} onClose={closeDialog} returnFocusTo={invokingControl}>
        <form className="dialog__body" onSubmit={(event) => { event.preventDefault(); void confirmDelete(); }} noValidate>
          <p className="dialog__intro">{deletionSummary(stats.data?.totalFiles)}</p>
          <label className="field" htmlFor={confirmationId}>
            Type {CONFIRMATION_WORD} to confirm
            <input id={confirmationId} value={confirmation} onChange={(event) => setConfirmation(event.target.value)} autoComplete="off" autoCapitalize="characters" spellCheck={false} disabled={deleting} />
          </label>
          {error && <div className="inline-alert" role="alert">{error}</div>}
          <div className="dialog__actions">
            <button className="button button--secondary" type="button" onClick={closeDialog} disabled={deleting}>Cancel</button>
            <button className="button button--danger" type="submit" disabled={!confirmed || deleting}><Trash2 size={16} /> {deleting ? "Deleting..." : "Delete account"}</button>
          </div>
        </form>
      </Dialog>
    </div>
  );
};
