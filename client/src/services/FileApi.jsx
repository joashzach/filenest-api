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

export async function uploadToS3(presignedUrl, file) {
  const response = await fetch(presignedUrl, {
    method: 'PUT',
    body: file,
    headers: {
      'Content-Type': file.type,
    },
  });
  if (!response.ok) {
    throw new Error('Failed to upload file to storage. Please try again.');
  }
}

export async function confirmUpload({ originalName, mimeType, size, key }) {
  return request('/files/upload-confirm', {
    method: 'POST',
    auth: true,
    body: { originalName, mimeType, size, key },
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
