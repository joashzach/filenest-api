import { Folder, Pencil, Trash2 } from 'lucide-react';
import { formatRelativeTime, formatFolderSize } from '../utils/fileUtils';
import './FolderCard.css';

/**
 * FolderCard — Grid view card for a folder.
 * Mirrors file-card styling so folders look native in grid mode.
 *
 * Props:
 *   folder: { _id, name, createdAt, size }
 *   onOpen(folder): navigate into folder
 *   onRename(folder): open rename modal
 *   onDelete(folder): open delete modal
 *   disabled: boolean
 */
export default function FolderCard({ folder, onOpen, onRename, onDelete, disabled = false }) {
  const sizeDisplay = formatFolderSize(folder?.size);

  return (
    <div
      className="file-card folder-card"
      onClick={() => onOpen && onOpen(folder)}
      tabIndex={0}
      role="article"
      aria-label={`Folder: ${folder.name}`}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onOpen && onOpen(folder);
        }
      }}
    >
      <div className="file-card-top">
        <Folder size={22} strokeWidth={1.5} className="folder-card-icon" />
        <span className="file-card-type folder-card-badge">Folder</span>
      </div>

      <div className="file-card-body">
        <h4 className="file-card-name" title={folder.name}>
          {folder.name}
        </h4>
        <div className="file-card-meta">
          <span className="file-card-size">{sizeDisplay}</span>
          <span className="file-card-sep">•</span>
          <span className="file-card-date">{formatRelativeTime(folder.createdAt)}</span>
        </div>
      </div>

      <div className="file-card-actions" onClick={(e) => e.stopPropagation()}>
        <button
          className="file-card-btn"
          title="Rename folder"
          aria-label="Rename folder"
          onClick={() => onRename && onRename(folder)}
          disabled={disabled}
        >
          <Pencil size={15} strokeWidth={1.5} />
        </button>
        <button
          className="file-card-btn file-card-btn--delete"
          title="Delete folder"
          aria-label="Delete folder"
          onClick={() => onDelete && onDelete(folder)}
          disabled={disabled}
        >
          <Trash2 size={15} strokeWidth={1.5} />
        </button>
      </div>
    </div>
  );
}
