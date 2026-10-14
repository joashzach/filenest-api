import React, { useState, useRef, useEffect } from 'react';
import { renameFolder } from '../services/FolderApi';
import { IconClose, IconAlert } from './Icons';
import { Pencil } from 'lucide-react';
import './FolderModal.css';

/**
 * RenameFolderModal — rename an existing folder.
 *
 * Props:
 *   isOpen: boolean
 *   folder: { _id: string, name: string } | null
 *   onClose(): void
 *   onSuccess(): void
 */
export default function RenameFolderModal({ isOpen, folder, onClose, onSuccess }) {
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    if (isOpen && folder) {
      setName(folder.name || '');
      setError('');
      setLoading(false);
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus();
          inputRef.current.select();
        }
      }, 50);
    }
  }, [isOpen, folder]);

  if (!isOpen || !folder) return null;

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
    if (trimmed === folder.name) {
      onClose();
      return;
    }
    if (trimmed.length > 255) {
      setError('Folder name is too long (max 255 characters).');
      return;
    }

    setError('');
    setLoading(true);
    try {
      const res = await renameFolder(folder._id, trimmed);
      onSuccess(res.data?.folder || { ...folder, name: trimmed });
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to rename folder. Please try again.');
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
              <Pencil size={16} strokeWidth={1.5} />
            </div>
            <h3 className="text-heading-xs folder-modal-title">Rename Folder</h3>
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
            <label className="folder-modal-label" htmlFor="rename-folder-input">
              New name
            </label>
            <input
              id="rename-folder-input"
              ref={inputRef}
              type="text"
              className="folder-modal-input"
              value={name}
              onChange={(e) => { setName(e.target.value); setError(''); }}
              placeholder="Folder name"
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
                  <span>Saving...</span>
                </>
              ) : (
                'Save'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
