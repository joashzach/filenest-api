import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  ChevronDown,
  Loader,
  AlertCircle,
  FolderSymlink,
} from 'lucide-react';
import {
  lookupUserByEmail,
  shareFile,
  shareFolder,
  getFileShareGrants,
  getFolderShareGrants,
  revokeFileShare,
  revokeFolderShare,
} from '../services/ShareApi';
import { useAuth } from '../context/AuthContext';
import { getAvatarColor } from './SharedUsersCell';
import './ShareModal.css';

/**
 * UserAvatar — Renders image if user has profile picture,
 * otherwise renders clean circular letter avatar.
 * Owner ("You") uses crisp white background with dark letter to match UI design.
 */
function UserAvatar({ user, isOwner = false }) {
  const [imgError, setImgError] = useState(false);
  const photoUrl =
    user?.avatar ||
    user?.photo ||
    user?.picture ||
    user?.profilePic ||
    user?.profilePicture ||
    user?.image ||
    user?.user?.avatar ||
    user?.user?.photo ||
    user?.user?.picture;

  const displayName = user?.name || user?.email || 'User';
  const initial = (displayName.trim()[0] || '?').toUpperCase();

  if (photoUrl && !imgError) {
    return (
      <div className={`sm-person-avatar ${isOwner ? 'sm-person-avatar--owner' : ''}`}>
        <img
          src={photoUrl}
          alt={displayName}
          className="sm-avatar-img"
          onError={() => setImgError(true)}
        />
      </div>
    );
  }

  const bgColor = isOwner ? '#ffffff' : getAvatarColor(user?.email || displayName);
  const textColor = isOwner ? '#111215' : '#ffffff';

  return (
    <div
      className={`sm-person-avatar ${isOwner ? 'sm-person-avatar--owner' : ''}`}
      style={{ backgroundColor: bgColor, color: textColor }}
      aria-hidden="true"
    >
      <span>{initial}</span>
    </div>
  );
}

/**
 * RoleDropdown — Dropdown button & popup matching the design mockup.
 * In grantee rows, includes a red "Remove access" option.
 */
