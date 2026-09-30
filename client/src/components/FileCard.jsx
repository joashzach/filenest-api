import React from 'react';
import { formatSize, formatRelativeTime, getFileExtension, getFileCategory } from '../utils/fileUtils';
import { File, Image, FileText, Video, Download, Trash2 } from 'lucide-react';
import './FileCard.css';

/**
 * FileCard — Grid view card representation of a single file
 * Files match their category icon, Eye action removed
 */
export default function FileCard({
  file,
  onDownload,
  onDelete,
  onPreview,
  isDownloading = false,
  isDeleting = false,
}) {
  const ext = getFileExtension(file);

  function renderCategoryIcon() {
    const category = getFileCategory(file);
    switch (category) {
      case 'images':
        return <Image size={22} strokeWidth={1.5} className="file-card-icon" />;
      case 'documents':
        return <FileText size={22} strokeWidth={1.5} className="file-card-icon" />;
      case 'media':
        return <Video size={22} strokeWidth={1.5} className="file-card-icon" />;
      default:
        return <File size={22} strokeWidth={1.5} className="file-card-icon" />;
    }
  }

  return (
    <div className="file-card" onClick={() => onPreview && onPreview(file)} tabIndex={0} role="article">
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
          <span className="file-card-date">{formatRelativeTime(file.createdAt)}</span>
        </div>
      </div>

      <div className="file-card-actions" onClick={(e) => e.stopPropagation()}>
        <button
          className="file-card-btn"
          title="Download file"
          aria-label="Download file"
          onClick={() => onDownload(file)}
          disabled={isDownloading || isDeleting}
        >
          <Download size={17} strokeWidth={1.5} />
        </button>

        <button
          className="file-card-btn file-card-btn--delete"
          title="Delete file"
          aria-label="Delete file"
          onClick={() => onDelete(file)}
          disabled={isDeleting || isDownloading}
        >
          <Trash2 size={17} strokeWidth={1.5} />
        </button>
      </div>
    </div>
  );
}
