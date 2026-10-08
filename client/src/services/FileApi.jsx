import { request } from './api';

/**
 * File management API service
 */

export async function getFiles() {
  return request('/files', { auth: true });
}

export async function getUploadUrl({ originalName, mimeType }) {
  return request('/files/upload-url', {
    method: 'POST',
    auth: true,
    body: { originalName, mimeType },
  });
}

/**
 * Direct storage upload using presigned PUT URL.
 * Uses XMLHttpRequest for reliable streaming transmission and precise real-time progress events.
 *
 * @param {string} presignedUrl - S3 presigned PUT URL
 * @param {File|Blob} file - File or Blob to upload
 * @param {function(number, number, number): void} [onProgress] - (percent, loadedBytes, totalBytes)
 * @param {string} [mimeType] - MIME type matching the signed URL
 */
export function uploadToS3(presignedUrl, file, onProgress, mimeType) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', presignedUrl, true);

    const contentType = mimeType || file.type || 'application/octet-stream';
    xhr.setRequestHeader('Content-Type', contentType);

    if (xhr.upload && typeof onProgress === 'function') {
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable && event.total > 0) {
          const percent = Math.min(100, Math.round((event.loaded / event.total) * 100));
          onProgress(percent, event.loaded, event.total);
        }
      };
    }

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        if (typeof onProgress === 'function') {
          onProgress(100, file.size, file.size);
        }
        resolve();
      } else {
        reject(
          new Error(
            `Failed to upload file to storage (status ${xhr.status}). Please try again.`
          )
        );
      }
    };

    xhr.onerror = () => {
      reject(new Error('Network error during file upload. Please check your internet connection.'));
    };

    xhr.ontimeout = () => {
      reject(new Error('Upload timed out. Please try again.'));
    };

    xhr.send(file);
  });
}

export async function confirmUpload({ originalName, mimeType, size, key, folder }) {
  return request('/files/upload-confirm', {
    method: 'POST',
    auth: true,
    body: { originalName, mimeType, size, key, folder: folder || null },
  });
}

export async function getDownloadUrl(fileId) {
  return request(`/files/download-url/${fileId}`, { auth: true });
}

export async function deleteFile(fileId) {
  return request(`/files/${fileId}`, {
    method: 'DELETE',
    auth: true,
  });
}

/**
 * Move a file to a different folder, or to root (folder: null)
 */
export async function moveFile(fileId, folderId) {
  return request(`/files/${fileId}/move`, {
    method: 'PATCH',
    auth: true,
    body: { folder: folderId || null },
  });
}

/**
 * Rename a file
 */
export async function renameFile(fileId, name) {
  return request(`/files/${fileId}/rename`, {
    method: 'PATCH',
    auth: true,
    body: { name },
  });
}
