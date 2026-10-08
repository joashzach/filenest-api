import React, { useState } from 'react';
import { Folder, Pencil, Trash2 } from 'lucide-react';
import { formatRelativeTime, formatFolderSize, formatDate, formatTime } from '../utils/fileUtils';
import './FolderCard.css';

/**
 * FolderCard — Grid view card for a folder.
 * Supports drag & drop: draggable to move into other folders, droppable to receive files/folders.
 *
 * Props:
 *   folder: { _id, name, createdAt, size }
 *   onOpen(folder): navigate into folder
 *   onRename(folder): open rename modal
 *   onDelete(folder): open delete modal
 *   onDropItem(targetFolder, itemData): drop item into this folder
 *   disabled: boolean
 */
export default function FolderCard({
  folder,
  onOpen,
  onRename,
  onDelete,
  onDropItem,
  disabled = false,
}) {
  const [isDragOver, setIsDragOver] = useState(false);
  const sizeDisplay = formatFolderSize(folder?.size);

  function handleDragStart(e) {
    const payload = JSON.stringify({ itemType: 'folder', id: folder._id, name: folder.name });
    e.dataTransfer.setData('application/x-filenest-item', payload);
    e.dataTransfer.setData('application/json', payload);
    e.dataTransfer.effectAllowed = 'move';
  }

  function handleDragOver(e) {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';
    if (!isDragOver) setIsDragOver(true);
  }

  function handleDragLeave(e) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }

  function handleDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    try {
      const raw = e.dataTransfer.getData('application/x-filenest-item') || e.dataTransfer.getData('application/json');
      if (raw) {
        const data = JSON.parse(raw);
        onDropItem && onDropItem(folder, data);
      }
    } catch (err) {
      console.error(err);
    }
  }

  return (
    <div
      className={`file-card folder-card ${isDragOver ? 'folder-card--drag-over' : ''}`}
      style={{ flexShrink: 0, flexGrow: 0, alignSelf: 'flex-start', height: 'auto' }}
      draggable={true}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
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
          <span
            className="file-card-date"
            title={folder.createdAt ? `${formatDate(folder.createdAt)} ${formatTime(folder.createdAt)}` : ''}
          >
            {formatRelativeTime(folder.createdAt || folder._id)}
          </span>
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
