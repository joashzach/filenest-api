import { useEffect } from 'react';
import {
  Folder,
  Image,
  FileText,
  Video,
  MoreHorizontal,
  Database,
  X,
} from 'lucide-react';
import { formatStorageSize } from '../utils/fileUtils';
import './Sidebar.css';

const NAV_CATEGORIES = [
  { id: 'all', label: 'My Files', icon: Folder },
  { id: 'images', label: 'Images', icon: Image },
  { id: 'documents', label: 'Documents', icon: FileText },
  { id: 'media', label: 'Media', icon: Video },
  { id: 'other', label: 'Other', icon: MoreHorizontal },
];

/**
 * Sidebar — 176px flat sidebar on desktop, off-canvas drawer on mobile
 */
export default function Sidebar({
  files = [],
  categoryCounts = {},
  rootCounts = { folders: 0, files: 0 },
  activeSection = 'files',
  onSectionChange,
  activeCategory = 'all',
  onCategoryChange,
  isOpen = false,
  onClose,
}) {
  const totalBytes = files.reduce((sum, f) => sum + (f.size || 0), 0);

  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === 'Escape' && isOpen && onClose) {
        onClose();
      }
    }
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, onClose]);

  function handleCategoryClick(categoryId) {
    if (onSectionChange) onSectionChange('files');
    if (onCategoryChange) onCategoryChange(categoryId);
    if (onClose) onClose();
  }

  function handleStorageClick() {
    if (onSectionChange) onSectionChange('storage');
    if (onClose) onClose();
  }

  const rootFolders = rootCounts?.folders || 0;
  const rootFiles = rootCounts?.files || 0;
  const rootTotal = rootFolders + rootFiles;

  const rootTooltipParts = [];
  if (rootFolders > 0) {
    rootTooltipParts.push(`${rootFolders} ${rootFolders === 1 ? 'folder' : 'folders'}`);
  }
  if (rootFiles > 0) {
    rootTooltipParts.push(`${rootFiles} ${rootFiles === 1 ? 'file' : 'files'}`);
  }
  const rootTooltip = rootTooltipParts.join(', ') || undefined;

  return (
    <>
      {isOpen && (
        <div
          className="sidebar-backdrop"
          onClick={onClose}
          aria-hidden="true"
        />
      )}
      <aside
        className={`sidebar ${isOpen ? 'sidebar--open' : ''}`}
        aria-label="Navigation sidebar"
      >
        <div className="sidebar-mobile-header">
          <span className="sidebar-mobile-title">Navigation</span>
          <button
            type="button"
            className="sidebar-close-btn"
            onClick={onClose}
            aria-label="Close navigation"
          >
            <X size={18} strokeWidth={1.5} />
          </button>
        </div>

        {/* Files Section */}
        <div className="sidebar-section-label">Files</div>

        <nav className="sidebar-nav">
          {NAV_CATEGORIES.map((cat) => {
            const Icon = cat.icon;
            const isActive = activeSection === 'files' && activeCategory === cat.id;
            const isAll = cat.id === 'all';
            const count = isAll ? rootTotal : (categoryCounts[cat.id] || 0);
            const tooltip = isAll ? rootTooltip : undefined;

            return (
              <button
                key={cat.id}
                className={`sidebar-nav-item ${isActive ? 'sidebar-nav-item--active' : ''}`}
                onClick={() => handleCategoryClick(cat.id)}
                title={tooltip}
              >
                <Icon size={17} strokeWidth={1.5} className="sidebar-item-icon" />
                <span className="sidebar-item-label">{cat.label}</span>
                {count > 0 && (
                  <span className="sidebar-item-count" title={tooltip}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Pinned to bottom under hairline */}
        <div className="sidebar-bottom-section">
          <button
            className={`sidebar-nav-item ${activeSection === 'storage' ? 'sidebar-nav-item--active' : ''}`}
            onClick={handleStorageClick}
          >
            <Database size={17} strokeWidth={1.5} className="sidebar-item-icon" />
            <span className="sidebar-item-label">Storage</span>
            <span className="sidebar-storage-value">{formatStorageSize(totalBytes)}</span>
          </button>
        </div>
      </aside>
    </>
  );
}
