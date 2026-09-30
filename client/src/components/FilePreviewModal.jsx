import React, { useState, useEffect, useRef } from 'react';
import { getDownloadUrl } from '../services/FileApi';
import { X, File, Music } from 'lucide-react';
import './FilePreviewModal.css';

/**
 * Detect file type by MIME or extension (supporting binary/octet-stream fallbacks)
 */
function detectFileType(file) {
  if (!file) return { type: 'unknown' };
  const name = (file.originalName || '').toLowerCase();
  const ext = name.split('.').pop() || '';
  const mime = (file.mimeType || '').toLowerCase();

  // Images
  if (
    ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext) ||
    mime.startsWith('image/')
  ) {
    return { type: 'image', ext };
  }

  // PDF
  if (ext === 'pdf' || mime === 'application/pdf') {
    return { type: 'pdf', ext };
  }

  // Video
  if (['mp4', 'webm'].includes(ext) || mime === 'video/mp4' || mime === 'video/webm') {
    return { type: 'video', ext };
  }

  // Audio
  if (
    ['mp3', 'wav', 'ogg', 'm4a'].includes(ext) ||
    ['audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/mp4', 'audio/x-m4a'].includes(mime)
  ) {
    return { type: 'audio', ext };
  }

  // Text & Code
  const textExtensions = [
    'txt', 'md', 'csv', 'json', 'log', 'js', 'jsx', 'ts', 'tsx',
    'html', 'css', 'xml', 'yaml', 'yml', 'py', 'java', 'c', 'cpp',
    'h', 'hpp', 'cs', 'go', 'rs', 'php', 'rb', 'sh', 'bash', 'zsh',
    'sql', 'env', 'ini', 'toml', 'dockerfile', 'gitignore'
  ];
  if (
    textExtensions.includes(ext) ||
    mime.startsWith('text/') ||
    mime === 'application/json' ||
    mime === 'application/javascript'
  ) {
    return { type: 'text', ext };
  }

  // Everything else (docx, xlsx, pptx, zip, unknown)
  return { type: 'unknown', ext };
}

/**
 * FilePreviewModal — Fixed 520px x 440px modal with header filename + X,
 * contained preview area, and no extra text or buttons.
 */
export default function FilePreviewModal({ file, isOpen, onClose }) {
  const [previewUrl, setPreviewUrl] = useState(null);
  const [textContent, setTextContent] = useState(null);
  const [isTruncated, setIsTruncated] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  const modalRef = useRef(null);
  const closeButtonRef = useRef(null);
  const previousActiveElementRef = useRef(null);

  // Focus trapping & Escape key
  useEffect(() => {
    if (isOpen) {
      previousActiveElementRef.current = document.activeElement;
      // Focus close button initially
      setTimeout(() => {
        closeButtonRef.current?.focus();
      }, 0);

      function handleKeyDown(e) {
        if (e.key === 'Escape') {
          e.preventDefault();
          onClose();
          return;
        }

        if (e.key === 'Tab' && modalRef.current) {
          const focusables = modalRef.current.querySelectorAll(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"]), iframe, audio, video'
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
      return () => {
        window.removeEventListener('keydown', handleKeyDown);
        if (previousActiveElementRef.current && typeof previousActiveElementRef.current.focus === 'function') {
          previousActiveElementRef.current.focus();
        }
      };
    }
  }, [isOpen, onClose]);

  // Load preview data & abort on close/unmount
  useEffect(() => {
    if (!isOpen || !file) {
      setPreviewUrl(null);
      setTextContent(null);
      setLoading(false);
      setError(false);
      setIsTruncated(false);
      return;
    }

    const controller = new AbortController();
    setLoading(true);
    setError(false);
    setPreviewUrl(null);
    setTextContent(null);
    setIsTruncated(false);

    getDownloadUrl(file._id)
      .then(async (res) => {
        if (controller.signal.aborted) return;
        const url = res.data?.result;
        if (!url) throw new Error('No URL returned');
        setPreviewUrl(url);

        const typeInfo = detectFileType(file);
        if (typeInfo.type === 'text') {
          const response = await fetch(url, { signal: controller.signal });
          if (!response.ok) throw new Error('Failed to fetch text content');
          const blob = await response.blob();
          const MAX_BYTES = 200 * 1024; // 200 KB
          const truncated = blob.size > MAX_BYTES;
          const slice = truncated ? blob.slice(0, MAX_BYTES) : blob;
          const text = await slice.text();
          if (!controller.signal.aborted) {
            setTextContent(text);
            setIsTruncated(truncated);
          }
        }
      })
      .catch((err) => {
        if (err.name !== 'AbortError' && !controller.signal.aborted) {
          setError(true);
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      });

    return () => {
      controller.abort();
    };
  }, [file, isOpen]);

  if (!isOpen || !file) return null;

  const typeInfo = detectFileType(file);

  function renderContent() {
    if (loading) {
      return <span className="preview-status-text">Loading preview</span>;
    }

    if (error || !previewUrl) {
      return <span className="preview-status-text">Couldn't load preview.</span>;
    }

    switch (typeInfo.type) {
      case 'image':
        return (
          <img
            src={previewUrl}
            alt={file.originalName}
            className="preview-image"
          />
        );

      case 'pdf':
        return (
          <iframe
            src={`${previewUrl}#toolbar=0`}
            className="preview-pdf-frame"
            title={file.originalName}
          />
        );

      case 'video':
        return (
          <video
            src={previewUrl}
            controls
            className="preview-video"
          />
        );

      case 'audio':
        return (
          <div className="preview-audio-container">
            <Music size={32} strokeWidth={1.5} className="preview-audio-icon" />
            <audio src={previewUrl} controls className="preview-audio-player" />
          </div>
        );

      case 'text':
        return (
          <div className="preview-text-scroll">
            <pre className="preview-text-pre">{textContent ?? ''}</pre>
            {isTruncated && (
              <div className="preview-text-truncation-note">
                Showing the first 200 KB
              </div>
            )}
          </div>
        );

      default:
        // Everything else (docx, xlsx, pptx, zip, unknown)
        return (
          <div className="preview-fallback-container">
            <File size={32} strokeWidth={1.5} className="preview-fallback-icon" />
            <span className="preview-fallback-text">No preview available</span>
          </div>
        );
    }
  }

  return (
    <div className="preview-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div
        className="preview-modal"
        ref={modalRef}
        onClick={(e) => e.stopPropagation()}
        aria-label={file.originalName}
      >
        {/* Header: Filename only + 28px X button */}
        <div className="preview-header">
          <h2 className="preview-filename" title={file.originalName}>
            {file.originalName}
          </h2>
          <button
            ref={closeButtonRef}
            className="preview-close-btn"
            onClick={onClose}
            aria-label="Close"
          >
            <X size={16} strokeWidth={1.5} />
          </button>
        </div>

        {/* Preview Area: 14px below header, #0c0c0d, 1px #202124 border, 8px radius */}
        <div className="preview-area">
          {renderContent()}
        </div>
      </div>
    </div>
  );
}
