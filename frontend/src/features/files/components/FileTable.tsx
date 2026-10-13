import { Link } from "react-router-dom";
import { Download, FileArchive, FileAudio, FileImage, FileText, FileVideo, MoreHorizontal, Share2, Trash2 } from "lucide-react";
import type { FileRecord } from "../model/file.types";
import { formatBytes, formatDate } from "../../../lib/format";

interface FileTableProps {
  files: FileRecord[];
  onDownload: (file: FileRecord) => void;
  onShare: (file: FileRecord) => void;
  onDelete: (file: FileRecord) => void;
  busyFileId?: string | null;
  compact?: boolean;
}

const categoryIcon = {
  Documents: FileText,
  Images: FileImage,
  Videos: FileVideo,
  Audio: FileAudio,
  Archives: FileArchive,
  Other: MoreHorizontal,
};

export const FileGlyph = ({ file }: { file: Pick<FileRecord, "category"> }) => {
  const Icon = categoryIcon[file.category];
  return <span className={`file-glyph file-glyph--${file.category.toLowerCase()}`}><Icon size={20} strokeWidth={1.8} /></span>;
};

export const FileTable = ({ files, onDownload, onShare, onDelete, busyFileId, compact = false }: FileTableProps) => (
  <div className="file-table-scroll">
    <table className={`file-table ${compact ? "file-table--compact" : ""}`}>
      <caption className="sr-only">{compact ? "Recent files" : "Your files"}</caption>
      <thead>
        <tr><th scope="col">Name</th><th scope="col">Category</th><th scope="col">Size</th><th scope="col">Added</th><th scope="col"><span className="sr-only">Actions</span></th></tr>
      </thead>
      <tbody>
        {files.map((file) => (
          <tr key={file.id}>
            <td>
              <div className="file-name-cell">
                <FileGlyph file={file} />
                <div className="file-name-cell__text">
                  <Link to={`/files/${encodeURIComponent(file.id)}`} title={file.originalName}>{file.originalName}</Link>
                  <span className="file-name-cell__type">{file.mimeType}</span>
                  <span className="file-name-cell__mobile-size">{formatBytes(file.size)}</span>
                </div>
              </div>
            </td>
            <td><span className="category-label">{file.category}</span></td>
            <td className="file-table__meta">{formatBytes(file.size)}</td>
            <td className="file-table__meta">{formatDate(file.createdAt)}</td>
            <td>
              <div className="file-actions">
                <button type="button" className="icon-button" aria-label={`Download ${file.originalName}`} title="Download" disabled={busyFileId === file.id} onClick={() => onDownload(file)}><Download size={17} /></button>
                <button type="button" className="icon-button" aria-label={`Share ${file.originalName}`} title="Share" disabled={busyFileId === file.id} onClick={() => onShare(file)}><Share2 size={17} /></button>
                <button type="button" className="icon-button icon-button--danger" aria-label={`Delete ${file.originalName}`} title="Delete" disabled={busyFileId === file.id} onClick={() => onDelete(file)}><Trash2 size={17} /></button>
              </div>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);
