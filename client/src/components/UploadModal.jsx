import React, { useState, useRef } from 'react';
import { getUploadUrl, uploadToS3, confirmUpload } from '../services/FileApi';
import { formatSize, getFileCategory } from '../utils/fileUtils';
import { IconUpload, IconFile, IconCheck, IconClose, IconAlert } from './Icons';
import './UploadModal.css';

/**
 * UploadModal — Upload dialog with drag & drop and real multi-stage progress
 */
export default function UploadModal({ isOpen, onClose, onSuccess }) {
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [progressStage, setProgressStage] = useState('');
  const [progressPercent, setProgressPercent] = useState(0);
  const [error, setError] = useState('');
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef(null);

  if (!isOpen) return null;

  function resetState() {
    setSelectedFile(null);
    setUploading(false);
    setProgressStage('');
    setProgressPercent(0);
    setError('');
    setIsDragOver(false);
  }

  function handleClose() {
    if (uploading) return;
    resetState();
    onClose();
  }

  function handleFileSelection(file) {
    if (!file) return;
    setError('');
    setSelectedFile(file);
  }

  function handleDrop(e) {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelection(e.dataTransfer.files[0]);
    }
  }

  function handleDragOver(e) {
    e.preventDefault();
    setIsDragOver(true);
  }

  function handleDragLeave(e) {
    e.preventDefault();
    setIsDragOver(false);
  }

  async function handleUpload() {
    if (!selectedFile || uploading) return;

    setError('');
    setUploading(true);
    setProgressPercent(15);
    setProgressStage('Authorizing secure cloud upload...');

    try {
      // Step 1: Request presigned upload URL from backend
      const originalName = selectedFile.name;
      const mimeType = selectedFile.type || 'application/octet-stream';
      const size = selectedFile.size;

      const urlRes = await getUploadUrl({ originalName, mimeType });
      const { key, uploadUrl } = urlRes.data || {};

      if (!uploadUrl || !key) {
        throw new Error('Server did not return a valid upload authorization URL.');
      }

      // Step 2: Upload directly to S3 via presigned PUT
      setProgressPercent(55);
      setProgressStage('Uploading file directly to cloud storage...');
      await uploadToS3(uploadUrl, selectedFile);

      // Step 3: Confirm upload with backend (save metadata in MongoDB)
      setProgressPercent(85);
      setProgressStage('Registering file metadata...');
      await confirmUpload({ originalName, mimeType, size, key });

      // Step 4: Done!
      setProgressPercent(100);
      setProgressStage('File uploaded successfully!');

      setTimeout(() => {
        resetState();
        onSuccess();
        onClose();
      }, 700);
    } catch (err) {
      setError(err.message || 'File upload failed. Please try again.');
      setUploading(false);
      setProgressStage('');
      setProgressPercent(0);
    }
  }

  const category = selectedFile ? getFileCategory(selectedFile) : 'other';

  return (
    <div className="modal-backdrop" onClick={handleClose}>
      <div className="upload-modal" onClick={(e) => e.stopPropagation()}>
        <div className="upload-modal-header">
          <div className="upload-modal-title-wrap">
            <div className="upload-modal-icon-badge">
              <IconUpload size={20} />
            </div>
            <div>
              <h3 className="text-heading-xs upload-modal-title">Upload File</h3>
              <p className="text-caption text-smoke">Upload files directly to your secure cloud bucket</p>
            </div>
          </div>
          <button className="upload-modal-close" onClick={handleClose} disabled={uploading}>
            <IconClose size={18} />
          </button>
        </div>

        {error && (
          <div className="form-error-box upload-modal-error">
            <IconAlert size={16} />
            <span>{error}</span>
          </div>
        )}

        {!selectedFile ? (
          <div
            className={`upload-dropzone ${isDragOver ? 'upload-dropzone--active' : ''}`}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              type="file"
              ref={fileInputRef}
              style={{ display: 'none' }}
              onChange={(e) => handleFileSelection(e.target.files?.[0])}
            />
            <div className="upload-dropzone-icon">
              <IconUpload size={32} />
            </div>
            <p className="upload-dropzone-primary text-body">
              Drag & drop your file here, or <span className="upload-dropzone-browse">browse</span>
            </p>
            <p className="text-caption text-smoke">Supports all formats: Documents, Images, Media, Archives</p>
          </div>
        ) : (
          <div className="upload-selected-file">
            <div className="upload-selected-info">
              <div className={`upload-selected-icon upload-selected-icon--${category}`}>
                <IconFile category={category} size={28} />
              </div>
              <div className="upload-selected-details">
                <span className="upload-selected-name" title={selectedFile.name}>
                  {selectedFile.name}
                </span>
                <span className="upload-selected-size text-caption text-smoke">
                  {formatSize(selectedFile.size)} • {selectedFile.type || 'Unknown type'}
                </span>
              </div>
              {!uploading && (
                <button
                  className="upload-selected-remove"
                  onClick={() => setSelectedFile(null)}
                  title="Choose a different file"
                >
                  <IconClose size={16} />
                </button>
              )}
            </div>

            {uploading && (
              <div className="upload-progress-box">
                <div className="upload-progress-info">
                  <span className="text-small text-chalk">{progressStage}</span>
                  <span className="text-small text-smoke">{progressPercent}%</span>
                </div>
                <div className="upload-progress-bar">
                  <div
                    className="upload-progress-fill"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        )}

        <div className="upload-modal-footer">
          <button
            type="button"
            className="btn-secondary"
            onClick={handleClose}
            disabled={uploading}
          >
            Cancel
          </button>
          <button
            type="button"
            className="btn-primary"
            onClick={handleUpload}
            disabled={!selectedFile || uploading}
          >
            {uploading ? (
              <>
                <span className="upload-spinner" />
                <span>Uploading...</span>
              </>
            ) : (
              'Start Upload'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
