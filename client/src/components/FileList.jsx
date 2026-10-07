import React from 'react';
import { formatSize, formatRelativeTime, getFileExtension, getFileCategory } from '../utils/fileUtils';
import { File, Image, FileText, Video, Download, Trash2, MoveRight } from 'lucide-react';
import EmptyState from './EmptyState';
import './FileList.css';

/**
 * FileList — Flat, restrained table view for files
 * Files match their category icon; includes Move action
 */
export default function FileList({
  files = [],
  loading = false,
  error = '',
  onRefresh,
  onDownload,
  onDelete,
  onPreview,
  onMove,
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
              role="row"
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
              <div className="filelist-col filelist-col-date">
                {formatRelativeTime(file.createdAt)}
              </div>

              {/* Actions column */}
              <div className="filelist-col filelist-col-actions" onClick={(e) => e.stopPropagation()}>
                {onMove && (
                  <button
                    className="filelist-action-btn"
                    title="Move file"
                    aria-label="Move file"
                    onClick={() => onMove(file)}
                    disabled={isDownloading || isDeleting}
                  >
                    <MoveRight size={14} strokeWidth={1.5} />
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