function RoleDropdown({
  value,
  onChange,
  allowRemove = false,
  disabled = false,
  compact = false,
}) {
  const [open, setOpen] = useState(false);
  const [menuCoords, setMenuCoords] = useState(null);
  const ref = useRef(null);
  const menuRef = useRef(null);

  const calculateCoords = useCallback(() => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const menuHeight = allowRemove ? 128 : 88;
    const spaceBelow = window.innerHeight - rect.bottom;
    const shouldFlipUp = spaceBelow < menuHeight + 12 && rect.top > menuHeight;

    setMenuCoords({
      top: shouldFlipUp ? rect.top - menuHeight - 4 : rect.bottom + 4,
      left: Math.max(12, rect.right - 160),
    });
  }, [allowRemove]);

  useEffect(() => {
    function onClickOutside(e) {
      if (
        ref.current &&
        !ref.current.contains(e.target) &&
        menuRef.current &&
        !menuRef.current.contains(e.target)
      ) {
        setOpen(false);
      }
    }

    function onScrollOrResize() {
      if (ref.current) {
        const rect = ref.current.getBoundingClientRect();
        if (rect.bottom < 40 || rect.top > window.innerHeight - 40) {
          setOpen(false);
        } else {
          calculateCoords();
        }
      }
    }

    if (open) {
      calculateCoords();
      document.addEventListener('mousedown', onClickOutside);
      window.addEventListener('scroll', onScrollOrResize, true);
      window.addEventListener('resize', onScrollOrResize);
      return () => {
        document.removeEventListener('mousedown', onClickOutside);
        window.removeEventListener('scroll', onScrollOrResize, true);
        window.removeEventListener('resize', onScrollOrResize);
      };
    }
  }, [open, calculateCoords]);

  const displayRole =
    value === 'editor'
      ? 'Editor'
      : value === 'remove'
      ? 'Remove access'
      : 'Viewer';

  return (
    <div className={`sm-role-dropdown ${compact ? 'sm-role-dropdown--compact' : ''}`} ref={ref}>
      <button
        type="button"
        className={`sm-role-btn ${compact ? 'sm-role-btn--compact' : ''} ${open ? 'sm-role-btn--open' : ''} ${value === 'remove' ? 'sm-role-btn--remove' : ''}`}
        onClick={() => {
          if (disabled) return;
          if (!open) calculateCoords();
          setOpen((prev) => !prev);
        }}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span>{displayRole}</span>
        <ChevronDown
          size={14}
          strokeWidth={1.5}
          className={`sm-role-chevron ${open ? 'sm-role-chevron--open' : ''}`}
        />
      </button>

      {open &&
        menuCoords &&
        createPortal(
          <div
            ref={menuRef}
            className="sm-role-menu sm-role-menu--portal"
            role="listbox"
            style={{
              top: `${menuCoords.top}px`,
              left: `${menuCoords.left}px`,
            }}
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className={`sm-role-option ${value === 'editor' ? 'sm-role-option--active' : ''}`}
              role="option"
              aria-selected={value === 'editor'}
              onClick={() => {
                onChange('editor');
                setOpen(false);
              }}
            >
              Editor
            </button>
            <button
              type="button"
              className={`sm-role-option ${value === 'viewer' ? 'sm-role-option--active' : ''}`}
              role="option"
              aria-selected={value === 'viewer'}
              onClick={() => {
                onChange('viewer');
                setOpen(false);
              }}
            >
              Viewer
            </button>
            {allowRemove && (
              <button
                type="button"
                className={`sm-role-option sm-role-option--danger ${value === 'remove' ? 'sm-role-option--active' : ''}`}
                role="option"
                onClick={() => {
                  onChange('remove');
                  setOpen(false);
                }}
              >
                Remove access
              </button>
            )}
          </div>,
          document.body
        )}
    </div>
  );
}

/**
 * ShareModal
 *
 * Props:
 *   isOpen: boolean
 *   item: { _id, originalName?, name?, owner } — file or folder
 *   itemType: 'file' | 'folder'
 *   onClose: () => void
 *   onChanged: () => void — called after any share mutation
 */
