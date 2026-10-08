import React from 'react';
import { formatSize, formatRelativeTime, formatDate, formatTime, getFileExtension, getFileCategory } from '../utils/fileUtils';
import { File, Image, FileText, Video, Download, Trash2, Pencil } from 'lucide-react';
import './FileCard.css';

/**
 * FileCard — Grid view card representation of a single file
 * Files are draggable for moving into folders
 */
export default function FileCard({
  file,
  onDownload,
  onDelete,
  onPreview,
  onRename,
  isDownloading = false,
  isDeleting = false,
}) {
  const ext = getFileExtension(file);

  function renderCategoryIcon() {
    const category = getFileCategory(file);
    switch (category) {
      case 'images':
        return <Image size={18} strokeWidth={1.5} className="file-card-icon" />;
      case 'documents':
        return <FileText size={18} strokeWidth={1.5} className="file-card-icon" />;
      case 'media':
        return <Video size={18} strokeWidth={1.5} className="file-card-icon" />;
      default:
        return <File size={18} strokeWidth={1.5} className="file-card-icon" />;
    }
  }

  return (
    <div
      className="file-card"
      style={{ flexShrink: 0, flexGrow: 0, alignSelf: 'flex-start', height: 'auto' }}
      draggable={true}
      onDragStart={(e) => {
        const payload = JSON.stringify({ itemType: 'file', id: file._id, name: file.originalName });
        e.dataTransfer.setData('application/x-filenest-item', payload);
        e.dataTransfer.setData('application/json', payload);
        e.dataTransfer.effectAllowed = 'move';
      }}
      onClick={() => onPreview && onPreview(file)}
      tabIndex={0}
      role="article"
    >
      <div className="file-card-top">
        {renderCategoryIcon()}
        <span className="file-card-type">{ext}</span>
      </div>

      <div className="file-card-body">
        <h4 className="file-card-name" title={file.originalName}>
          {file.originalName}
        </h4>
        <div className="file-card-meta">
          <span className="file-card-size">{formatSize(file.size)}</span>
          <span className="file-card-sep">•</span>
          <span
            className="file-card-date"
            title={file.createdAt ? `${formatDate(file.createdAt)} ${formatTime(file.createdAt)}` : ''}
          >
            {formatRelativeTime(file.createdAt || file._id)}
          </span>
        </div>
      </div>

      <div className="file-card-actions" onClick={(e) => e.stopPropagation()}>
        {onRename && (
          <button
            className="file-card-btn"
            title="Rename file"
            aria-label="Rename file"
            onClick={() => onRename(file)}
            disabled={isDownloading || isDeleting}
          >
            <Pencil size={13} strokeWidth={1.5} />
          </button>
        )}

        <button
          className="file-card-btn"
          title="Download file"
          aria-label="Download file"
          onClick={() => onDownload(file)}
          disabled={isDownloading || isDeleting}
        >
          <Download size={14} strokeWidth={1.5} />
        </button>

        <button
          className="file-card-btn file-card-btn--delete"
          title="Delete file"
          aria-label="Delete file"
          onClick={() => onDelete(file)}
          disabled={isDeleting || isDownloading}
        >
          <Trash2 size={14} strokeWidth={1.5} />
        </button>
      </div>
    </div>
  );
}
