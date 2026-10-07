import { request } from './api';

/**
 * Folder management API service
 */

/**
 * Get root-level contents (folders + files at root)
 */
export async function getRootContents() {
  return request('/folders/contents', { auth: true });
}

/**
 * Get contents of a specific folder (folders + files inside it)
 */
export async function getFolderContents(folderId) {
  return request(`/folders/${folderId}/contents`, { auth: true });
}

/**
 * Create a new folder
 * @param {string} name - Folder name
 * @param {string|null} parent - Parent folder ID, or null for root
 */
export async function createFolder({ name, parent }) {
  return request('/folders', {
    method: 'POST',
    auth: true,
    body: { name, parent: parent || null },
  });
}

/**
 * Rename an existing folder
 */
export async function renameFolder(folderId, name) {
  return request(`/folders/${folderId}`, {
    method: 'PATCH',
    auth: true,
    body: { name },
  });
}

/**
 * Delete a folder and all its nested contents (permanent)
 */
export async function deleteFolder(folderId) {
  return request(`/folders/${folderId}`, {
    method: 'DELETE',
    auth: true,
  });
}