export default function ShareModal({
  isOpen,
  item,
  itemType = 'file',
  onClose,
  onChanged,
}) {
  const { user: currentUser } = useAuth();
  const [email, setEmail] = useState('');
  const [newRole, setNewRole] = useState('viewer');
  const [shareError, setShareError] = useState('');
  const [shareLoading, setShareLoading] = useState(false);

  const [grants, setGrants] = useState([]);
  const [inheritedGrants, setInheritedGrants] = useState([]);
  const [grantsLoading, setGrantsLoading] = useState(false);
  const [grantsError, setGrantsError] = useState('');

  const [stagedRoles, setStagedRoles] = useState({}); // { [userId]: 'viewer' | 'editor' | 'remove' }
  const [saveLoading, setSaveLoading] = useState(false);

  const emailRef = useRef(null);

  const rawItemName = item?.originalName || item?.name || 'this item';
  // Strip existing quotes if any to prevent double-wrapping
  const itemName = rawItemName.replace(/^["']|["']$/g, '');

  const fetchGrants = useCallback(async () => {
    if (!item?._id) return;
    setGrantsLoading(true);
    setGrantsError('');
    try {
      const fn = itemType === 'folder' ? getFolderShareGrants : getFileShareGrants;
      const res = await fn(item._id);
      setGrants(res.data?.grants || []);
      setInheritedGrants(res.data?.inheritedGrants || []);
    } catch (err) {
      setGrantsError(err.message || 'Failed to load share list.');
    } finally {
      setGrantsLoading(false);
    }
  }, [item?._id, itemType]);

  useEffect(() => {
    if (isOpen) {
      fetchGrants();
      setEmail('');
      setShareError('');
      setNewRole('viewer');
      setStagedRoles({});
      setTimeout(() => emailRef.current?.focus(), 80);
    }
  }, [isOpen, fetchGrants]);

  // Escape key listener
  useEffect(() => {
    if (!isOpen) return;
    function onKey(e) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  async function handleShare(e) {
    e?.preventDefault();
    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail) {
      setShareError('Enter an email address.');
      return;
    }
    setShareError('');
    setShareLoading(true);
    try {
      // 1. Look up user by email
      const lookupRes = await lookupUserByEmail(trimmedEmail);
      const userId = lookupRes.user?._id;
      if (!userId) throw new Error('User not found.');

      // 2. Share
      const shareFn = itemType === 'folder' ? shareFolder : shareFile;
      await shareFn(item._id, userId, newRole);

      setEmail('');
      onChanged?.();
      await fetchGrants();
    } catch (err) {
      if (err.status === 404) {
        setShareError('No account found with that email address.');
      } else if (err.status === 400 && err.message?.includes('owner')) {
        setShareError("You can't share an item with yourself.");
      } else {
        setShareError(err.message || 'Share failed. Please try again.');
      }
    } finally {
      setShareLoading(false);
    }
  }

  function onRoleSelect(grantee, selectedValue) {
    const originalRole = grantee.hasDirect ? grantee.directRole : grantee.inheritedRole;
    if (selectedValue === originalRole) {
      setStagedRoles((prev) => {
        const next = { ...prev };
        delete next[grantee.userId];
        return next;
      });
    } else {
      setStagedRoles((prev) => ({
        ...prev,
        [grantee.userId]: selectedValue,
      }));
    }
  }

  function handleCancel() {
    setStagedRoles({});
    setEmail('');
    setShareError('');
    onClose();
  }

  async function handleSave() {
    setSaveLoading(true);
    setShareError('');
    try {
      const shareFn = itemType === 'folder' ? shareFolder : shareFile;
      const revokeFn = itemType === 'folder' ? revokeFolderShare : revokeFileShare;

      // 1. If an email address is entered in the input, share with that user
      const trimmedEmail = email.trim().toLowerCase();
      if (trimmedEmail) {
        const lookupRes = await lookupUserByEmail(trimmedEmail);
        const userId = lookupRes.user?._id;
        if (!userId) throw new Error('User not found.');
        await shareFn(item._id, userId, newRole);
      }

      // 2. Commit all staged role changes / revocations
      for (const [userId, roleVal] of Object.entries(stagedRoles)) {
        if (roleVal === 'remove') {
          await revokeFn(item._id, userId);
        } else {
          await shareFn(item._id, userId, roleVal);
        }
      }

      setStagedRoles({});
      setEmail('');
      onChanged?.();
      onClose();
    } catch (err) {
      if (err.status === 404) {
        setShareError('No account found with that email address.');
      } else if (err.status === 400 && err.message?.includes('owner')) {
        setShareError("You can't share an item with yourself.");
      } else {
        setShareError(err.message || 'Failed to save changes. Please try again.');
      }
    } finally {
      setSaveLoading(false);
    }
  }

  if (!isOpen) return null;

  // Resolve Owner row
  const isMeOwner =
    !item?.owner ||
    (typeof item.owner === 'object' && item.owner !== null
      ? item.owner._id === currentUser?._id || item.owner.email === currentUser?.email
      : String(item.owner) === String(currentUser?._id));

  const ownerUserObj =
    typeof item?.owner === 'object' && item?.owner !== null
      ? item.owner
      : currentUser;

  const ownerLabel = isMeOwner ? 'You' : ownerUserObj?.name || ownerUserObj?.email || 'Owner';
  const ownerEmail = isMeOwner
    ? (currentUser?.email || null)
    : (ownerUserObj?.name && ownerUserObj?.email && ownerUserObj?.name !== ownerUserObj?.email ? ownerUserObj.email : null);

  // Merge direct grants and inherited grants into unified grantee objects keyed by userId
  const granteeMap = new Map();

  for (const g of grants) {
    const uid = g.userId?.toString();
    if (!uid) continue;
    granteeMap.set(uid, {
      userId: uid,
      name: g.name,
      email: g.email,
      avatar: g.avatar,
      directRole: g.role,
      hasDirect: true,
      inheritedRole: null,
      inheritedSource: null,
      grantee: g,
    });
  }

  for (const ig of inheritedGrants) {
    const uid = ig.userId?.toString();
    if (!uid) continue;
    const existing = granteeMap.get(uid);
    if (existing) {
      if (!existing.inheritedSource) {
        existing.inheritedSource = ig.source;
        existing.inheritedRole = ig.role;
      }
      if (!existing.name && ig.name) existing.name = ig.name;
      if (!existing.email && ig.email) existing.email = ig.email;
      if (!existing.avatar && ig.avatar) existing.avatar = ig.avatar;
    } else {
      granteeMap.set(uid, {
        userId: uid,
        name: ig.name,
        email: ig.email,
        avatar: ig.avatar,
        directRole: null,
        hasDirect: false,
        inheritedRole: ig.role,
        inheritedSource: ig.source,
        grantee: ig,
      });
    }
  }

  const allGrantRows = Array.from(granteeMap.values()).map((granteeItem) => {
    const effectiveOriginalRole = granteeItem.hasDirect ? granteeItem.directRole : granteeItem.inheritedRole;
    const stagedRole = stagedRoles[granteeItem.userId];
    const effectiveRole = stagedRole !== undefined ? stagedRole : effectiveOriginalRole;
    const isStaged = stagedRole !== undefined;
    const isStagedRemove = stagedRole === 'remove';
    const isStagedChange = isStaged && !isStagedRemove;

    const displayName = granteeItem.name || granteeItem.email || 'User';
    const displayEmail =
      granteeItem.name && granteeItem.email && granteeItem.name !== granteeItem.email
        ? granteeItem.email
        : (!granteeItem.name ? null : granteeItem.email);
    const sourceName = granteeItem.inheritedSource?.name || null;

    return {
      key: `grantee-${granteeItem.userId}`,
      userId: granteeItem.userId,
      displayName,
      displayEmail,
      sourceName,
      user: {
        name: granteeItem.name,
        email: granteeItem.email,
        avatar: granteeItem.avatar,
      },
      role: effectiveRole,
      hasDirect: granteeItem.hasDirect,
      inheritedRole: granteeItem.inheritedRole,
      inheritedSource: granteeItem.inheritedSource,
      isStaged,
      isStagedRemove,
      isStagedChange,
      grantee: {
        ...granteeItem.grantee,
        userId: granteeItem.userId,
        name: granteeItem.name,
        email: granteeItem.email,
        role: effectiveRole,
        hasDirect: granteeItem.hasDirect,
        inheritedRole: granteeItem.inheritedRole,
        inheritedSource: granteeItem.inheritedSource,
      },
    };
  });

  const hasStagedChanges = Object.keys(stagedRoles).length > 0;
  const hasEmailInput = email.trim().length > 0;
  const hasChanges = hasStagedChanges || hasEmailInput;

  return (
    <div
      className="sm-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label={`Share "${itemName}"`}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="sm-modal">
        {/* Header (No close button as requested) */}
        <div className="sm-header">
          <h2 className="sm-title">Share "{itemName}"</h2>
        </div>

        {/* Share Form */}
        <form className="sm-form" onSubmit={handleShare} noValidate>
          <div className="sm-input-row">
            <input
              ref={emailRef}
              id="share-email-input"
              type="email"
              className={`sm-email-input ${shareError ? 'sm-email-input--error' : ''}`}
              placeholder="Add email address"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setShareError('');
              }}
              autoComplete="off"
              disabled={shareLoading || saveLoading}
              aria-label="Email address to share with"
            />
            <RoleDropdown
              value={newRole}
              onChange={setNewRole}
              disabled={shareLoading || saveLoading}
            />
            <button
              type="submit"
              className="sm-share-btn"
              disabled={shareLoading || saveLoading || !email.trim()}
              aria-label="Share"
            >
              {shareLoading ? (
                <Loader size={14} strokeWidth={1.5} className="sm-spinner" />
              ) : (
                'Share'
              )}
            </button>
          </div>
          {shareError && (
            <div className="sm-error-row" role="alert">
              <AlertCircle size={13} strokeWidth={1.5} />
              <span>{shareError}</span>
            </div>
          )}
        </form>

        {/* People List */}
        <div className="sm-people-section">
          <div className="sm-people-label">People with access</div>

          <div className="sm-people-list">
            {/* Owner row */}
            <div className="sm-person-row">
              <div className="sm-person-left">
                <UserAvatar user={ownerUserObj} isOwner={true} />
                <div className="sm-person-info">
                  <span className="sm-person-name">{ownerLabel}</span>
                  {ownerEmail && (
                    <span className="sm-person-email">{ownerEmail}</span>
                  )}
                </div>
              </div>
              <div className="sm-person-right">
                <span className="sm-owner-badge">Owner</span>
              </div>
            </div>

            {/* Loading / Error States */}
            {grantsLoading && (
              <div className="sm-people-status">
                <Loader size={14} strokeWidth={1.5} className="sm-spinner" />
                <span>Loading people with access…</span>
              </div>
            )}
            {!grantsLoading && grantsError && (
              <div className="sm-people-status sm-people-status--error">
                <AlertCircle size={14} strokeWidth={1.5} />
                <span>{grantsError}</span>
                <button
                  type="button"
                  className="sm-retry-btn"
                  onClick={fetchGrants}
                >
                  Retry
                </button>
              </div>
            )}

            {/* Grantee rows */}
            {!grantsLoading &&
              allGrantRows.map((row) => (
                <div
                  key={row.key}
                  className={`sm-person-row ${row.isStagedRemove ? 'sm-person-row--staged-remove' : ''} ${row.isStagedChange ? 'sm-person-row--staged-change' : ''}`}
                >
                  <div className="sm-person-left">
                    <UserAvatar user={row.user} isOwner={false} />
                    <div className="sm-person-info">
                      <span className="sm-person-name">{row.displayName}</span>
                      {row.displayEmail && (
                        <span className="sm-person-email">{row.displayEmail}</span>
                      )}
                      {row.sourceName && (
                        <span className="sm-person-source">
                          <FolderSymlink
                            size={11}
                            style={{ flexShrink: 0 }}
                          />
                          Access from "{row.sourceName}"
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="sm-person-right">
                    <RoleDropdown
                      value={row.role}
                      onChange={(val) => onRoleSelect(row.grantee, val)}
                      allowRemove={row.hasDirect}
                      compact={true}
                      disabled={saveLoading}
                    />
                  </div>
                </div>
              ))}
          </div>
        </div>

        {/* Footer: Done when no changes; Cancel & Save when changes exist */}
        <div className="sm-footer">
          {hasChanges ? (
            <div className="sm-footer-actions">
              <button
                type="button"
                className="sm-cancel-btn"
                onClick={handleCancel}
                disabled={saveLoading}
              >
                Cancel
              </button>
              <button
                type="button"
                className="sm-save-btn"
                onClick={handleSave}
                disabled={saveLoading}
              >
                {saveLoading ? (
                  <>
                    <Loader size={14} strokeWidth={1.5} className="sm-spinner sm-spinner--white" />
                    <span>Saving…</span>
                  </>
                ) : (
                  'Save'
                )}
              </button>
            </div>
          ) : (
            <button
              type="button"
              className="sm-done-btn"
              onClick={onClose}
            >
              Done
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
