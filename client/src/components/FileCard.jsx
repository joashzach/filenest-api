import React from 'react';
import { getFileCategory } from '../utils/fileUtils';
import {
  FileText,
  Image,
  Video,
  Download,
  Trash2,
  Pencil,
  Users,
  UserMinus,
  Share2,
  FolderInput,
} from 'lucide-react';
import usePermissions from '../hooks/usePermissions';
import RowActionMenu from './RowActionMenu';
import FileThumbnail from './FileThumbnail';
import './FileCard.css';

/**
 * FileCard — Edge-to-edge grid view card for a file.
 * Thumbnail fills the top area (height: 196px; width: 100%; object-fit: cover).
 * Bottom row is 46px high with padding: 0 10px 0 8px, 12px gap,
 * truncated filename, file icon, and ⋮ menu.
 */
export default function FileCard({
  file,
  onDownload,
  onDelete,
  onPreview,
  onRename,
  onShare,
  onLeave,
  onMove,
  sharedView = null,
  isDownloading = false,
  isDeleting = false,
}) {
  const permissions = usePermissions(file);
  const hasGrantees = (file.granteeCount ?? file.sharedWith?.length ?? file.grantees?.length ?? 0) > 0;
  const isSharingWithOthers =
    sharedView === 'by-me' || (sharedView !== 'with-me' && permissions.isOwner && hasGrantees);
  const isSharedWithMe =
    sharedView === 'with-me' ||
    permissions.isSharedWithMe ||
    (!permissions.isOwner && Boolean(permissions.role || file.permission || file.myPermission || file.inherited));
  const isShared = isSharingWithOthers || isSharedWithMe;
  const sharedTitle = isSharedWithMe ? 'Shared with me' : 'Shared with others';

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
        return <FileText size={18} strokeWidth={1.5} className="file-card-icon" />;
    }
  }

  return (
    <div
      className="file-card"
      draggable={permissions.canMove}
      onDragStart={(e) => {
        if (!permissions.canMove) return;
        const payload = JSON.stringify({ itemType: 'file', id: file._id, name: file.originalName });
        e.dataTransfer.setData('application/x-filenest-item', payload);
        e.dataTransfer.setData('application/json', payload);
        e.dataTransfer.effectAllowed = 'move';
      }}
      onClick={() => onPreview && onPreview(file)}
      tabIndex={0}
      role="article"
      aria-label={`File: ${file.originalName}`}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onPreview && onPreview(file);
        }
      }}
    >
      <div className="file-card-preview-wrap">
        <FileThumbnail file={file} />
      </div>

      <div className="file-card-bottom">
        {renderCategoryIcon()}

        <span className="file-card-name" title={file.originalName}>
          {file.originalName}
        </span>

        {isShared && (
          <span title={sharedTitle} className="file-card-shared-indicator">
            <Users size={13} strokeWidth={1.5} />
          </span>
        )}

        <div className="file-card-actions" onClick={(e) => e.stopPropagation()}>
          <RowActionMenu
            disabled={isDownloading || isDeleting}
            items={
              sharedView === 'by-me'
                ? [
                    onShare && {
                      key: 'share',
                      label: 'Share',
                      icon: Share2,
                      onClick: () => onShare(file),
                    },
                    onDownload && {
                      key: 'download',
                      label: 'Download',
                      icon: Download,
                      onClick: () => onDownload(file),
                    },
                    onRename && {
                      key: 'rename',
                      label: 'Rename',
                      icon: Pencil,
                      onClick: () => onRename(file),
                    },
                    onMove && {
                      key: 'move',
                      label: 'Move',
                      icon: FolderInput,
                      onClick: () => onMove(file),
                    },
                    onDelete && {
                      key: 'delete',
                      label: 'Delete',
                      icon: Trash2,
                      danger: true,
                      onClick: () => onDelete(file),
                    },
                  ]
                : sharedView === 'with-me'
                ? [
                    onDownload && {
                      key: 'download',
                      label: 'Download',
                      icon: Download,
                      onClick: () => onDownload(file),
                    },
                    (permissions.canRename || permissions.isEditor) && onRename && {
                      key: 'rename',
                      label: 'Rename',
                      icon: Pencil,
                      onClick: () => onRename(file),
                    },
                    (permissions.canMove || permissions.isEditor) && onMove && {
                      key: 'move',
                      label: 'Move',
                      icon: FolderInput,
                      onClick: () => onMove(file),
                    },
                    (onDelete || onLeave) && {
                      key: 'delete',
                      label: 'Delete',
                      icon: Trash2,
                      danger: true,
                      onClick: () => (permissions.canDelete && onDelete ? onDelete(file) : onLeave ? onLeave(file) : onDelete && onDelete(file)),
                    },
                  ]
                : [
                    permissions.canShare && onShare && {
                      key: 'share',
                      label: 'Share',
                      icon: Share2,
                      onClick: () => onShare(file),
                    },
                    (permissions.canDownload || Boolean(onDownload)) && onDownload && {
                      key: 'download',
                      label: 'Download',
                      icon: Download,
                      onClick: () => onDownload(file),
                    },
                    (permissions.canRename || permissions.isEditor || !permissions.isViewer) && onRename && {
                      key: 'rename',
                      label: 'Rename',
                      icon: Pencil,
                      onClick: () => onRename(file),
                    },
                    (permissions.canMove || permissions.isEditor || !permissions.isViewer) && onMove && {
                      key: 'move',
                      label: 'Move',
                      icon: FolderInput,
                      onClick: () => onMove(file),
                    },
                    (permissions.canDelete || permissions.canLeave || onLeave || onDelete) && {
                      key: 'delete',
                      label: 'Delete',
                      icon: Trash2,
                      danger: true,
                      onClick: () => (permissions.canDelete && onDelete ? onDelete(file) : onLeave ? onLeave(file) : onDelete && onDelete(file)),
                    },
                  ]
            }
          />
        </div>
      </div>
    </div>
  );
}
