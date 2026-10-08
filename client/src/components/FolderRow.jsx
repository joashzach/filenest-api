import React, { useState } from 'react';
import { Folder, Pencil, Trash2, ChevronRight } from 'lucide-react';
import { formatRelativeTime, formatFolderSize, formatDate, formatTime } from '../utils/fileUtils';
import './FolderRow.css';

/**
 * FolderRow — a single folder rendered inside the FileList table.
 * Supports drag & drop: draggable to move into other folders, droppable to receive files/folders.
 *
 * Props:
 *   folder: { _id, name, createdAt, size }
 *   onOpen(folder): navigate into folder
 *   onRename(folder): open rename modal
 *   onDelete(folder): open delete modal
 *   onDropItem(targetFolder, itemData): drop item into this folder
 *   disabled: boolean — mutations in progress
 */
export default function FolderRow({
  folder,
  onOpen,
  onRename,
  onDelete,
  onDropItem,
  disabled = false,
}) {
  const [isDragOver, setIsDragOver] = useState(false);

  function handleKeyDown(e) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onOpen && onOpen(folder);
    }
  }

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

  // If empty, display '0 KB'; otherwise display formatted size
  const sizeDisplay = formatFolderSize(folder?.size);

  return (
    <div
      className={`filelist-row folder-row ${isDragOver ? 'folder-row--drag-over' : ''}`}
      style={{ height: '48px', minHeight: '48px', maxHeight: '48px', flexShrink: 0, flexGrow: 0, boxSizing: 'border-box' }}
      role="row"
      draggable={true}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
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
      <div
        className="filelist-col filelist-col-date"
        title={folder.createdAt ? `${formatDate(folder.createdAt)} ${formatTime(folder.createdAt)}` : ''}
      >
        {formatRelativeTime(folder.createdAt || folder._id)}
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
