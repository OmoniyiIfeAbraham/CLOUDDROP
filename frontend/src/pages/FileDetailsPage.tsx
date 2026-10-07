import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Download, Share2, Trash2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useFilesRepository } from "../features/files/api/files-context";
import { FileGlyph } from "../features/files/components/FileTable";
import { useFileActions } from "../features/files/hooks/useFileActions";
import { LoadingRows, StatusView } from "../components/ui/StatusView";
import { formatBytes, formatDate } from "../lib/format";
import { userMessage } from "../lib/messages";

export const FileDetailsPage = () => {
  const { fileId = "" } = useParams();
  const repository = useFilesRepository();
  const actions = useFileActions();
  const { data: file, isPending, isError, error, refetch } = useQuery({
    queryKey: ["files", "detail", fileId],
    queryFn: () => repository.getFile(fileId),
    enabled: !!fileId,
  });

  return (
    <div className="page-content detail-page">
      <Link to="/files" className="back-link"><ArrowLeft size={17} /> Back to my files</Link>
      {isPending ? <LoadingRows count={3} /> : isError || !file ? <StatusView kind="error" title="File unavailable" description={userMessage(error, "This file could not be found.")} onRetry={() => refetch()} /> : (
        <>
          <div className="detail-heading"><FileGlyph file={file} /><div><span className="eyebrow">FILE DETAILS</span><h1>{file.originalName}</h1><p>{file.category} <span aria-hidden="true">·</span> {formatBytes(file.size)}</p></div></div>
          <div className="detail-actions">
            <button className="button button--primary" type="button" onClick={() => actions.download(file)} disabled={actions.busyFileId === file.id}><Download size={17} /> Download</button>
            <button className="button button--secondary" type="button" onClick={() => actions.share(file)}><Share2 size={17} /> Share</button>
            <button className="button button--subtle-danger" type="button" onClick={() => actions.requestDelete(file)}><Trash2 size={17} /> Delete</button>
          </div>
          <section className="detail-section" aria-label="File information"><h2>Information</h2><dl><div><dt>File name</dt><dd>{file.originalName}</dd></div><div><dt>Category</dt><dd>{file.category}</dd></div><div><dt>File type</dt><dd>{file.mimeType}</dd></div><div><dt>Size</dt><dd>{formatBytes(file.size)}</dd></div><div><dt>Uploaded</dt><dd>{formatDate(file.createdAt)}</dd></div><div><dt>Last updated</dt><dd>{formatDate(file.updatedAt)}</dd></div></dl></section>
        </>
      )}
      {actions.dialogs}
    </div>
  );
};
