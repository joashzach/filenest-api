import React, { useState } from 'react';
import { Folder, Pencil, Trash2, Users, UserMinus, Share2, FolderInput } from 'lucide-react';
import usePermissions from '../hooks/usePermissions';
import RowActionMenu from './RowActionMenu';
import './FolderCard.css';

/**
 * FolderCard — Slim single card (4 per row) for grid view.
 * Features folder icon, name, gray people icon if shared, and ⋮ menu.
 * Supports drag & drop: draggable to move into other folders, droppable to receive files/folders.
 */
export default function FolderCard({
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

  const isShared = (folder.granteeCount ?? folder.sharedWith?.length ?? folder.grantees?.length ?? 0) > 0;
  const isSharingWithOthers =
    sharedView === 'by-me' || (sharedView !== 'with-me' && permissions.isOwner && isShared);
  const isSharedWithMe =
    sharedView === 'with-me' ||
    permissions.isSharedWithMe ||
    (!permissions.isOwner && Boolean(permissions.role || folder.permission || folder.myPermission || folder.inherited));
  const isAnyShared = isSharingWithOthers || isSharedWithMe;
  const sharedTitle = isSharedWithMe ? 'Shared with me' : 'Shared with others';

  return (
    <div
      className={`folder-card ${isDragOver ? 'folder-card--drag-over' : ''}`}
      draggable={permissions.canMove}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={() => onOpen && onOpen(folder)}
      tabIndex={0}
      role="article"
      aria-label={`Folder: ${folder.name}`}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onOpen && onOpen(folder);
        }
      }}
    >
      <Folder size={18} strokeWidth={1.5} className="folder-card-icon" />

      <span className="folder-card-name" title={folder.name}>
        {folder.name}
      </span>

      {isAnyShared && (
        <span title={sharedTitle} className="folder-card-shared-indicator">
          <Users size={13} strokeWidth={1.5} />
        </span>
      )}

      <div className="folder-card-actions" onClick={(e) => e.stopPropagation()}>
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
