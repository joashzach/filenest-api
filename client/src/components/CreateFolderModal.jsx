import React, { useState, useRef, useEffect } from 'react';
import { createFolder } from '../services/FolderApi';
import { IconClose, IconAlert } from './Icons';
import { FolderPlus } from 'lucide-react';
import './FolderModal.css';

/**
 * CreateFolderModal — create a new folder at the current location.
 *
 * Props:
 *   isOpen: boolean
 *   parentId: string|null  — current folder ID (null = root)
 *   onClose(): void
 *   onSuccess(): void  — called after successful creation
 */
export default function CreateFolderModal({ isOpen, parentId, onClose, onSuccess }) {
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      setName('');
      setError('');
      setLoading(false);
      // Auto-focus the input after the modal mounts
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  function handleClose() {
    if (loading) return;
    onClose();
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Folder name cannot be empty.');
      return;
    }
    if (trimmed.length > 255) {
      setError('Folder name is too long (max 255 characters).');
      return;
    }

    setError('');
    setLoading(true);
    try {
      await createFolder({ name: trimmed, parent: parentId });
      onSuccess();
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to create folder. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={handleClose}>
      <div className="folder-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="folder-modal-header">
          <div className="folder-modal-title-wrap">
            <div className="folder-modal-icon-badge">
              <FolderPlus size={18} strokeWidth={1.5} />
            </div>
            <h3 className="text-heading-xs folder-modal-title">New Folder</h3>
          </div>
          <button className="folder-modal-close" onClick={handleClose} disabled={loading} aria-label="Close">
            <IconClose size={18} />
          </button>
        </div>

        {/* Error */}
        {error && (
          <div className="form-error-box folder-modal-error">
            <IconAlert size={15} />
            <span>{error}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="folder-modal-form">
          <div className="folder-modal-field">
            <label className="folder-modal-label" htmlFor="folder-name-input">
              Folder name
            </label>
            <input
              id="folder-name-input"
              ref={inputRef}
              type="text"
              className="folder-modal-input"
              value={name}
              onChange={(e) => { setName(e.target.value); setError(''); }}
              placeholder="e.g. Projects"
              disabled={loading}
              maxLength={255}
              autoComplete="off"
            />
          </div>

          <div className="folder-modal-footer">
            <button
              type="button"
              className="btn-secondary"
              onClick={handleClose}
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn-primary"
              disabled={loading || !name.trim()}
            >
              {loading ? (
                <>
                  <span className="folder-modal-spinner" />
                  <span>Creating...</span>
                </>
              ) : (
                'Create Folder'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
