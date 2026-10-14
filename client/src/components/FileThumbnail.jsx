import React, { useState, useEffect, useRef } from 'react';
import { Play } from 'lucide-react';
import { getCachedDownloadUrl } from '../utils/previewCache';
import { renderPdfFirstPage } from '../utils/pdfThumbnail';
import { renderPptxFirstSlide } from '../utils/pptxThumbnail';
import './FileThumbnail.css';

/**
 * Categorize file extension for thumbnail display
 */
function getThumbnailCategory(file) {
  const name = (file?.originalName || file?.name || '').toLowerCase();
  const ext = name.split('.').pop() || '';
  const mime = (file?.mimeType || '').toLowerCase();

  if (
    ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'ico', 'avif'].includes(ext) ||
    mime.startsWith('image/')
  ) {
    return { kind: 'image', label: ext.toUpperCase(), ext: ext.toUpperCase() };
  }

  if (
    ['mp4', 'webm', 'mov', 'mkv', 'ogg', 'm4v', 'avi'].includes(ext) ||
    mime.startsWith('video/')
  ) {
    return { kind: 'video', label: 'VIDEO', ext: ext.toUpperCase() };
  }

  if (ext === 'pdf' || mime === 'application/pdf') {
    return { kind: 'pdf', label: 'PDF', ext: 'PDF' };
  }

  if (
    ['pptx', 'ppt', 'pps', 'ppsx', 'odp', 'key'].includes(ext) ||
    mime.includes('presentation') ||
    mime.includes('powerpoint')
  ) {
    return { kind: 'pptx', label: 'PPT', ext: ext.toUpperCase() };
  }

  if (
    ['docx', 'doc', 'rtf', 'odt', 'pages'].includes(ext) ||
    mime.includes('wordprocessingml') ||
    mime.includes('msword')
  ) {
    return { kind: 'doc', label: 'DOC', ext: ext.toUpperCase() };
  }

  if (
    ['xlsx', 'xls', 'csv', 'ods', 'tsv', 'numbers'].includes(ext) ||
    mime.includes('spreadsheetml') ||
    mime.includes('excel') ||
    mime === 'text/csv'
  ) {
    return { kind: 'sheet', label: 'XLS', ext: ext.toUpperCase() };
  }

  if (
    ['zip', 'rar', '7z', 'tar', 'gz', 'bz2'].includes(ext) ||
    mime.includes('zip') ||
    mime.includes('compressed') ||
    mime.includes('tar')
  ) {
    return { kind: 'archive', label: 'ZIP', ext: ext.toUpperCase() };
  }

  if (['mp3', 'wav', 'aac', 'flac', 'm4a'].includes(ext) || mime.startsWith('audio/')) {
    return { kind: 'audio', label: 'AUDIO', ext: ext.toUpperCase() };
  }

  const textExts = [
    'txt', 'md', 'json', 'js', 'jsx', 'ts', 'tsx', 'py', 'html', 'css',
    'c', 'cpp', 'cs', 'go', 'rs', 'java', 'sql', 'sh', 'yaml', 'yml', 'xml', 'env'
  ];
  if (textExts.includes(ext) || mime.startsWith('text/')) {
    return { kind: 'text', label: ext.toUpperCase(), ext: ext.toUpperCase() };
  }

  return { kind: 'other', label: ext ? ext.toUpperCase().slice(0, 4) : 'FILE', ext: ext.toUpperCase() || 'FILE' };
}

/**
 * Realistic Presentation Slide Card (for PPTX & fallbacks)
 */
function SlidePreviewCard({ file }) {
  const name = file?.originalName || file?.name || 'Presentation';
  return (
    <div className="file-thumb-slide-card" aria-hidden="true">
      <div className="file-thumb-slide-header">
        <span className="file-thumb-badge file-thumb-badge--pptx">PPTX</span>
      </div>
      <div className="file-thumb-slide-title">{name}</div>
      <div className="file-thumb-slide-body">
        <div className="file-thumb-slide-col">
          <div className="file-thumb-mock-line file-thumb-mock-line--accent" style={{ width: '65%' }} />
          <div className="file-thumb-mock-line" style={{ width: '85%' }} />
          <div className="file-thumb-mock-line" style={{ width: '45%' }} />
        </div>
        <div className="file-thumb-slide-col">
          <div className="file-thumb-mock-line" style={{ width: '90%' }} />
          <div className="file-thumb-mock-line" style={{ width: '70%' }} />
          <div className="file-thumb-mock-line" style={{ width: '50%' }} />
        </div>
      </div>
    </div>
  );
}

