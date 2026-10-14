import { getDownloadUrl } from '../services/FileApi';

const urlCache = new Map(); // fileId -> Promise<string | null>

/**
 * Deduplicated, in-memory cached presigned download/view URL provider
 */
export function getCachedDownloadUrl(fileId) {
  if (!fileId) return Promise.resolve(null);

  if (urlCache.has(fileId)) {
    return urlCache.get(fileId);
  }

  const promise = getDownloadUrl(fileId)
    .then((res) => {
      const url = res.data?.result || res.result;
      return url || null;
    })
    .catch((err) => {
      console.warn('Failed to get download URL for preview:', err);
      // Remove failed promise so it can be retried later
      urlCache.delete(fileId);
      return null;
    });

  urlCache.set(fileId, promise);
  return promise;
}
