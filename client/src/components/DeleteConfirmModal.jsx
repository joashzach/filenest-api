import React from 'react';
import { IconTrash, IconClose, IconAlert } from './Icons';
import './DeleteConfirmModal.css';

/**
 * DeleteConfirmModal — Prevents accidental file deletion
 */
export default function DeleteConfirmModal({ file, isOpen, onClose, onConfirm, isDeleting }) {
  if (!isOpen || !file) return null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="delete-modal" onClick={(e) => e.stopPropagation()}>
        <div className="delete-modal-icon-wrap">
          <IconAlert size={28} />
        </div>

        <div className="delete-modal-content">
          <h3 className="text-heading-xs delete-modal-title">Delete File</h3>
          <p className="text-body text-smoke delete-modal-desc">
            Are you sure you want to delete <strong className="text-chalk">{file.originalName}</strong>?
            This will permanently remove the file from cloud storage and database.
          </p>
        </div>

        <div className="delete-modal-actions">
          <button
            type="button"
            className="btn-secondary"
            onClick={onClose}
            disabled={isDeleting}
          >
            Cancel
          </button>
          <button
            type="button"
            className="btn-danger-solid"
            onClick={() => onConfirm(file)}
            disabled={isDeleting}
          >
            {isDeleting ? (
              <>
                <span className="file-card-spinner" />
                <span>Deleting...</span>
              </>
            ) : (
              <>
                <IconTrash size={16} />
                <span>Delete Permanently</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
