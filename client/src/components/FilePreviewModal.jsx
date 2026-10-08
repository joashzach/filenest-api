import React, { useState, useEffect, useRef } from 'react';
import { getDownloadUrl } from '../services/FileApi';
import { X, FileText } from 'lucide-react';
import './FilePreviewModal.css';

/**
 * Detect file type by MIME or extension
 */
function detectFileType(file) {
  if (!file) return { type: 'unknown', ext: '' };
  const name = (file.originalName || file.name || '').toLowerCase();
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

  // Presentations: PPTX / PPT / Keynote
  if (
    ['pptx', 'ppt', 'pps', 'ppsx', 'odp'].includes(ext) ||
    mime.includes('presentation') ||
    mime.includes('powerpoint')
  ) {
    return { type: 'pptx', ext };
  }

  // Other Office documents (docx, doc, xlsx, xls)
  if (
    ['docx', 'doc', 'xlsx', 'xls', 'odt', 'ods', 'rtf'].includes(ext) ||
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
 * In-browser PPTX slide renderer powered by @aiden0z/pptx-renderer
 */
function PptxPreview({ url, fileName, onLoaded, onError }) {
  const containerRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState(null);

  useEffect(() => {
    let cancelled = false;
    let viewer = null;

    async function loadPresentation() {
      try {
        setLoading(true);
        setErrorMsg(null);

        const response = await fetch(url);
        if (!response.ok) throw new Error('Could not download presentation file');
        const buffer = await response.arrayBuffer();

        if (cancelled || !containerRef.current) return;

        const { PptxViewer, RECOMMENDED_ZIP_LIMITS } = await import('@aiden0z/pptx-renderer');
        if (cancelled || !containerRef.current) return;

        containerRef.current.innerHTML = '';
        viewer = await PptxViewer.open(buffer, containerRef.current, {
          zipLimits: RECOMMENDED_ZIP_LIMITS,
          fitMode: 'contain',
          renderMode: 'list',
          listOptions: {
            windowed: true,
            initialSlides: 4,
            batchSize: 4,
            showSlideLabels: true,
          },
        });

        if (cancelled) {
          viewer.destroy();
          return;
        }

        setLoading(false);
        onLoaded && onLoaded();
      } catch (err) {
        console.error('Failed to render presentation:', err);
        if (!cancelled) {
          setErrorMsg(err.message || 'Unable to render presentation slides');
          setLoading(false);
          onError && onError(err);
        }
      }
    }

    loadPresentation();

    return () => {
      cancelled = true;
      if (viewer) {
        try {
          viewer.destroy();
        } catch (e) {}
      }
    };
  }, [url]);

  return (
    <div className="preview-pptx-scroll">
      {loading && (
        <div className="preview-pptx-loading">
          <span className="file-card-spinner" />
          <span className="preview-status-text">Rendering presentation slides...</span>
        </div>
      )}
      {errorMsg ? (
        <div className="preview-office-container">
          <div className="preview-office-card">
            <FileText size={44} strokeWidth={1.5} className="preview-office-icon" />
            <div className="preview-office-meta">
              <span className="preview-office-name" title={fileName}>{fileName}</span>
              <span className="preview-office-badge">PPTX</span>
            </div>
            <p className="preview-office-hint">
              This presentation file cannot be rendered directly in the browser.
              Download the file to view it in its native application.
            </p>
          </div>
        </div>
      ) : (
        <div ref={containerRef} className="preview-pptx-slides" />
      )}
    </div>
  );
}

/**
 * FilePreviewModal — Displays files directly with loading feedback for all media types
 */
export default function FilePreviewModal({
  file,
  isOpen,
  onClose,
  onDownload,
  isDownloading = false,
}) {
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
        } else if (typeInfo.type === 'pdf' || typeInfo.type === 'pptx' || typeInfo.type === 'office') {
          // PDF, PPTX and Office files initialize immediately without blocking text decode
          setContentLoaded(true);
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

    return () => {
      controller.abort();
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
            ref={(img) => {
              if (img && img.complete && img.naturalWidth > 0 && !contentLoaded) {
                setContentLoaded(true);
              }
            }}
            src={previewUrl}
            alt={file.originalName || file.name || 'Image preview'}
            className={`preview-image ${contentLoaded ? 'ready' : 'loading'}`}
            onLoad={() => setContentLoaded(true)}
            onError={() => setError(true)}
          />
        );

      case 'pdf':
        return (
          <div className="preview-pdf-wrapper">
            <object
              data={`${previewUrl}#toolbar=1`}
              type="application/pdf"
              className="preview-pdf-object"
              title={file.originalName || file.name || 'PDF Document'}
            >
              <iframe
                src={`${previewUrl}#toolbar=1`}
                className="preview-frame ready"
                title={file.originalName || file.name || 'PDF Document'}
              />
            </object>
          </div>
        );

      case 'pptx':
        return (
          <PptxPreview
            url={previewUrl}
            fileName={file.originalName || file.name}
            onLoaded={() => setContentLoaded(true)}
            onError={() => setError(true)}
          />
        );

      case 'office':
        return (
          <div className="preview-office-container">
            <div className="preview-office-card">
              <FileText size={44} strokeWidth={1.5} className="preview-office-icon" />
              <div className="preview-office-meta">
                <span className="preview-office-name" title={file.originalName || file.name}>
                  {file.originalName || file.name}
                </span>
                <span className="preview-office-badge">
                  {(typeInfo.ext || 'doc').toUpperCase()}
                </span>
              </div>
              <p className="preview-office-hint">
                This format can't be rendered directly in the browser.
                Download the file to view it in its native application.
              </p>
            </div>
          </div>
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
        return (
          <div className="preview-office-container">
            <div className="preview-office-card">
              <FileText size={44} strokeWidth={1.5} className="preview-office-icon" />
              <div className="preview-office-meta">
                <span className="preview-office-name" title={file.originalName || file.name}>
                  {file.originalName || file.name}
                </span>
                <span className="preview-office-badge">
                  {(typeInfo.ext || 'FILE').toUpperCase()}
                </span>
              </div>
              <p className="preview-office-hint">
                Direct in-browser preview is not available for this file type.
              </p>
            </div>
          </div>
        );
    }
  }

  const showLoadingOverlay = !error && !contentLoaded && typeInfo.type !== 'unknown';

  return (
    <div className="preview-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div
        className="preview-modal"
        ref={modalRef}
        onClick={(e) => e.stopPropagation()}
        aria-label={file.originalName || file.name || 'File Preview'}
      >
        {/* Header: Filename + Action buttons + X close button */}
        <div className="preview-header">
          <h2 className="preview-filename" title={file.originalName || file.name || 'File'}>
            {file.originalName || file.name || 'File'}
          </h2>
          <div className="preview-header-actions">
            <button
              ref={closeButtonRef}
              className="preview-close-btn"
              onClick={onClose}
              aria-label="Close"
            >
              <X size={16} strokeWidth={1.5} />
            </button>
          </div>
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
