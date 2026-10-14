import React, { useState } from 'react';
import { Folder, Pencil, Trash2, ChevronRight, Users, UserMinus, Share2, FolderInput } from 'lucide-react';
import { formatRelativeTime, formatFolderSize, formatDate, formatTime } from '../utils/fileUtils';
import usePermissions from '../hooks/usePermissions';
import SharedUsersCell from './SharedUsersCell';
import OwnerCell from './OwnerCell';
import RowActionMenu from './RowActionMenu';
import './FolderRow.css';

/**
 * FolderRow — a single folder rendered inside the FileList table.
 * Supports drag & drop: draggable to move into other folders, droppable to receive files/folders.
 *
 * Props:
 *   folder: { _id, name, createdAt, size, owner, sharedWith, myPermission, permission, inherited }
 *   onOpen(folder): navigate into folder
 *   onRename(folder): open rename modal
 *   onDelete(folder): open delete modal
 *   onDropItem(targetFolder, itemData): drop item into this folder
 *   onShare(folder): open share modal
 *   onLeave(folder): remove from shared with me
 *   onMove(folder): open move modal
 *   sharedView: 'with-me' | 'by-me' | null
 *   disabled: boolean — mutations in progress
 */
export default function FolderRow({
  folder,
  onOpen,
  onRename,
  onDelete,
  onDropItem,
  onShare,
  onLeave,
  onMove,
  sharedView = null,
  disabled = false,
}) {
  const [isDragOver, setIsDragOver] = useState(false);
  const permissions = usePermissions(folder);

  function handleKeyDown(e) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onOpen && onOpen(folder);
    }
  }

  function handleDragStart(e) {
    if (!permissions.canMove) return;
    const payload = JSON.stringify({ itemType: 'folder', id: folder._id, name: folder.name });
    e.dataTransfer.setData('application/x-filenest-item', payload);
    e.dataTransfer.setData('application/json', payload);
    e.dataTransfer.effectAllowed = 'move';
  }

  function handleDragOver(e) {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';
    if (!isDragOver) setIsDragOver(true);
  }

  function handleDragLeave(e) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }

  function handleDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    try {
      const raw = e.dataTransfer.getData('application/x-filenest-item') || e.dataTransfer.getData('application/json');
      if (raw) {
        const data = JSON.parse(raw);
        onDropItem && onDropItem(folder, data);
      }
    } catch (err) {
      console.error(err);
    }
  }

  const sizeDisplay = formatFolderSize(folder?.size);
  const isShared = (folder.granteeCount ?? folder.sharedWith?.length ?? folder.grantees?.length ?? 0) > 0;
  const isSharingWithOthers =
    sharedView === 'by-me' || (sharedView !== 'with-me' && permissions.isOwner && isShared);
  const isSharedWithMe =
    sharedView === 'with-me' ||
    permissions.isSharedWithMe ||
    (!permissions.isOwner && Boolean(permissions.role || folder.permission || folder.myPermission || folder.inherited));
  const isAnyShared = isSharingWithOthers || isSharedWithMe;
  const sharedTitle = isSharedWithMe ? 'Shared with me' : 'Shared with others';
  const ownerName = folder.owner?.name || folder.owner?.email;

  const rowModifier =
    sharedView === 'with-me'
      ? 'filelist-row--with-me'
      : sharedView === 'by-me'
      ? 'filelist-row--by-me'
      : '';

  return (
    <div
      className={`filelist-row folder-row ${rowModifier} ${isDragOver ? 'folder-row--drag-over' : ''}`}
      style={{ height: '48px', minHeight: '48px', maxHeight: '48px', flexShrink: 0, flexGrow: 0, boxSizing: 'border-box' }}
      role="row"
      draggable={permissions.canMove}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={() => onOpen && onOpen(folder)}
      tabIndex={0}
      onKeyDown={handleKeyDown}
    >
      {/* Name column */}
      <div
        className="filelist-col filelist-col-name folder-row-name"
        title={folder.name}
        aria-label={`Open folder ${folder.name}`}
      >
        <Folder size={16} strokeWidth={1.5} className="filelist-row-file-icon folder-row-icon" />
        <span className="filelist-filename folder-row-label">{folder.name}</span>
        {isAnyShared && (
          <span title={sharedTitle} className="file-shared-indicator">
            <Users size={13} strokeWidth={1.5} />
          </span>
        )}
        <ChevronRight size={13} strokeWidth={1.5} className="folder-row-chevron" />
      </div>

      {/* Shared with me columns */}
      {sharedView === 'with-me' && (
        <>
          <div className="filelist-col filelist-col-shared-by">
            <SharedUsersCell owner={folder.owner} mode="shared-by" />
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
            grantees={folder.grantees || folder.sharedWith}
            granteeCount={folder.granteeCount}
            mode="shared-with"
          />
        </div>
      )}

      {/* Default view columns */}
      {!sharedView && (
        <>
          <OwnerCell item={folder} />
          <div className="filelist-col filelist-col-type folder-row-type">
            Folder
          </div>
          <div className="filelist-col filelist-col-size folder-row-size">
            {sizeDisplay}
          </div>
        </>
      )}

      {/* Date column */}
      <div
        className="filelist-col filelist-col-date"
        title={
          sharedView
            ? formatDate(folder.sharedAt || folder.updatedAt || folder.createdAt) +
              ' ' +
              formatTime(folder.sharedAt || folder.updatedAt || folder.createdAt)
            : folder.createdAt
            ? `${formatDate(folder.createdAt)} ${formatTime(folder.createdAt)}`
            : ''
        }
      >
        {sharedView
          ? formatDate(folder.sharedAt || folder.updatedAt || folder.createdAt)
          : formatRelativeTime(folder.createdAt || folder._id)}
      </div>

      {/* Actions column */}
      <div className="filelist-col filelist-col-actions" onClick={(e) => e.stopPropagation()}>
        <RowActionMenu
          disabled={disabled}
          items={
            sharedView === 'by-me'
              ? [
                  onShare && {
                    key: 'share',
                    label: 'Share',
                    icon: Share2,
                    onClick: () => onShare(folder),
                  },
                  onRename && {
                    key: 'rename',
                    label: 'Rename',
                    icon: Pencil,
                    onClick: () => onRename(folder),
                  },
                  onMove && {
                    key: 'move',
                    label: 'Move',
                    icon: FolderInput,
                    onClick: () => onMove(folder),
                  },
                  onDelete && {
                    key: 'delete',
                    label: 'Delete',
                    icon: Trash2,
                    danger: true,
                    onClick: () => onDelete(folder),
                  },
                ]
              : sharedView === 'with-me'
              ? [
                  permissions.canRename && onRename && {
                    key: 'rename',
                    label: 'Rename',
                    icon: Pencil,
                    onClick: () => onRename(folder),
                  },
                  permissions.canMove && onMove && {
                    key: 'move',
                    label: 'Move',
                    icon: FolderInput,
                    onClick: () => onMove(folder),
                  },
                  (onDelete || onLeave) && {
                    key: 'delete',
                    label: 'Delete',
                    icon: Trash2,
                    danger: true,
                    onClick: () => (permissions.canDelete && onDelete ? onDelete(folder) : onLeave ? onLeave(folder) : onDelete && onDelete(folder)),
                  },
                ]
              : [
                  permissions.canShare && onShare && {
                    key: 'share',
                    label: 'Share',
                    icon: Share2,
                    onClick: () => onShare(folder),
                  },
                  permissions.canRename && onRename && {
                    key: 'rename',
                    label: 'Rename',
                    icon: Pencil,
                    onClick: () => onRename(folder),
                  },
                  permissions.canMove && onMove && {
                    key: 'move',
                    label: 'Move',
                    icon: FolderInput,
                    onClick: () => onMove(folder),
                  },
                  (permissions.canDelete || permissions.canLeave || onLeave || onDelete) && {
                    key: 'delete',
                    label: 'Delete',
                    icon: Trash2,
                    danger: true,
                    onClick: () => (permissions.canDelete && onDelete ? onDelete(folder) : onLeave ? onLeave(folder) : onDelete && onDelete(folder)),
                  },
                ]
          }
        />
      </div>
    </div>
  );
}
