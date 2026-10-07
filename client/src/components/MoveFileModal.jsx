import React, { useState, useEffect } from 'react';
import { moveFile } from '../services/FileApi';
import { getRootContents, getFolderContents } from '../services/FolderApi';
import { IconClose, IconAlert, IconFolder } from './Icons';
import { ChevronRight, Home, Folder } from 'lucide-react';
import './MoveFileModal.css';

/**
 * MoveFileModal — lets the user pick a destination folder (or root) for a file.
 *
 * Props:
 *   isOpen: boolean
 *   file: { _id, originalName } | null
 *   currentFolderId: string|null  — exclude the current location from choices
 *   onClose(): void
 *   onSuccess(): void
 */
export default function MoveFileModal({ isOpen, file, currentFolderId, onClose, onSuccess }) {
  // browsing state inside the modal
  const [browsePath, setBrowsePath] = useState([]); // [{id, name}]
  const [folders, setFolders] = useState([]);
  const [loadingFolders, setLoadingFolders] = useState(false);
  const [moving, setMoving] = useState(false);
  const [error, setError] = useState('');

  const currentBrowseFolderId = browsePath.length > 0 ? browsePath[browsePath.length - 1].id : null;

  // Fetch folders whenever the modal opens or the browse path changes
  useEffect(() => {
    if (!isOpen) return;
    setError('');
    loadFolders(currentBrowseFolderId);
  }, [isOpen, currentBrowseFolderId]);

  // Reset browse path when modal opens
  useEffect(() => {
    if (isOpen) {
      setBrowsePath([]);
      setError('');
      setMoving(false);
    }
  }, [isOpen]);

  async function loadFolders(folderId) {
    setLoadingFolders(true);
    try {
      let res;
      if (folderId) {
        res = await getFolderContents(folderId);
      } else {
        res = await getRootContents();
      }
      setFolders(res.data?.folders || []);
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
    if (moving) return;
    setError('');
    setMoving(true);
    try {
      await moveFile(file._id, destinationFolderId);
      onSuccess();
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to move file. Please try again.');
      setMoving(false);
    }
  }

  // Determine if destination is same as file's current location
  const fileFolderId = file
    ? typeof file.folder === 'object' && file.folder !== null
      ? file.folder._id
      : file.folder || null
    : null;
  const actualCurrentFolderId = fileFolderId ?? currentFolderId ?? null;
  const isCurrentLocation = String(currentBrowseFolderId || '') === String(actualCurrentFolderId || '');
  const destinationName =
    browsePath.length > 0 ? browsePath[browsePath.length - 1].name : 'My Files (Root)';

  if (!isOpen || !file) return null;

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
              <h3 className="text-heading-xs move-modal-title">Move File</h3>
              <p className="text-caption text-smoke move-modal-subtitle" title={file.originalName}>
                {file.originalName}
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
            <Home size={13} strokeWidth={1.5} />
            <span>My Files</span>
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
