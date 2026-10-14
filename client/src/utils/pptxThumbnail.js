const pptxBufferCache = new Map(); // url -> Promise<ArrayBuffer>

/**
 * Render first slide of PPTX into targetContainer using PptxViewer single slide mode.
 */
export async function renderPptxFirstSlide(url, targetContainer) {
  if (!url || !targetContainer) return null;

  try {
    let bufferPromise = pptxBufferCache.get(url);
    if (!bufferPromise) {
      bufferPromise = fetch(url).then((res) => {
        if (!res.ok) throw new Error('Could not fetch PPTX');
        return res.arrayBuffer();
      });
      pptxBufferCache.set(url, bufferPromise);
    }

    const buffer = await bufferPromise;

    const { PptxViewer } = await import('@aiden0z/pptx-renderer');

    targetContainer.innerHTML = '';

    const containerW = targetContainer.clientWidth || targetContainer.parentElement?.clientWidth || 280;
    const containerH = targetContainer.clientHeight || targetContainer.parentElement?.clientHeight || 196;
    const coverWidth = Math.max(280, containerW, Math.round(containerH * (16 / 9)));

    // Try rendering with generous limits first
    try {
      const viewer = await PptxViewer.open(buffer, targetContainer, {
        zipLimits: {
          maxEntries: 10000,
          maxTotalBytes: 300 * 1024 * 1024,
          maxEntryBytes: 150 * 1024 * 1024,
        },
        fitMode: 'contain',
        renderMode: 'slide',
        width: coverWidth,
      });
      return viewer;
    } catch (innerErr) {
      console.warn('PPTX render with limits failed, retrying without zipLimits:', innerErr);
      const viewer = await PptxViewer.open(buffer, targetContainer, {
        fitMode: 'contain',
        renderMode: 'slide',
        width: coverWidth,
      });
      return viewer;
    }
  } catch (err) {
    console.error('PPTX thumbnail render failed:', err);
    pptxBufferCache.delete(url);
    return null;
  }
}

