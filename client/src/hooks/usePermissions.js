import { useMemo } from 'react';
import { useAuth } from '../context/AuthContext';

/**
 * usePermissions(item, itemType?)
 *
 * Derives the caller's effective permissions for a file or folder item.
 *
 * item shape expected:
 *   - owner: string | { _id: string } | ObjectId   (required)
 *   - myPermission: 'owner' | 'editor' | 'viewer'  (returned by backend on shared items)
 *   - permission: 'owner' | 'editor' | 'viewer'    (alias used by sharedWithMe)
 *   - inherited: boolean                            (from sharedWithMe)
 *   - inheritedFrom: { id, name } | null
 *
 * Returns:
 *   {
 *     role,            // 'owner' | 'editor' | 'viewer' | null
 *     isOwner,
 *     isEditor,
 *     isViewer,
 *     inherited,       // true if access comes from an ancestor folder
 *     inheritedFrom,   // { id, name } | null
 *     canOpen,
 *     canDownload,
 *     canRename,
 *     canMove,
 *     canDelete,
 *     canShare,        // manage sharing
 *     canLeave,        // remove own direct grant (non-owner with direct grant)
 *     canUploadInto,   // upload files into this folder
 *   }
 */
export function usePermissions(item) {
  const { user } = useAuth();

  return useMemo(() => {
    const NONE = {
      role: null,
      isOwner: false,
      isEditor: false,
      isViewer: false,
      isSharedWithMe: false,
      inherited: false,
      inheritedFrom: null,
      canOpen: false,
      canDownload: false,
      canRename: false,
      canMove: false,
      canDelete: false,
      canShare: false,
      canLeave: false,
      canUploadInto: false,
    };

    if (!item || !user) return NONE;

    const userId = user._id?.toString() || user.id?.toString();
    if (!userId) return NONE;

    // Resolve owner id from different shapes
    const ownerId =
      typeof item.owner === 'object' && item.owner !== null
        ? (item.owner._id || item.owner.id || '').toString()
        : String(item.owner || '');

    const ownerEmail =
      typeof item.owner === 'object' && item.owner !== null
        ? item.owner.email
        : (typeof item.owner === 'string' && item.owner.includes('@') ? item.owner : null);

    const isOwnerByRef = Boolean(
      (userId && ownerId && ownerId === userId) ||
      (user.email && ownerEmail && ownerEmail.toLowerCase() === user.email.toLowerCase())
    );

    // Role: prefer explicit myPermission/permission field from backend;
    // fall back to checking if we're the owner by id.
    const backendRole = item.myPermission || item.permission || null;
    let role = backendRole;
    if (!role && isOwnerByRef) role = 'owner';
    if (!role && !isOwnerByRef && (ownerId || ownerEmail)) {
      role = 'editor';
    }

    const inherited = Boolean(item.inherited);
    const inheritedFrom = item.inheritedFrom || null;

    const isOwner = role === 'owner' || isOwnerByRef;
    const isEditor = role === 'editor';
    const isViewer = role === 'viewer';

    // If we have no role at all, no access
    if (!role) return NONE;

    // Has a direct grant (not purely inherited)
    // For owner this doesn't apply.
    const hasDirectGrant = isOwner || !inherited;

    const isSharedWithMe = !isOwner && Boolean(
      role ||
      backendRole ||
      item.permission ||
      item.myPermission ||
      item.inherited ||
      (ownerId && ownerId !== userId) ||
      (ownerEmail && user.email && ownerEmail.toLowerCase() !== user.email.toLowerCase())
    );

    return {
      role,
      isOwner,
      isEditor,
      isViewer,
      isSharedWithMe,
      inherited,
      inheritedFrom,

      // Everyone with any role can open/download
      canOpen: true,
      canDownload: true,

      // Owner or editor can rename
      canRename: isOwner || isEditor,

      // Owner can move anywhere; editor can move within shared tree only
      canMove: isOwner || isEditor,

      // Owner or editor can delete
      canDelete: isOwner || isEditor,

      // Only owner can share / manage access
      canShare: isOwner,

      // Non-owners with a direct grant can leave
      canLeave: !isOwner && hasDirectGrant,

      // Owner or editor can upload into this folder
      canUploadInto: isOwner || isEditor,
    };
  }, [item, user]);
}

export default usePermissions;
