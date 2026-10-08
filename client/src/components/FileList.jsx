import React from 'react';
import { formatSize, formatRelativeTime, formatDate, formatTime, getFileExtension, getFileCategory } from '../utils/fileUtils';
import { File, Image, FileText, Video, Download, Trash2, Pencil } from 'lucide-react';
import EmptyState from './EmptyState';
import './FileList.css';

/**
 * FileList — Flat, restrained table view for files
 * Files are draggable for moving into folders
 */
export default function FileList({
  files = [],
  loading = false,
  error = '',
  onRefresh,
  onDownload,
  onDelete,
  onPreview,
  onRename,
  downloadingId,
  deletingId,
}) {
  function renderCategoryIcon(file) {
    const category = getFileCategory(file);
    switch (category) {
      case 'images':
        return <Image size={16} strokeWidth={1.5} className="filelist-row-file-icon" />;
      case 'documents':
        return <FileText size={16} strokeWidth={1.5} className="filelist-row-file-icon" />;
      case 'media':
        return <Video size={16} strokeWidth={1.5} className="filelist-row-file-icon" />;
      default:
        return <File size={16} strokeWidth={1.5} className="filelist-row-file-icon" />;
    }
  }

  if (loading) {
    return (
      <div className="filelist-status">
        <div className="filelist-spinner" />
        <p className="filelist-status-text">Loading files...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="filelist-status">
        <p className="filelist-status-text filelist-status-error">{error}</p>
        <button className="filelist-retry-btn" onClick={onRefresh}>
          Retry
        </button>
      </div>
    );
  }

  if (!files || files.length === 0) {
    return <EmptyState />;
  }

  return (
    <div className="filelist-container">
      {/* Table header */}
      <div className="filelist-header">
        <span className="filelist-th filelist-th-name">Name</span>
        <span className="filelist-th filelist-th-type">Type</span>
        <span className="filelist-th filelist-th-size">Size</span>
        <span className="filelist-th filelist-th-date">Date added</span>
        <span className="filelist-th filelist-th-actions" aria-hidden="true" />
      </div>

      {/* Rows */}
      <div className="filelist-rows" role="table">
        {files.map((file) => {
          const isDownloading = downloadingId === file._id;
          const isDeleting = deletingId === file._id;
          const ext = getFileExtension(file);

          return (
            <div
              key={file._id}
              className="filelist-row"
              style={{ height: '48px', minHeight: '48px', maxHeight: '48px', flexShrink: 0, flexGrow: 0, boxSizing: 'border-box' }}
              role="row"
              draggable={true}
              onDragStart={(e) => {
                const payload = JSON.stringify({ itemType: 'file', id: file._id, name: file.originalName });
                e.dataTransfer.setData('application/x-filenest-item', payload);
                e.dataTransfer.setData('application/json', payload);
                e.dataTransfer.effectAllowed = 'move';
              }}
              onClick={() => onPreview && onPreview(file)}
              tabIndex={0}
              onKeyDown={(e) => e.key === 'Enter' && onPreview && onPreview(file)}
            >
              {/* Name column */}
              <div
                className="filelist-col filelist-col-name"
                title={file.originalName}
              >
                {renderCategoryIcon(file)}
                <span className="filelist-filename">{file.originalName}</span>
              </div>

              {/* Type column */}
              <div className="filelist-col filelist-col-type">
                {ext}
              </div>

              {/* Size column */}
              <div className="filelist-col filelist-col-size">
                {formatSize(file.size)}
              </div>

              {/* Date added column */}
              <div
                className="filelist-col filelist-col-date"
                title={file.createdAt ? `${formatDate(file.createdAt)} ${formatTime(file.createdAt)}` : ''}
              >
                {formatRelativeTime(file.createdAt || file._id)}
              </div>

              {/* Actions column */}
              <div className="filelist-col filelist-col-actions" onClick={(e) => e.stopPropagation()}>
                {onRename && (
                  <button
                    className="filelist-action-btn"
                    title="Rename file"
                    aria-label="Rename file"
                    onClick={() => onRename(file)}
                    disabled={isDownloading || isDeleting}
                  >
                    <Pencil size={13} strokeWidth={1.5} />
                  </button>
                )}

                <button
                  className="filelist-action-btn"
                  title="Download file"
                  aria-label="Download file"
                  onClick={() => onDownload(file)}
                  disabled={isDownloading || isDeleting}
                >
                  <Download size={15} strokeWidth={1.5} />
                </button>

                <button
                  className="filelist-action-btn filelist-action-btn--delete"
                  title="Delete file"
                  aria-label="Delete file"
                  onClick={() => onDelete(file)}
                  disabled={isDeleting || isDownloading}
                >
                  <Trash2 size={15} strokeWidth={1.5} />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
