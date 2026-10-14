import * as pdfjsLib from 'pdfjs-dist';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.mjs?url';

// Set worker source
if (typeof window !== 'undefined') {
  try {
    if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
      pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;
    }
  } catch (e) {}
}

export { pdfjsLib };

const pdfThumbCache = new Map();

/**
 * Render first page of PDF as data URL
 */
export async function renderPdfFirstPage(url, maxWidth = 340) {
  if (!url) return null;
  if (pdfThumbCache.has(url)) {
    return pdfThumbCache.get(url);
  }

  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Failed to fetch PDF: ${response.status}`);
    const arrayBuffer = await response.arrayBuffer();

    const version = pdfjsLib.version || '6.4.299';
    const loadingTask = pdfjsLib.getDocument({
      data: new Uint8Array(arrayBuffer),
      cMapUrl: `https://cdn.jsdelivr.net/npm/pdfjs-dist@${version}/cmaps/`,
      cMapPacked: true,
      standardFontDataUrl: `https://cdn.jsdelivr.net/npm/pdfjs-dist@${version}/standard_fonts/`,
    });
    const pdf = await loadingTask.promise;
    const page = await pdf.getPage(1);

    const initialViewport = page.getViewport({ scale: 1 });
    const targetW = Math.max(280, maxWidth);
    const scale = targetW / (initialViewport.width || 280);
    const dpr = Math.min(typeof window !== 'undefined' ? (window.devicePixelRatio || 1) : 1, 2);
    const viewport = page.getViewport({ scale: scale * dpr });

    const canvas = document.createElement('canvas');
    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);
    const canvasContext = canvas.getContext('2d', { alpha: false });

    await page.render({
      canvasContext,
      viewport,
    }).promise;

    const dataUrl = canvas.toDataURL('image/jpeg', 0.88);
    pdfThumbCache.set(url, dataUrl);
    return dataUrl;
  } catch (err) {
    console.warn('PDF first page preview failed:', err);
    return null;
  }
}

