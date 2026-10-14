import { request } from './api';

/**
 * ShareApi — all sharing-related API calls for FileNest
 */

/**
 * Look up a user by their exact email address.
 * Returns { _id, name, email } or throws 404.
 */
export async function lookupUserByEmail(email) {
  return request('/users/lookup-by-email', {
    method: 'POST',
    auth: true,
    body: { email: email.trim().toLowerCase() },
  });
}

// ── FILE SHARING ──────────────────────────────────────────────────────────────

/**
 * Share a file with a user by their MongoDB _id.
 * @param {string} fileId
 * @param {string} userId  - recipient's _id
 * @param {'viewer'|'editor'} permission
 */
export async function shareFile(fileId, userId, permission) {
  return request(`/files/${fileId}/share`, {
    method: 'POST',
    auth: true,
    body: { userId, permission },
  });
}

/**
 * Get the current share grants for a file (owner only).
 * Returns { grants: [{userId, name, email, role}], myPermission }
 */
export async function getFileShareGrants(fileId) {
  return request(`/files/${fileId}/share`, { auth: true });
}

/**
 * Revoke a specific user's direct share on a file (owner only).
 */
export async function revokeFileShare(fileId, userId) {
  return request(`/files/${fileId}/share/${userId}`, {
    method: 'DELETE',
    auth: true,
  });
}

/**
 * Leave a file share (grantee removes their own direct grant).
 * Returns { stillHasAccess, throughFolder }
 */
export async function leaveFileShare(fileId) {
  return request(`/files/${fileId}/share/me`, {
    method: 'DELETE',
    auth: true,
  });
}

// ── FOLDER SHARING ────────────────────────────────────────────────────────────

/**
 * Share a folder with a user by their MongoDB _id.
 */
export async function shareFolder(folderId, userId, permission) {
  return request(`/folders/${folderId}/share`, {
    method: 'POST',
    auth: true,
    body: { userId, permission },
  });
}

/**
 * Get the current share grants for a folder (owner only).
 * Returns { grants: [{userId, name, email, role}], myPermission }
 */
export async function getFolderShareGrants(folderId) {
  return request(`/folders/${folderId}/share`, { auth: true });
}

/**
 * Revoke a specific user's direct share on a folder (owner only).
 */
export async function revokeFolderShare(folderId, userId) {
  return request(`/folders/${folderId}/share/${userId}`, {
    method: 'DELETE',
    auth: true,
  });
}

/**
 * Leave a folder share (grantee removes their own direct grant).
 * Returns { stillHasAccess, throughFolder }
 */
export async function leaveFolderShare(folderId) {
  return request(`/folders/${folderId}/share/me`, {
    method: 'DELETE',
    auth: true,
  });
}

// ── SHARED VIEWS ──────────────────────────────────────────────────────────────

/**
 * Get items shared with the current user.
 * Returns { files, folders } — each item has permission, inherited, inheritedFrom, owner
 */
export async function getSharedWithMe() {
  return request('/files/shared-with-me', { auth: true });
}

/**
 * Get items the current user has shared with others.
 * Returns { files, folders } — each item has granteeCount
 */
export async function getSharedByMe() {
  return request('/files/shared-by-me', { auth: true });
}
