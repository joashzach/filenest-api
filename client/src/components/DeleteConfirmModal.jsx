import React from 'react';
import './DeleteConfirmModal.css';

/**
 * DeleteConfirmModal — Compact confirmation popup matching UI design exactly
 */
export default function DeleteConfirmModal({ file, isOpen, onClose, onConfirm, isDeleting }) {
  if (!isOpen || !file) return null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="delete-modal" onClick={(e) => e.stopPropagation()}>
        <div className="delete-modal-content">
          <h3 className="delete-modal-title">Delete this file?</h3>
          <p className="delete-modal-desc">
            <strong className="delete-modal-target-name">{file.originalName}</strong> will be
            permanently deleted. This can't be undone.
          </p>
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
