import React, { useState, useRef, useEffect } from 'react';
import { renameFile } from '../services/FileApi';
import { IconClose, IconAlert } from './Icons';
import { Pencil } from 'lucide-react';
import './FolderModal.css';

/**
 * RenameFileModal — rename an existing file.
 *
 * Props:
 *   isOpen: boolean
 *   file: { _id: string, originalName: string } | null
 *   onClose(): void
 *   onSuccess(): void
 */
export default function RenameFileModal({ isOpen, file, onClose, onSuccess }) {
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    if (isOpen && file) {
      const initialName = file.originalName || file.name || '';
      setName(initialName);
      setError('');
      setLoading(false);
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus();
          // Select only the name part before extension if present
          const dotIdx = initialName.lastIndexOf('.');
          if (dotIdx > 0) {
            inputRef.current.setSelectionRange(0, dotIdx);
          } else {
            inputRef.current.select();
          }
        }
      }, 50);
    }
  }, [isOpen, file]);

  if (!isOpen || !file) return null;

  function handleClose() {
    if (loading) return;
    onClose();
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError('File name cannot be empty.');
      return;
    }
    const currentName = file.originalName || file.name;
    if (trimmed === currentName) {
      onClose();
      return;
    }
    if (trimmed.length > 255) {
      setError('File name is too long (max 255 characters).');
      return;
    }

    setError('');
    setLoading(true);
    try {
      await renameFile(file._id, trimmed);
      onSuccess && onSuccess();
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to rename file. Please try again.');
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
            <h3 className="text-heading-xs folder-modal-title">Rename File</h3>
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
            <label className="folder-modal-label" htmlFor="rename-file-input">
              File name
            </label>
            <input
              id="rename-file-input"
              ref={inputRef}
              type="text"
              className="folder-modal-input"
              value={name}
              onChange={(e) => { setName(e.target.value); setError(''); }}
              placeholder="File name"
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
