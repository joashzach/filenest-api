import React from 'react';
import {
  Upload,
  Folder,
  Image,
  FileText,
  Video,
  MoreHorizontal,
  Database,
} from 'lucide-react';
import { formatStorageSize } from '../utils/fileUtils';
import './Sidebar.css';

const NAV_CATEGORIES = [
  { id: 'all', label: 'All files', icon: Folder },
  { id: 'images', label: 'Images', icon: Image },
  { id: 'documents', label: 'Documents', icon: FileText },
  { id: 'media', label: 'Media', icon: Video },
  { id: 'other', label: 'Other', icon: MoreHorizontal },
];

/**
 * Sidebar — 176px flat sidebar matching the design specification exactly
 */
export default function Sidebar({
  files = [],
  categoryCounts = {},
  activeSection = 'files',
  onSectionChange,
  activeCategory = 'all',
  onCategoryChange,
  onUploadClick,
}) {
  const totalBytes = files.reduce((sum, f) => sum + (f.size || 0), 0);

  function handleCategoryClick(categoryId) {
    if (onSectionChange) onSectionChange('files');
    if (onCategoryChange) onCategoryChange(categoryId);
  }

  return (
    <aside className="sidebar">
      {/* Upload file button */}
      <button className="sidebar-upload-btn" onClick={onUploadClick}>
        <Upload size={17} strokeWidth={1.5} className="sidebar-upload-icon" />
        <span>Upload file</span>
      </button>

      {/* Files Section */}
      <div className="sidebar-section-label">Files</div>

      <nav className="sidebar-nav">
        {NAV_CATEGORIES.map((cat) => {
          const Icon = cat.icon;
          const isActive = activeSection === 'files' && activeCategory === cat.id;
          const count = categoryCounts[cat.id] || 0;

          return (
            <button
              key={cat.id}
              className={`sidebar-nav-item ${isActive ? 'sidebar-nav-item--active' : ''}`}
              onClick={() => handleCategoryClick(cat.id)}
            >
              <Icon size={17} strokeWidth={1.5} className="sidebar-item-icon" />
              <span className="sidebar-item-label">{cat.label}</span>
              {count > 0 && <span className="sidebar-item-count">{count}</span>}
            </button>
          );
        })}
      </nav>

      {/* Pinned to bottom under hairline */}
      <div className="sidebar-bottom-section">
        <button
          className={`sidebar-nav-item ${activeSection === 'storage' ? 'sidebar-nav-item--active' : ''}`}
          onClick={() => onSectionChange && onSectionChange('storage')}
        >
          <Database size={17} strokeWidth={1.5} className="sidebar-item-icon" />
          <span className="sidebar-item-label">Storage</span>
          <span className="sidebar-storage-value">{formatStorageSize(totalBytes)}</span>
        </button>
      </div>
    </aside>
  );
}