/**
 * Realistic Document Sheet (for PDF fallback & DOCX/DOC files)
 */
function DocSheetPreviewCard({ type = 'pdf', file }) {
  const name = file?.originalName || file?.name || 'Document';
  const isPdf = type === 'pdf';
  return (
    <div className="file-thumb-doc-sheet" aria-hidden="true">
      <span
        className={`file-thumb-doc-sheet-tag ${
          isPdf ? 'file-thumb-doc-sheet-tag--pdf' : 'file-thumb-doc-sheet-tag--docx'
        }`}
      >
        {isPdf ? 'PDF' : 'DOCX'}
      </span>
      <div className="file-thumb-doc-sheet-title">{name}</div>
      <div className="file-thumb-doc-sheet-lines">
        <div className="file-thumb-doc-line" style={{ width: '100%' }} />
        <div className="file-thumb-doc-line file-thumb-doc-line--medium" />
        <div className="file-thumb-doc-line file-thumb-doc-line--short" />
        <div className="file-thumb-doc-line" style={{ width: '92%', marginTop: 3 }} />
        <div className="file-thumb-doc-line file-thumb-doc-line--medium" />
      </div>
    </div>
  );
}

/**
 * Spreadsheet Table Grid Card (for XLSX, XLS, CSV)
 */
function SpreadsheetPreviewCard({ file }) {
  const ext = (file?.originalName || file?.name || '').split('.').pop()?.toUpperCase() || 'XLS';
  const name = file?.originalName || file?.name || 'Spreadsheet';
  return (
    <div className="file-thumb-sheet-card" aria-hidden="true">
      <div className="file-thumb-sheet-header-bar">
        <span className="file-thumb-badge file-thumb-badge--xlsx">{ext}</span>
        <span style={{ fontSize: 10, color: '#9ca3af', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 110 }}>
          {name}
        </span>
      </div>
      <div className="file-thumb-sheet-table">
        <div className="file-thumb-sheet-cell file-thumb-sheet-cell--th">#</div>
        <div className="file-thumb-sheet-cell file-thumb-sheet-cell--th">A</div>
        <div className="file-thumb-sheet-cell file-thumb-sheet-cell--th">B</div>
        <div className="file-thumb-sheet-cell file-thumb-sheet-cell--th">C</div>

        <div className="file-thumb-sheet-cell file-thumb-sheet-cell--th">1</div>
        <div className="file-thumb-sheet-cell">Item</div>
        <div className="file-thumb-sheet-cell">Status</div>
        <div className="file-thumb-sheet-cell">Total</div>

        <div className="file-thumb-sheet-cell file-thumb-sheet-cell--th">2</div>
        <div className="file-thumb-sheet-cell">Alpha</div>
        <div className="file-thumb-sheet-cell" style={{ color: '#34d399' }}>Active</div>
        <div className="file-thumb-sheet-cell">42,800</div>

        <div className="file-thumb-sheet-cell file-thumb-sheet-cell--th">3</div>
        <div className="file-thumb-sheet-cell">Beta</div>
        <div className="file-thumb-sheet-cell" style={{ color: '#60a5fa' }}>Done</div>
        <div className="file-thumb-sheet-cell">19,500</div>
      </div>
    </div>
  );
}

/**
 * Live Code & Text Snippet Window (for code/text files)
 */
