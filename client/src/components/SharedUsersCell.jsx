import React from 'react';
import { useAuth } from '../context/AuthContext';
import './SharedUsersCell.css';

const LETTER_PALETTE = {
  P: '#db2777', // pink
  A: '#0d9488', // teal
  R: '#ea580c', // orange
  J: '#0d9488', // teal as in screenshot
  S: '#7c3aed', // purple
  D: '#059669', // emerald
  M: '#d97706', // amber
  K: '#db2777',
  T: '#0284c7',
  N: '#4f46e5',
  H: '#0891b2',
};

const PALETTE_FALLBACK = [
  '#db2777',
  '#0d9488',
  '#ea580c',
  '#7c3aed',
  '#2563eb',
  '#059669',
  '#d97706',
  '#0284c7',
];

export function getAvatarColor(identifier = '') {
  const str = String(identifier).trim();
  if (!str) return PALETTE_FALLBACK[0];
  const first = (str[0] || '').toUpperCase();
  if (LETTER_PALETTE[first]) return LETTER_PALETTE[first];

  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return PALETTE_FALLBACK[Math.abs(hash) % PALETTE_FALLBACK.length];
}

export function getInitial(nameOrEmail = '') {
  const str = String(nameOrEmail).trim();
  return str.length > 0 ? str[0].toUpperCase() : '?';
}

function AvatarCircle({ user, label, className = 'shared-avatar-circle', style }) {
  const [imgError, setImgError] = React.useState(false);
  const photo =
    user?.avatar ||
    user?.photo ||
    user?.picture ||
    user?.profilePic ||
    user?.image;
  const initial = getInitial(label || user?.email || user?.name);
  const color = getAvatarColor(label || user?.email || user?.name);

  if (photo && !imgError) {
    return (
      <span className={className} style={style}>
        <img
          src={photo}
          alt={label || ''}
          style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }}
          onError={() => setImgError(true)}
        />
      </span>
    );
  }

  return (
    <span className={className} style={{ ...style, backgroundColor: color }}>
      {initial}
    </span>
  );
}

/**
 * SharedUsersCell — renders grantee avatars & emails for "Shared by me"
 * and owner avatar & name for "Shared with me".
 * If the owner/grantee is the currently logged in user, shows "me".
 */
export default function SharedUsersCell({
  grantees = [],
  granteeCount = 0,
  owner = null,
  mode = 'shared-with', // 'shared-with' | 'shared-by'
}) {
  const { user: currentUser } = useAuth();
  const currentUserId = (currentUser?._id || currentUser?.id)?.toString();
  const currentUserEmail = currentUser?.email?.toLowerCase();

  if (mode === 'shared-by') {
    const ownerId =
      typeof owner === 'object' && owner !== null
        ? (owner._id || owner.id || '').toString()
        : String(owner || '');
    const ownerEmail =
      typeof owner === 'object' && owner !== null
        ? owner.email
        : (typeof owner === 'string' && owner.includes('@') ? owner : null);

    const isCurrentUser = Boolean(
      (currentUserId && ownerId && currentUserId === ownerId) ||
      (currentUserEmail && ownerEmail && currentUserEmail === ownerEmail.toLowerCase())
    );

    if (isCurrentUser) {
      const userObj = currentUser || owner;
      const avatarLabel = currentUser?.name || currentUser?.email || 'me';
      return (
        <div className="shared-users-cell" title="me">
          <div className="shared-users-single">
            <AvatarCircle user={userObj} label={avatarLabel} />
            <span className="shared-user-text shared-user-text--me">me</span>
          </div>
        </div>
      );
    }

    const name = owner?.name || owner?.email || 'Unknown';
    const email = owner?.email || '';

    return (
      <div className="shared-users-cell" title={email || name}>
        <div className="shared-users-single">
          <AvatarCircle user={owner} label={email || name} />
          <span className="shared-user-text">{email || name}</span>
        </div>
      </div>
    );
  }

  // mode === 'shared-with'
  // Collect grantee list
  const list = Array.isArray(grantees) && grantees.length > 0 ? grantees : [];
  const totalCount = list.length > 0 ? list.length : granteeCount;

  if (totalCount === 0) {
    return <div className="shared-users-cell shared-user-text">—</div>;
  }

  const checkIsCurrent = (g) => {
    const gId = (g?.userId || g?._id || g?.id || (typeof g?.user === 'object' ? g?.user?._id : g?.user))?.toString();
    const gEmail = g?.email || (typeof g?.user === 'object' ? g?.user?.email : null);
    return Boolean(
      (currentUserId && gId && currentUserId === gId) ||
      (currentUserEmail && gEmail && currentUserEmail === gEmail.toLowerCase())
    );
  };

  // Exactly 1 person — NO tooltip as requested
  if (totalCount === 1) {
    const single = list[0] || {};
    const isCurrent = checkIsCurrent(single);
    const label = isCurrent ? 'me' : (single.email || single.name || '1 person');
    const avatarLabel = isCurrent ? (currentUser?.name || currentUser?.email || 'me') : label;

    return (
      <div className="shared-users-cell">
        <div className="shared-users-single">
          <AvatarCircle user={isCurrent ? currentUser : single} label={avatarLabel} />
          <span className={`shared-user-text ${isCurrent ? 'shared-user-text--me' : ''}`}>{label}</span>
        </div>
      </div>
    );
  }

  // Multiple people (> 1) — show email addresses in tooltip
  const maxVisible = 3;
  const visible = list.slice(0, maxVisible);
  const remainingCount = totalCount - visible.length;

  const tooltipEmails = list
    .map((g) => {
      if (checkIsCurrent(g)) return 'me';
      return g.email || g.user?.email || g.name || '';
    })
    .filter(Boolean)
    .join(', ');
  const tooltip = tooltipEmails || `${totalCount} accounts`;

  return (
    <div className="shared-users-cell" title={tooltip}>
      <div className="shared-users-stack">
        {visible.map((g, idx) => {
          const id = g.userId || g.email || idx;
          const isCurrent = checkIsCurrent(g);
          const label = isCurrent ? 'me' : (g.email || g.name || `User ${idx + 1}`);
          const avatarLabel = isCurrent ? (currentUser?.name || currentUser?.email || 'me') : label;

          return (
            <AvatarCircle
              key={id}
              user={isCurrent ? currentUser : g}
              label={avatarLabel}
              className="shared-avatar-circle shared-avatar-stacked"
            />
          );
        })}
        {remainingCount > 0 && (
          <span className="shared-avatar-circle shared-avatar-stacked shared-avatar-overflow">
            +{remainingCount}
          </span>
        )}
      </div>
    </div>
  );
}
