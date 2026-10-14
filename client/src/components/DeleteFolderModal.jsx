import React, { useState } from 'react';
import { deleteFolder } from '../services/FolderApi';
import './DeleteConfirmModal.css';

/**
 * DeleteFolderModal — permanent folder deletion matching UI popup design
 */
export default function DeleteFolderModal({ isOpen, folder, onClose, onSuccess }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen || !folder) return null;

  function handleClose() {
    if (loading) return;
    setError('');
    onClose();
  }

  async function handleConfirm() {
    setLoading(true);
    setError('');
    try {
      await deleteFolder(folder._id);
      onSuccess();
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to delete folder. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  const rawName = folder.name || 'this folder';
  const cleanName = rawName.replace(/^["']|["']$/g, '');
  const shareCount = folder.granteeCount ?? folder.sharedWith?.length ?? folder.grantees?.length ?? 0;
  const isShared = shareCount > 0;

  return (
    <div className="modal-backdrop" onClick={handleClose}>
      <div className="delete-modal" onClick={(e) => e.stopPropagation()}>
        <div className="delete-modal-content">
          <h3 className="delete-modal-title">Delete "{cleanName}"?</h3>
          <p className="delete-modal-desc">
            This will be permanently deleted. This can't be undone.
          </p>

          {isShared && (
            <div className="delete-modal-shared-box">
              <span className="delete-modal-shared-primary">
                Shared with {shareCount} {shareCount === 1 ? 'person' : 'people'}.
              </span>{' '}
              <span className="delete-modal-shared-secondary">They'll lose access.</span>
            </div>
          )}

          {error && <p className="delete-modal-error">{error}</p>}
        </div>

        <div className="delete-modal-actions">
          <button
            type="button"
            className="delete-modal-cancel-btn"
            onClick={handleClose}
            disabled={loading}
          >
            Cancel
          </button>
          <button
            type="button"
            className="delete-modal-confirm-btn"
            onClick={handleConfirm}
            disabled={loading}
          >
            {loading ? 'Deleting...' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  );
}
