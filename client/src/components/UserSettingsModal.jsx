import React, { useState, useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { updatePassword } from '../services/AuthApi';
import './UserSettingsModal.css';

/**
 * UserSettingsModal — Password-only modal matching design spec
 */
export default function UserSettingsModal({ isOpen, onClose }) {
  const modalRef = useRef(null);
  const currentPasswordInputRef = useRef(null);

  // Password Form
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState('');
  const [passwordError, setPasswordError] = useState('');

  // Reset form when modal opens or closes
  useEffect(() => {
    if (isOpen) {
      setPasswordForm({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      });
      setPasswordError('');
      setPasswordSuccess('');
      setTimeout(() => {
        currentPasswordInputRef.current?.focus();
      }, 0);
    }
  }, [isOpen]);

  // Focus trap & Escape listener
  useEffect(() => {
    if (!isOpen) return;

    function handleKeyDown(e) {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }

      if (e.key === 'Tab' && modalRef.current) {
        const focusables = modalRef.current.querySelectorAll(
          'button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])'
        );
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === first) {
            e.preventDefault();
            last.focus();
          }
        } else {
          if (document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  async function handlePasswordSubmit(e) {
    e.preventDefault();
    setPasswordError('');
    setPasswordSuccess('');

    if (!passwordForm.currentPassword || !passwordForm.newPassword) {
      setPasswordError('Please provide your current and new password.');
      return;
    }

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordError('New passwords do not match.');
      return;
    }

    if (passwordForm.newPassword.length < 6) {
      setPasswordError('New password must be at least 6 characters.');
      return;
    }

    setPasswordLoading(true);
    try {
      await updatePassword({
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword,
      });
      setPasswordSuccess('Password changed successfully!');
      setPasswordForm({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      });
      setTimeout(() => {
        setPasswordSuccess('');
        onClose();
      }, 1500);
    } catch (err) {
      setPasswordError(err.message || 'Failed to change password.');
    } finally {
      setPasswordLoading(false);
    }
  }

  return (
    <div className="password-modal-backdrop" onClick={onClose}>
      <div
        className="password-modal"
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="password-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="password-modal-header">
          <h2 id="password-modal-title" className="password-modal-title">
            Change password
          </h2>
          <button
            type="button"
            className="password-modal-close"
            onClick={onClose}
            aria-label="Close"
          >
            <X size={16} strokeWidth={1.5} />
          </button>
        </div>

        <form onSubmit={handlePasswordSubmit} className="password-modal-form">
          {passwordError && (
            <div className="password-modal-error">
              {passwordError}
            </div>
          )}
          {passwordSuccess && (
            <div className="password-modal-success">
              {passwordSuccess}
            </div>
          )}

          <div className="password-form-group">
            <label className="password-form-label" htmlFor="current-password">
              Current password
            </label>
            <input
              ref={currentPasswordInputRef}
              id="current-password"
              type="password"
              className="password-form-input"
              placeholder="Enter current password"
              value={passwordForm.currentPassword}
              onChange={(e) =>
                setPasswordForm({ ...passwordForm, currentPassword: e.target.value })
              }
              disabled={passwordLoading}
              autoComplete="current-password"
            />
          </div>

          <div className="password-form-group">
            <label className="password-form-label" htmlFor="new-password">
              New password
            </label>
            <input
              id="new-password"
              type="password"
              className="password-form-input"
              placeholder="Enter new password"
              value={passwordForm.newPassword}
              onChange={(e) =>
                setPasswordForm({ ...passwordForm, newPassword: e.target.value })
              }
              disabled={passwordLoading}
              autoComplete="new-password"
            />
            <span className="password-form-helper">At least 6 characters.</span>
          </div>

          <div className="password-form-group">
            <label className="password-form-label" htmlFor="confirm-password">
              Confirm new password
            </label>
            <input
              id="confirm-password"
              type="password"
              className="password-form-input"
              placeholder="Re-enter new password"
              value={passwordForm.confirmPassword}
              onChange={(e) =>
                setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })
              }
              disabled={passwordLoading}
              autoComplete="new-password"
            />
          </div>

          <div className="password-modal-footer">
            <button
              type="button"
              className="password-btn-cancel"
              onClick={onClose}
              disabled={passwordLoading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="password-btn-submit"
              disabled={passwordLoading}
            >
              {passwordLoading ? 'Updating...' : 'Update password'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
