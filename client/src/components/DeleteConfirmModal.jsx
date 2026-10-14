import React from 'react';
import './DeleteConfirmModal.css';

/**
 * DeleteConfirmModal — Compact confirmation popup matching UI design exactly
 */
export default function DeleteConfirmModal({ file, isOpen, onClose, onConfirm, isDeleting }) {
  if (!isOpen || !file) return null;

  const rawName = file.originalName || file.name || 'this file';
  const cleanName = rawName.replace(/^["']|["']$/g, '');
  const shareCount = file.granteeCount ?? file.sharedWith?.length ?? file.grantees?.length ?? 0;
  const isShared = shareCount > 0;

  return (
    <div className="modal-backdrop" onClick={onClose}>
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
        </div>

        <div className="delete-modal-actions">
          <button
            type="button"
            className="delete-modal-cancel-btn"
            onClick={onClose}
            disabled={isDeleting}
          >
            Cancel
          </button>
          <button
            type="button"
            className="delete-modal-confirm-btn"
            onClick={() => onConfirm(file)}
            disabled={isDeleting}
          >
            {isDeleting ? 'Deleting...' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  );
}
