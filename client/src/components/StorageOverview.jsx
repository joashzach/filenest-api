import React from 'react';
import { formatSize, formatRelativeTime, getFileCategory, getFileExtension } from '../utils/fileUtils';
import { Database, File, Image, FileText, Video, Download } from 'lucide-react';
import './StorageOverview.css';

/**
 * StorageOverview — Storage breakdown with no hardcoded limits or percentages
 */
export default function StorageOverview({ files = [], onPreview, onDownload }) {
  const totalUsedBytes = files.reduce((acc, f) => acc + (f.size || 0), 0);

  const categories = {
    images: { label: 'Images', files: [], bytes: 0 },
    documents: { label: 'Documents', files: [], bytes: 0 },
    media: { label: 'Media', files: [], bytes: 0 },
    other: { label: 'Other', files: [], bytes: 0 },
  };

  files.forEach((file) => {
    const cat = getFileCategory(file);
    if (categories[cat]) {
      categories[cat].files.push(file);
      categories[cat].bytes += file.size || 0;
    } else {
      categories.other.files.push(file);
      categories.other.bytes += file.size || 0;
    }
  });

  const largestFiles = [...files].sort((a, b) => (b.size || 0) - (a.size || 0)).slice(0, 5);

  function renderCategoryIcon(file) {
    const cat = getFileCategory(file);
    switch (cat) {
      case 'images':
        return <Image size={18} strokeWidth={1.5} className="storage-file-icon" />;
      case 'documents':
        return <FileText size={18} strokeWidth={1.5} className="storage-file-icon" />;
      case 'media':
        return <Video size={18} strokeWidth={1.5} className="storage-file-icon" />;
      default:
        return <File size={18} strokeWidth={1.5} className="storage-file-icon" />;
    }
  }

  return (
    <div className="storage-overview">
      {/* Header card with total storage used */}
      <div className="storage-header-card">
        <div className="storage-header-left">
          <Database size={26} strokeWidth={1.5} className="storage-header-icon" />
          <div>
            <h2 className="storage-title">Storage breakdown</h2>
            <p className="storage-subtitle">Total space occupied across all stored files</p>
          </div>
        </div>
        <div className="storage-header-stat">
          <span className="storage-stat-num">{formatSize(totalUsedBytes)}</span>
          <span className="storage-stat-label">total storage used</span>
        </div>
      </div>

      {/* Category summary cards */}
      <div className="storage-cards-grid">
        {Object.entries(categories).map(([key, cat]) => (
          <div key={key} className="storage-cat-card">
            <div className="storage-cat-card-top">
              <span className="storage-cat-title">{cat.label}</span>
              <span className="storage-cat-count">
                {cat.files.length} {cat.files.length === 1 ? 'file' : 'files'}
              </span>
            </div>
            <div className="storage-cat-card-bottom">
              <span className="storage-cat-size">{formatSize(cat.bytes)}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Largest Stored Files */}
      {largestFiles.length > 0 && (
        <div className="storage-largest-section">
          <h3 className="storage-section-title">Largest files</h3>
          <div className="storage-largest-list">
            {largestFiles.map((file) => (
              <div key={file._id} className="storage-largest-row">
                <div
                  className="storage-largest-left"
                  onClick={() => onPreview && onPreview(file)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => e.key === 'Enter' && onPreview && onPreview(file)}
                  title={file.originalName}
                >
                  {renderCategoryIcon(file)}
                  <span className="storage-largest-name" title={file.originalName}>
                    {file.originalName}
                  </span>
                </div>
                <div className="storage-largest-right">
                  <span className="storage-largest-size">{formatSize(file.size)}</span>
                  <button
                    className="storage-action-btn"
                    onClick={() => onDownload(file)}
                    title="Download file"
                    aria-label="Download file"
                  >
                    <Download size={17} strokeWidth={1.5} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
