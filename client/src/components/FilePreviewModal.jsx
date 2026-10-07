import React, { useState, useEffect, useRef } from 'react';
import { getDownloadUrl } from '../services/FileApi';
import { X } from 'lucide-react';
import './FilePreviewModal.css';

/**
 * Detect file type by MIME or extension
 */
function detectFileType(file) {
  if (!file) return { type: 'unknown', ext: '' };
  const name = (file.originalName || '').toLowerCase();
  const ext = name.split('.').pop() || '';
  const mime = (file.mimeType || '').toLowerCase();

  // Images
  if (
    ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'ico', 'avif'].includes(ext) ||
    mime.startsWith('image/')
  ) {
    return { type: 'image', ext };
  }

  // PDF
  if (ext === 'pdf' || mime === 'application/pdf') {
    return { type: 'pdf', ext };
  }

  // Presentations & Office documents (pptx, ppt, docx, doc, xlsx, xls)
  if (
    ['pptx', 'ppt', 'docx', 'doc', 'xlsx', 'xls'].includes(ext) ||
    mime.includes('presentation') ||
    mime.includes('powerpoint') ||
    mime.includes('wordprocessingml') ||
    mime.includes('spreadsheetml')
  ) {
    return { type: 'office', ext };
  }

  // Video
  if (
    ['mp4', 'webm', 'ogg', 'mov', 'mkv', 'm4v'].includes(ext) ||
    mime.startsWith('video/')
  ) {
    return { type: 'video', ext };
  }

  // Audio
  if (
    ['mp3', 'wav', 'ogg', 'm4a', 'aac', 'flac'].includes(ext) ||
    mime.startsWith('audio/')
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

  return { type: 'unknown', ext };
}

/**
 * FilePreviewModal — Displays files directly with loading feedback for all media types
 */
export default function FilePreviewModal({ file, isOpen, onClose }) {
  const [previewUrl, setPreviewUrl] = useState(null);
  const [textContent, setTextContent] = useState(null);
  const [isTruncated, setIsTruncated] = useState(false);
  const [urlLoading, setUrlLoading] = useState(false);
  const [contentLoaded, setContentLoaded] = useState(false);
  const [error, setError] = useState(false);

  const modalRef = useRef(null);
  const closeButtonRef = useRef(null);
  const previousActiveElementRef = useRef(null);

  // Focus trapping & Escape key
  useEffect(() => {
    if (isOpen) {
      previousActiveElementRef.current = document.activeElement;
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
        if (
          previousActiveElementRef.current &&
          typeof previousActiveElementRef.current.focus === 'function'
        ) {
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
      setUrlLoading(false);
      setContentLoaded(false);
      setError(false);
      setIsTruncated(false);
      return;
    }

    const controller = new AbortController();
    setUrlLoading(true);
    setContentLoaded(false);
    setError(false);
    setPreviewUrl(null);
    setTextContent(null);
    setIsTruncated(false);

    getDownloadUrl(file._id)
      .then(async (res) => {
        if (controller.signal.aborted) return;
        const url = res.data?.result || res.result;
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
            setContentLoaded(true);
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
          setUrlLoading(false);
        }
      });

    // Safety timeout: If content is still not marked loaded after 14s, hide the overlay
    const safetyTimer = setTimeout(() => {
      setContentLoaded((curr) => {
        if (!curr) return true;
        return curr;
      });
    }, 14000);

    return () => {
      controller.abort();
      clearTimeout(safetyTimer);
    };
  }, [file, isOpen]);

  if (!isOpen || !file) return null;

  const typeInfo = detectFileType(file);

  function renderMedia() {
    if (error || (!urlLoading && !previewUrl)) {
      return <span className="preview-fallback-text">No preview available</span>;
    }

    if (!previewUrl) return null;

    switch (typeInfo.type) {
      case 'image':
        return (
          <img
            src={previewUrl}
            alt={file.originalName}
            className={`preview-image ${contentLoaded ? 'ready' : 'loading'}`}
            onLoad={() => setContentLoaded(true)}
            onError={() => setError(true)}
          />
        );

      case 'pdf':
        return (
          <iframe
            src={`${previewUrl}#toolbar=0`}
            className={`preview-frame ${contentLoaded ? 'ready' : 'loading'}`}
            title={file.originalName}
            onLoad={() => setContentLoaded(true)}
            onError={() => setError(true)}
          />
        );

      case 'office':
        return (
          <iframe
            src={`https://docs.google.com/viewer?url=${encodeURIComponent(previewUrl)}&embedded=true`}
            className={`preview-frame ${contentLoaded ? 'ready' : 'loading'}`}
            title={file.originalName}
            allow="autoplay; fullscreen"
            loading="eager"
            onLoad={() => setContentLoaded(true)}
            onError={() => setError(true)}
          />
        );

      case 'video':
        return (
          <video
            src={previewUrl}
            controls
            playsInline
            className={`preview-video ${contentLoaded ? 'ready' : 'loading'}`}
            onLoadedData={() => setContentLoaded(true)}
            onCanPlay={() => setContentLoaded(true)}
            onError={() => setError(true)}
          />
        );

      case 'audio':
        return (
          <audio
            src={previewUrl}
            controls
            className={`preview-audio-player ${contentLoaded ? 'ready' : 'loading'}`}
            onLoadedData={() => setContentLoaded(true)}
            onCanPlay={() => setContentLoaded(true)}
            onError={() => setError(true)}
          />
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
        return <span className="preview-fallback-text">No preview available</span>;
    }
  }

  const showLoadingOverlay = !error && !contentLoaded && typeInfo.type !== 'unknown';

  return (
    <div className="preview-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div
        className="preview-modal"
        ref={modalRef}
        onClick={(e) => e.stopPropagation()}
        aria-label={file.originalName}
      >
        {/* Header: Filename only + X close button */}
        <div className="preview-header">
          <h2 className="preview-filename" title={file.originalName || file.name || 'File'}>
            {file.originalName || file.name || 'File'}
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

        {/* Preview Area: Contained direct view */}
        <div className="preview-area">
          {showLoadingOverlay && (
            <div className="preview-loading-overlay">
              <span className="file-card-spinner" />
              <span className="preview-status-text">Loading preview...</span>
            </div>
          )}
          {renderMedia()}
        </div>
      </div>
    </div>
  );
}
