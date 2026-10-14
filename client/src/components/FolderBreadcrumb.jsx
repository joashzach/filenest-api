import React from 'react';
import { Folder, ChevronRight, Users, Share2 } from 'lucide-react';
import './FolderBreadcrumb.css';

/**
 * FolderBreadcrumb — shows the current folder path with root icon and pill styling for current item.
 *
 * Props:
 *   breadcrumbs: Array<{ id: string|null, name: string }>
 *   onNavigate(id): navigate to a folder by ID (null = root)
 */
export default function FolderBreadcrumb({ breadcrumbs = [], onNavigate, onDropItem }) {
  const [dragOverId, setDragOverId] = React.useState(null);

  if (!breadcrumbs || breadcrumbs.length === 0) return null;

  const isSharedWithMe = breadcrumbs[0]?.name === 'Shared with me';
  const isSharedByMe = breadcrumbs[0]?.name === 'Shared by me';

  return (
    <nav className="folder-breadcrumb" aria-label="Folder path">
      <div className="folder-breadcrumb-container">
        {isSharedByMe ? (
          <Share2 size={16} strokeWidth={1.5} className="folder-breadcrumb-root-icon" aria-hidden="true" />
        ) : isSharedWithMe ? (
          <Users size={16} strokeWidth={1.5} className="folder-breadcrumb-root-icon" aria-hidden="true" />
        ) : (
          <Folder size={16} strokeWidth={1.5} className="folder-breadcrumb-root-icon" aria-hidden="true" />
        )}
        <ol className="folder-breadcrumb-list">
          {breadcrumbs.map((crumb, idx) => {
            const isLast = idx === breadcrumbs.length - 1;
            const crumbKey = crumb.id ?? 'root';
            const isDragOver = dragOverId === crumbKey;

            return (
              <li key={crumbKey} className="folder-breadcrumb-item">
                {isLast ? (
                  <span className="folder-breadcrumb-current" aria-current="page">
                    {crumb.name}
                  </span>
                ) : (
                  <>
                    <button
                      type="button"
                      className={`folder-breadcrumb-link ${isDragOver ? 'folder-breadcrumb-link--drag-over' : ''}`}
                      onClick={() => onNavigate && onNavigate(crumb.id)}
                      onDragOver={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        e.dataTransfer.dropEffect = 'move';
                        if (dragOverId !== crumbKey) setDragOverId(crumbKey);
                      }}
                      onDragLeave={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setDragOverId(null);
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setDragOverId(null);
                        try {
                          const raw = e.dataTransfer.getData('application/x-filenest-item') || e.dataTransfer.getData('application/json');
                          if (raw) {
                            const data = JSON.parse(raw);
                            onDropItem && onDropItem({ _id: crumb.id, name: crumb.name }, data);
                          }
                        } catch (err) {
                          console.error(err);
                        }
                      }}
                      title={`Move to ${crumb.name}`}
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
