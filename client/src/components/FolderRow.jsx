import { Folder, Pencil, Trash2, ChevronRight } from 'lucide-react';
import { formatRelativeTime, formatFolderSize } from '../utils/fileUtils';
import './FolderRow.css';

/**
 * FolderRow — a single folder rendered inside the FileList table.
 * Mirrors the filelist-row styling exactly so folders look native.
 *
 * Props:
 *   folder: { _id, name, createdAt, size }
 *   onOpen(folder): navigate into folder
 *   onRename(folder): open rename modal
 *   onDelete(folder): open delete modal
 *   disabled: boolean — mutations in progress
 */
export default function FolderRow({ folder, onOpen, onRename, onDelete, disabled = false }) {
  function handleKeyDown(e) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onOpen && onOpen(folder);
    }
  }

  // If empty, display '0 KB'; otherwise display formatted size
  const sizeDisplay = formatFolderSize(folder?.size);

  return (
    <div
      className="filelist-row folder-row"
      role="row"
      onClick={() => onOpen && onOpen(folder)}
      tabIndex={0}
      onKeyDown={handleKeyDown}
    >
      {/* Name column — clickable */}
      <div
        className="filelist-col filelist-col-name folder-row-name"
        title={folder.name}
        aria-label={`Open folder ${folder.name}`}
      >
        <Folder size={16} strokeWidth={1.5} className="filelist-row-file-icon folder-row-icon" />
        <span className="filelist-filename folder-row-label">{folder.name}</span>
        <ChevronRight size={13} strokeWidth={1.5} className="folder-row-chevron" />
      </div>

      {/* Type column — normal font, not italics */}
      <div className="filelist-col filelist-col-type folder-row-type">
        Folder
      </div>

      {/* Size column — total size including subfolders and files; if empty, display 0 KB */}
      <div className="filelist-col filelist-col-size folder-row-size">
        {sizeDisplay}
      </div>

      {/* Date column */}
      <div className="filelist-col filelist-col-date folder-row-dim">
        {formatRelativeTime(folder.createdAt)}
      </div>

      {/* Actions column */}
      <div className="filelist-col filelist-col-actions" onClick={(e) => e.stopPropagation()}>
        <button
          className="filelist-action-btn"
          title="Rename folder"
          aria-label="Rename folder"
          onClick={() => onRename && onRename(folder)}
          disabled={disabled}
        >
          <Pencil size={13} strokeWidth={1.5} />
        </button>
        <button
          className="filelist-action-btn filelist-action-btn--delete"
          title="Delete folder"
          aria-label="Delete folder"
          onClick={() => onDelete && onDelete(folder)}
          disabled={disabled}
        >
          <Trash2 size={14} strokeWidth={1.5} />
        </button>
      </div>
    </div>
  );
}
