import React, { useState, useEffect } from 'react';
import { moveFile } from '../services/FileApi';
import { getRootContents, getFolderContents, moveFolder } from '../services/FolderApi';
import { IconClose, IconAlert } from './Icons';
import { ChevronRight, Home, Folder } from 'lucide-react';
import './MoveFileModal.css';

/**
 * MoveFileModal — lets the user pick a destination folder for a file or folder.
 * Supports personal files and items within a shared folder.
 *
 * Props:
 *   isOpen: boolean
 *   item: { _id, originalName?, name? } | null
 *   file: alias for item
 *   itemType: 'file' | 'folder'
 *   currentFolderId: string|null
 *   sharedRootFolder: { id: string, name: string } | null
 *   onClose(): void
 *   onSuccess(): void
 */
export default function MoveFileModal({
  isOpen,
  item,
  file,
  itemType = 'file',
  currentFolderId,
  sharedRootFolder = null,
  onClose,
  onSuccess,
}) {
  const target = item || file;
  const isFolder = itemType === 'folder' || (!target?.originalName && Boolean(target?.name));
  const itemName = target?.originalName || target?.name || 'item';

  // browsing state inside the modal (subfolders beneath root)
  const [browsePath, setBrowsePath] = useState([]); // [{id, name}]
  const [folders, setFolders] = useState([]);
  const [loadingFolders, setLoadingFolders] = useState(false);
  const [moving, setMoving] = useState(false);
  const [error, setError] = useState('');

  const currentBrowseFolderId =
    browsePath.length > 0
      ? browsePath[browsePath.length - 1].id
      : sharedRootFolder
      ? sharedRootFolder.id
      : null;

  // Reset browse path when modal opens
  useEffect(() => {
    if (isOpen) {
      setBrowsePath([]);
      setError('');
      setMoving(false);
    }
  }, [isOpen, sharedRootFolder?.id]);

  // Fetch folders whenever the modal opens or the browse path changes
  useEffect(() => {
    if (!isOpen || !target) return;
    setError('');
    loadFolders(currentBrowseFolderId);
  }, [isOpen, currentBrowseFolderId, target]);

  async function loadFolders(folderId) {
    setLoadingFolders(true);
    try {
      let res;
      if (folderId) {
        res = await getFolderContents(folderId);
      } else if (sharedRootFolder) {
        res = await getFolderContents(sharedRootFolder.id);
      } else {
        res = await getRootContents();
      }
      const rawFolders = res.data?.folders || [];
      // If moving a folder, exclude the folder itself from destination choices
      const filtered = isFolder && target?._id
        ? rawFolders.filter((f) => f._id !== target._id)
        : rawFolders;
      setFolders(filtered);
    } catch (err) {
      setError('Could not load folders.');
    } finally {
      setLoadingFolders(false);
    }
  }

  function handleOpenFolder(folder) {
    setBrowsePath((prev) => [...prev, { id: folder._id, name: folder.name }]);
  }

  function handleBreadcrumbClick(idx) {
    setBrowsePath((prev) => prev.slice(0, idx + 1));
  }

  function handleGoRoot() {
    setBrowsePath([]);
  }

  function handleClose() {
    if (moving) return;
    onClose();
  }

  async function handleMove(destinationFolderId) {
    if (moving || !target) return;
    setError('');
    setMoving(true);
    try {
      if (isFolder) {
        await moveFolder(target._id, destinationFolderId);
      } else {
        await moveFile(target._id, destinationFolderId);
      }
      onSuccess();
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to move item. Please try again.');
      setMoving(false);
    }
  }

  // Determine if destination is same as item's current location
  const itemFolderId = target
    ? typeof target.folder === 'object' && target.folder !== null
      ? target.folder._id
      : target.folder || target.parent || null
    : null;
  const actualCurrentFolderId = itemFolderId ?? currentFolderId ?? null;
  const isCurrentLocation = String(currentBrowseFolderId || '') === String(actualCurrentFolderId || '');
  const destinationName =
    browsePath.length > 0
      ? browsePath[browsePath.length - 1].name
      : sharedRootFolder
      ? sharedRootFolder.name
      : 'My Files (Root)';

  if (!isOpen || !target) return null;

  return (
    <div className="modal-backdrop" onClick={handleClose}>
      <div className="move-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="move-modal-header">
          <div className="move-modal-title-wrap">
            <div className="move-modal-icon-badge">
              <Folder size={16} strokeWidth={1.5} />
            </div>
            <div>
              <h3 className="text-heading-xs move-modal-title">Move {isFolder ? 'Folder' : 'File'}</h3>
              <p className="text-caption text-smoke move-modal-subtitle" title={itemName}>
                {itemName}
              </p>
            </div>
          </div>
          <button className="folder-modal-close" onClick={handleClose} disabled={moving} aria-label="Close">
            <IconClose size={18} />
          </button>
        </div>

        {/* Error */}
        {error && (
          <div className="form-error-box move-modal-error">
            <IconAlert size={15} />
            <span>{error}</span>
          </div>
        )}

        {/* Internal breadcrumb */}
        <div className="move-modal-breadcrumb">
          <button
            className={`move-modal-crumb-btn ${browsePath.length === 0 ? 'move-modal-crumb-btn--active' : ''}`}
            onClick={handleGoRoot}
          >
            {sharedRootFolder ? (
              <>
                <Folder size={13} strokeWidth={1.5} />
                <span>{sharedRootFolder.name}</span>
              </>
            ) : (
              <>
                <Home size={13} strokeWidth={1.5} />
                <span>My Files</span>
              </>
            )}
          </button>
          {browsePath.map((crumb, idx) => (
            <React.Fragment key={crumb.id}>
              <ChevronRight size={12} strokeWidth={1.5} className="move-modal-crumb-sep" />
              <button
                className={`move-modal-crumb-btn ${idx === browsePath.length - 1 ? 'move-modal-crumb-btn--active' : ''}`}
                onClick={() => handleBreadcrumbClick(idx)}
              >
                {crumb.name}
              </button>
            </React.Fragment>
          ))}
        </div>

        {/* Folder list */}
        <div className="move-modal-list">
          {loadingFolders ? (
            <div className="move-modal-status">
              <span className="move-modal-spinner" />
              <span className="text-small text-smoke">Loading folders...</span>
            </div>
          ) : folders.length === 0 ? (
            <div className="move-modal-status">
              <p className="text-small text-smoke">No subfolders here.</p>
            </div>
          ) : (
            folders.map((folder) => (
              <div key={folder._id} className="move-modal-folder-row">
                <button
                  className="move-modal-folder-btn"
                  onClick={() => handleOpenFolder(folder)}
                  title={folder.name}
                >
                  <Folder size={16} strokeWidth={1.5} className="move-modal-folder-icon" />
                  <span className="move-modal-folder-name">{folder.name}</span>
                  <ChevronRight size={14} strokeWidth={1.5} className="move-modal-folder-chevron" />
                </button>
              </div>
            ))
          )}
        </div>

        {/* Footer actions */}
        <div className="move-modal-footer">
          <button
            type="button"
            className="btn-secondary"
            onClick={handleClose}
            disabled={moving}
          >
            Cancel
          </button>
          <button
            type="button"
            className="btn-primary"
            onClick={() => handleMove(currentBrowseFolderId)}
            disabled={moving || isCurrentLocation}
            title={isCurrentLocation ? 'File is already in this location' : ''}
          >
            {moving ? (
              <>
                <span className="folder-modal-spinner" />
                <span>Moving...</span>
              </>
            ) : isCurrentLocation ? (
              'Already here'
            ) : (
              `Move to ${destinationName}`
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
