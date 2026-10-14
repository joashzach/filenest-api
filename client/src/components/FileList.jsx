import React from 'react';
import {
  formatSize,
  formatRelativeTime,
  formatDate,
  formatTime,
  getFileExtension,
  getFileCategory,
} from '../utils/fileUtils';
import {
  File,
  Image,
  FileText,
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
import SharedUsersCell from './SharedUsersCell';
import OwnerCell from './OwnerCell';
import RowActionMenu from './RowActionMenu';
import EmptyState from './EmptyState';
import './FileList.css';

/**
 * FileRowItem — Single file row inside FileList
 */
function FileRowItem({
  file,
  sharedView,
  onDownload,
  onDelete,
  onPreview,
  onRename,
  onShare,
  onLeave,
  onMove,
  downloadingId,
  deletingId,
}) {
  const permissions = usePermissions(file);
  const isDownloading = downloadingId === file._id;
  const isDeleting = deletingId === file._id;
  const ext = getFileExtension(file);

  function renderCategoryIcon() {
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

  const hasGrantees = (file.granteeCount ?? file.sharedWith?.length ?? file.grantees?.length ?? 0) > 0;
  const isSharingWithOthers =
    sharedView === 'by-me' || (sharedView !== 'with-me' && permissions.isOwner && hasGrantees);
  const isSharedWithMe =
    sharedView === 'with-me' ||
    permissions.isSharedWithMe ||
    (!permissions.isOwner && Boolean(permissions.role || file.permission || file.myPermission || file.inherited));
  const isShared = isSharingWithOthers || isSharedWithMe;
  const sharedTitle = isSharedWithMe ? 'Shared with me' : 'Shared with others';
  const ownerName = file.owner?.name || file.owner?.email;

  const rowModifier =
    sharedView === 'with-me'
      ? 'filelist-row--with-me'
      : sharedView === 'by-me'
      ? 'filelist-row--by-me'
      : '';

  return (
    <div
      className={`filelist-row ${rowModifier}`}
      style={{
        height: '48px',
        minHeight: '48px',
        maxHeight: '48px',
        flexShrink: 0,
        flexGrow: 0,
        boxSizing: 'border-box',
      }}
      role="row"
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
      onKeyDown={(e) => e.key === 'Enter' && onPreview && onPreview(file)}
    >
      {/* Name column */}
      <div className="filelist-col filelist-col-name" title={file.originalName}>
        {renderCategoryIcon()}
        <span className="filelist-filename">{file.originalName}</span>
        {isShared && (
          <span title={sharedTitle} className="file-shared-indicator">
            <Users size={13} strokeWidth={1.5} />
          </span>
        )}
      </div>

      {/* Shared with me columns */}
      {sharedView === 'with-me' && (
        <>
          <div className="filelist-col filelist-col-shared-by">
            <SharedUsersCell owner={file.owner} mode="shared-by" />
          </div>
          <div className="filelist-col filelist-col-role">
            <span className="filelist-badge">
              {permissions.isOwner || permissions.role === 'owner' || permissions.role === 'editor' ? 'Editor' : 'Viewer'}
            </span>
          </div>
        </>
      )}

      {/* Shared by me column */}
      {sharedView === 'by-me' && (
        <div className="filelist-col filelist-col-shared-with">
          <SharedUsersCell
            grantees={file.grantees || file.sharedWith}
            granteeCount={file.granteeCount}
            mode="shared-with"
          />
        </div>
      )}

      {/* Default view columns */}
      {!sharedView && (
        <>
          <OwnerCell item={file} />
          <div className="filelist-col filelist-col-type">{ext}</div>
          <div className="filelist-col filelist-col-size">{formatSize(file.size)}</div>
        </>
      )}

      {/* Date column */}
      <div
        className="filelist-col filelist-col-date"
        title={
          sharedView
            ? formatDate(file.sharedAt || file.updatedAt || file.createdAt) +
              ' ' +
              formatTime(file.sharedAt || file.updatedAt || file.createdAt)
            : file.createdAt
            ? `${formatDate(file.createdAt)} ${formatTime(file.createdAt)}`
            : ''
        }
      >
        {sharedView
          ? formatDate(file.sharedAt || file.updatedAt || file.createdAt)
          : formatRelativeTime(file.createdAt || file._id)}
      </div>

      {/* Actions column */}
      <div className="filelist-col filelist-col-actions" onClick={(e) => e.stopPropagation()}>
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
  );
}

/**
 * FileList — Flat, restrained table view for files
 */
export default function FileList({
  files = [],
  loading = false,
  error = '',
  sharedView = null,
  onRefresh,
  onDownload,
  onDelete,
  onPreview,
  onRename,
  onShare,
  onLeave,
  onMove,
  downloadingId,
  deletingId,
}) {
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
        <button className="filelist-retry-btn" onClick={onRefresh} type="button">
          Retry
        </button>
      </div>
    );
  }

  if (!files || files.length === 0) {
    return <EmptyState />;
  }

  const headerModifier =
    sharedView === 'with-me'
      ? 'filelist-header--with-me'
      : sharedView === 'by-me'
      ? 'filelist-header--by-me'
      : '';

  return (
    <div className="filelist-container">
      {/* Table header */}
      <div className={`filelist-header ${headerModifier}`}>
        <span className="filelist-th filelist-th-name">Name</span>

        {sharedView === 'with-me' && (
          <>
            <span className="filelist-th filelist-th-shared-by">Shared by</span>
            <span className="filelist-th filelist-th-role">Role</span>
          </>
        )}

        {sharedView === 'by-me' && (
          <span className="filelist-th filelist-th-shared-with">Shared with</span>
        )}

        {!sharedView && (
          <>
            <span className="filelist-th filelist-th-owner">Owner</span>
            <span className="filelist-th filelist-th-type">Type</span>
            <span className="filelist-th filelist-th-size">Size</span>
          </>
        )}

        <span className="filelist-th filelist-th-date">Date added</span>
        <span className="filelist-th filelist-th-actions" aria-hidden="true" />
      </div>

      {/* Rows */}
      <div className="filelist-rows" role="table">
        {files.map((file) => (
          <FileRowItem
            key={file._id}
            file={file}
            sharedView={sharedView}
            onDownload={onDownload}
            onDelete={onDelete}
            onPreview={onPreview}
            onRename={onRename}
            onShare={onShare}
            onLeave={onLeave}
            onMove={onMove}
            downloadingId={downloadingId}
            deletingId={deletingId}
          />
        ))}
      </div>
    </div>
  );
}