function CodePreviewCard({ file, text }) {
  const ext = (file?.originalName || file?.name || '').split('.').pop()?.toUpperCase() || 'TXT';
  const lines = text
    ? text.split('\n').filter(Boolean).slice(0, 5).map((l) => l.slice(0, 34))
    : null;

  return (
    <div className="file-thumb-code-card" aria-hidden="true">
      <div className="file-thumb-code-header">
        <div className="file-thumb-code-dots">
          <span className="file-thumb-dot file-thumb-dot--red" />
          <span className="file-thumb-dot file-thumb-dot--yellow" />
          <span className="file-thumb-dot file-thumb-dot--green" />
        </div>
        <span className="file-thumb-code-lang">{ext}</span>
      </div>
      <div className="file-thumb-code-body">
        {lines && lines.length > 0 ? (
          lines.map((line, idx) => (
            <div key={idx} className="file-thumb-code-row">
              <span className="file-thumb-code-num">{idx + 1}</span>
              <span className="file-thumb-code-text">{line}</span>
            </div>
          ))
        ) : (
          <>
            <div className="file-thumb-code-row">
              <span className="file-thumb-code-num">1</span>
              <span className="file-thumb-code-text" style={{ color: '#c084fc' }}>import</span>
              <span className="file-thumb-code-text"> {'{ config }'} </span>
              <span className="file-thumb-code-text" style={{ color: '#c084fc' }}>from</span>
              <span className="file-thumb-code-text" style={{ color: '#34d399' }}> './main'</span>
            </div>
            <div className="file-thumb-code-row">
              <span className="file-thumb-code-num">2</span>
              <span className="file-thumb-code-text" style={{ color: '#60a5fa' }}>export</span>
              <span className="file-thumb-code-text"> default handler;</span>
            </div>
            <div className="file-thumb-code-row">
              <span className="file-thumb-code-num">3</span>
              <span className="file-thumb-code-text" style={{ color: '#fb923c' }}>return</span>
              <span className="file-thumb-code-text"> init();</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/**
 * Audio Waveform & Disc Card (for audio files)
 */
function AudioPreviewCard({ file }) {
  const ext = (file?.originalName || file?.name || '').split('.').pop()?.toUpperCase() || 'AUDIO';
  return (
    <div className="file-thumb-audio-stage" aria-hidden="true">
      <div className="file-thumb-audio-disc">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      </div>
      <div className="file-thumb-audio-waves">
        <span className="file-thumb-audio-bar" style={{ height: 14 }} />
        <span className="file-thumb-audio-bar" style={{ height: 26 }} />
        <span className="file-thumb-audio-bar" style={{ height: 36 }} />
        <span className="file-thumb-audio-bar" style={{ height: 20 }} />
        <span className="file-thumb-audio-bar" style={{ height: 32 }} />
        <span className="file-thumb-audio-bar" style={{ height: 18 }} />
        <span className="file-thumb-audio-bar" style={{ height: 12 }} />
      </div>
      <span className="file-thumb-badge file-thumb-badge--audio">{ext}</span>
    </div>
  );
}

/**
 * Archive Package Stage (for zip, rar, 7z, tar, etc.)
 */
function ArchivePreviewCard({ file }) {
  const ext = (file?.originalName || file?.name || '').split('.').pop()?.toUpperCase() || 'ZIP';
  return (
    <div className="file-thumb-archive-stage" aria-hidden="true">
      <div className="file-thumb-archive-icon-wrap">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
          <path d="m3.3 7 8.7 5 8.7-5" />
          <path d="M12 12v10" />
        </svg>
      </div>
      <span className="file-thumb-badge file-thumb-badge--archive">{ext}</span>
    </div>
  );
}

/**
 * Modern Tile for Generic / Other file types
 */
function GenericFileCard({ file, category }) {
  return (
    <div className="file-thumb-tile" aria-hidden="true">
      <svg
        width={38}
        height={46}
        viewBox="0 0 38 46"
        fill="none"
        className="file-thumb-doc-icon"
      >
        <path
          d="M24 2H6C3.79 2 2 3.79 2 6V40C2 42.21 3.79 44 6 44H32C34.21 44 36 42.21 36 40V14L24 2Z"
          stroke="#42444a"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M24 2V14H36"
          stroke="#42444a"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <text
          x="19"
          y="30"
          fill="#85878c"
          fontSize="9.5"
          fontWeight="600"
          fontFamily="Inter, -apple-system, sans-serif"
          textAnchor="middle"
          letterSpacing="0.4"
        >
          {category.label}
        </text>
      </svg>
      <span className="file-thumb-tile-ext">{category.ext}</span>
    </div>
  );
}

/**
 * FileThumbnail Component
 * Specialized high-fidelity visual cards for every file type in Grid View.
 */
export default function FileThumbnail({ file }) {
  const [downloadUrl, setDownloadUrl] = useState(null);
  const [pdfThumb, setPdfThumb] = useState(null);
  const [imgError, setImgError] = useState(false);
  const [textPreview, setTextPreview] = useState(null);
  const [hasPptxRendered, setHasPptxRendered] = useState(false);

  const containerRef = useRef(null);
  const pptxContainerRef = useRef(null);

  const category = getThumbnailCategory(file);

  // Reset file state when file prop changes
  useEffect(() => {
    setDownloadUrl(null);
    setPdfThumb(null);
    setImgError(false);
    setTextPreview(null);
    setHasPptxRendered(false);
  }, [file?._id]);

  // Fetch download URL for types that can load visual previews
  useEffect(() => {
    if (!file?._id) return;
    if (!['image', 'video', 'pdf', 'pptx', 'text'].includes(category.kind)) return;

    let active = true;

    getCachedDownloadUrl(file._id).then((url) => {
      if (active && url) {
        setDownloadUrl(url);
      }
    });

    return () => {
      active = false;
    };
  }, [file?._id, category.kind]);

  // PDF first page rendering
  useEffect(() => {
    if (category.kind !== 'pdf' || !downloadUrl) return;

    let active = true;

    renderPdfFirstPage(downloadUrl, 280).then((dataUrl) => {
      if (active && dataUrl) {
        setPdfThumb(dataUrl);
      }
    });

    return () => {
      active = false;
    };
  }, [category.kind, downloadUrl]);

  // PPTX first slide rendering
  useEffect(() => {
    if (category.kind !== 'pptx' || !downloadUrl || !pptxContainerRef.current) return;

    let cleanupInstance = null;
    let active = true;

    renderPptxFirstSlide(downloadUrl, pptxContainerRef.current).then((instance) => {
      if (active && instance) {
        cleanupInstance = instance;
        setHasPptxRendered(true);
      } else if (instance) {
        try { instance.destroy(); } catch (e) {}
      }
    });

    return () => {
      active = false;
      if (cleanupInstance) {
        try { cleanupInstance.destroy(); } catch (e) {}
      }
    };
  }, [category.kind, downloadUrl]);

  // Text / Code preview snippet fetching
  useEffect(() => {
    if (category.kind !== 'text' || !downloadUrl) return;

    let active = true;

    fetch(downloadUrl, { headers: { Range: 'bytes=0-800' } })
      .then((res) => (res.ok ? res.text() : ''))
      .then((txt) => {
        if (active && txt) {
          setTextPreview(txt);
        }
      })
      .catch(() => {});

    return () => {
      active = false;
    };
  }, [category.kind, downloadUrl]);

  return (
    <div ref={containerRef} className="file-thumb-container">
      {/* 1. Images */}
      {category.kind === 'image' && (
        downloadUrl && !imgError ? (
          <img
            src={downloadUrl}
            alt=""
            className="file-thumb-img"
            loading="lazy"
            onError={() => setImgError(true)}
          />
        ) : (
          <GenericFileCard file={file} category={category} />
        )
      )}

      {/* 2. Videos */}
      {category.kind === 'video' && (
        <div className="file-thumb-video-wrap">
          {downloadUrl ? (
            <video
              src={`${downloadUrl}#t=0.5`}
              preload="metadata"
              muted
              playsInline
              className="file-thumb-video"
            />
          ) : (
            <div className="file-thumb-tile" />
          )}
          <div className="file-thumb-play-overlay">
            <div className="file-thumb-play-btn">
              <Play size={18} fill="currentColor" strokeWidth={0} style={{ marginLeft: 2 }} />
            </div>
          </div>
        </div>
      )}

      {/* 3. PDFs (Live rendered first page or realistic Document Sheet) */}
      {category.kind === 'pdf' && (
        pdfThumb ? (
          <img
            src={pdfThumb}
            alt="PDF preview"
            className="file-thumb-img file-thumb-pdf-page"
          />
        ) : (
          <DocSheetPreviewCard type="pdf" file={file} />
        )
      )}

      {/* 4. PPTX (Live rendered first slide or realistic Presentation Slide Card) */}
      {category.kind === 'pptx' && (
        <div className="file-thumb-pptx-wrap">
          <div
            ref={pptxContainerRef}
            className="file-thumb-pptx-slides"
          />
          {!hasPptxRendered && (
            <div className="file-thumb-overlay-loading">
              <SlidePreviewCard file={file} />
            </div>
          )}
        </div>
      )}

      {/* 5. Word / DOCX Documents */}
      {category.kind === 'doc' && (
        <DocSheetPreviewCard type="docx" file={file} />
      )}

      {/* 6. Spreadsheets (XLSX, XLS, CSV) */}
      {category.kind === 'sheet' && (
        <SpreadsheetPreviewCard file={file} />
      )}

      {/* 7. Code & Text Files */}
      {category.kind === 'text' && (
        <CodePreviewCard file={file} text={textPreview} />
      )}

      {/* 8. Audio Files */}
      {category.kind === 'audio' && (
        <AudioPreviewCard file={file} />
      )}

      {/* 9. Archive Files (ZIP, RAR, etc.) */}
      {category.kind === 'archive' && (
        <ArchivePreviewCard file={file} />
      )}

      {/* 10. Generic / Other Files */}
      {category.kind === 'other' && (
        <GenericFileCard file={file} category={category} />
      )}
    </div>
  );
}

