import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { getAvatarColor, getInitial } from './SharedUsersCell';
import './OwnerCell.css';

/**
 * OwnerCell — renders owner profile picture and "me" (if logged in user is the creator/owner)
 * or owner profile picture and owner email (if not owner, e.g. files added by an editor).
 */
export default function OwnerCell({ item }) {
  const { user: currentUser } = useAuth();
  const [imgError, setImgError] = useState(false);

  const currentUserId = (currentUser?._id || currentUser?.id)?.toString();
  const itemOwner = item?.owner;
  const itemOwnerId =
    typeof itemOwner === 'object' && itemOwner !== null
      ? (itemOwner._id || itemOwner.id || '').toString()
      : String(itemOwner || '');

  const itemOwnerEmail =
    typeof itemOwner === 'object' && itemOwner !== null
      ? itemOwner.email
      : (typeof itemOwner === 'string' && itemOwner.includes('@') ? itemOwner : null);

  // Real ownership check: Does the item's creator/owner match the current user?
  const isCurrentUserOwner = Boolean(
    (currentUserId && itemOwnerId && itemOwnerId === currentUserId) ||
    (currentUser?.email && itemOwnerEmail && itemOwnerEmail.toLowerCase() === currentUser.email.toLowerCase()) ||
    (!itemOwner && !item?.inherited && item?.myPermission !== 'editor' && item?.myPermission !== 'viewer')
  );

  const photo = isCurrentUserOwner
    ? (currentUser?.avatar || currentUser?.photo || currentUser?.picture || currentUser?.profilePic || currentUser?.image || (typeof itemOwner === 'object' ? itemOwner?.avatar : null))
    : (typeof itemOwner === 'object' ? (itemOwner?.avatar || itemOwner?.photo || itemOwner?.picture || itemOwner?.profilePic || itemOwner?.image) : null);

  useEffect(() => {
    setImgError(false);
  }, [photo]);

  const ownerEmail = itemOwnerEmail || (typeof itemOwner === 'object' ? itemOwner?.name : null) || (itemOwnerId && !itemOwnerId.includes('@') ? null : itemOwnerId);
  const displayName = isCurrentUserOwner ? 'me' : (ownerEmail || 'Unknown');

  const fallbackLabel = isCurrentUserOwner
    ? (currentUser?.name || currentUser?.email || 'me')
    : (displayName || 'Unknown');

  const initial = getInitial(fallbackLabel);
  const bgColor = getAvatarColor(fallbackLabel);

  const tooltipTitle = isCurrentUserOwner ? 'Owned by me' : (displayName ? `Owned by ${displayName}` : 'Unknown');

  return (
    <div
      className="filelist-col filelist-col-owner"
      title={tooltipTitle}
    >
      <span
        className="filelist-owner-avatar"
        style={!photo || imgError ? { backgroundColor: bgColor } : undefined}
      >
        {photo && !imgError ? (
          <img
            src={photo}
            alt=""
            className="filelist-owner-img"
            onError={() => setImgError(true)}
          />
        ) : (
          initial
        )}
      </span>
      <span className="filelist-owner-name">{displayName}</span>
    </div>
  );
}
