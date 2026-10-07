import React from 'react';
import { Folder, ChevronRight } from 'lucide-react';
import './FolderBreadcrumb.css';

/**
 * FolderBreadcrumb — shows the current folder path with root icon and pill styling for current item.
 *
 * Props:
 *   breadcrumbs: Array<{ id: string|null, name: string }>
 *   onNavigate(id): navigate to a folder by ID (null = root)
 */
export default function FolderBreadcrumb({ breadcrumbs = [], onNavigate }) {
  if (!breadcrumbs || breadcrumbs.length === 0) return null;

  return (
    <nav className="folder-breadcrumb" aria-label="Folder path">
      <div className="folder-breadcrumb-container">
        <Folder size={16} strokeWidth={1.5} className="folder-breadcrumb-root-icon" aria-hidden="true" />
        <ol className="folder-breadcrumb-list">
          {breadcrumbs.map((crumb, idx) => {
            const isLast = idx === breadcrumbs.length - 1;
            return (
              <li key={crumb.id ?? 'root'} className="folder-breadcrumb-item">
                {isLast ? (
                  <span className="folder-breadcrumb-current" aria-current="page">
                    {crumb.name}
                  </span>
                ) : (
                  <>
                    <button
                      type="button"
                      className="folder-breadcrumb-link"
                      onClick={() => onNavigate && onNavigate(crumb.id)}
                      title={`Go to ${crumb.name}`}
                    >
                      {crumb.name}
                    </button>
                    <ChevronRight size={13} strokeWidth={1.5} className="folder-breadcrumb-sep" aria-hidden="true" />
                  </>
                )}
              </li>
            );
          })}
        </ol>
      </div>
    </nav>
  );
}
