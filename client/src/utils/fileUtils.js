/**
 * File utility helpers for FileNest
 */

export function formatSize(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const size = (bytes / Math.pow(1024, i)).toFixed(i > 1 ? 2 : (i > 0 ? 1 : 0));
  return `${size} ${units[i]}`;
}

export function formatStorageSize(bytes) {
  if (!bytes || bytes === 0) return '0 KB';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const size = Math.round(bytes / Math.pow(1024, i));
  return `${size} ${units[i]}`;
}

export function formatFolderSize(bytes) {
  if (!bytes || bytes === 0) return '0 KB';
  return formatSize(bytes);
}

function parseDate(dateInput) {
  if (!dateInput) return null;
  if (dateInput instanceof Date) {
    return isNaN(dateInput.getTime()) ? null : dateInput;
  }
  // If it's a 24-hex-char MongoDB ObjectId string
  if (typeof dateInput === 'string' && /^[0-9a-fA-F]{24}$/.test(dateInput)) {
    try {
      const d = new Date(parseInt(dateInput.substring(0, 8), 16) * 1000);
      return isNaN(d.getTime()) ? null : d;
    } catch {
      return null;
    }
  }
  const d = new Date(dateInput);
  return isNaN(d.getTime()) ? null : d;
}

export function formatDate(dateString) {
  const date = parseDate(dateString);
  if (!date) return '—';
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function formatTime(dateString) {
  const date = parseDate(dateString);
  if (!date) return '';
  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatRelativeTime(dateString) {
  const date = parseDate(dateString);
  if (!date) return '—';

  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  // If clock skew or future timestamp
  if (diffInSeconds < 0) return 'Just now';

  // Less than 60 seconds
  if (diffInSeconds < 60) return 'Just now';

  // Less than 60 minutes
  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) {
    return `${diffInMinutes} ${diffInMinutes === 1 ? 'min' : 'mins'} ago`;
  }

  // Less than 24 hours
  const diffInHours = Math.floor(diffInSeconds / 3600);
  if (diffInHours < 24) {
    return `${diffInHours} ${diffInHours === 1 ? 'hr' : 'hrs'} ago`;
  }

  // At or after 24 hours, show actual date
  return formatDate(date);
}

export function getFileCategory(file) {
  if (!file) return 'other';
  const mime = (file.mimeType || '').toLowerCase();
  const name = (file.originalName || '').toLowerCase();
  const ext = name.split('.').pop() || '';

  if (
    mime.startsWith('image/') ||
    ['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp', 'bmp', 'ico', 'avif'].includes(ext)
  ) {
    return 'images';
  }
  if (
    mime.includes('pdf') ||
    mime.includes('word') ||
    mime.includes('document') ||
    mime.includes('sheet') ||
    mime.includes('presentation') ||
    mime.includes('text/') ||
    ['pdf', 'doc', 'docx', 'txt', 'rtf', 'odt', 'xls', 'xlsx', 'csv', 'ppt', 'pptx', 'md'].includes(ext)
  ) {
    return 'documents';
  }
  if (
    mime.startsWith('video/') ||
    mime.startsWith('audio/') ||
    ['mp4', 'mkv', 'avi', 'mov', 'mp3', 'wav', 'flac', 'ogg', 'm4a', 'webm'].includes(ext)
  ) {
    return 'media';
  }
  // .zip/.rar/.7z and all others go under other (no Archives category)
  return 'other';
}

export function getFileCategoryLabel(category) {
  switch (category) {
    case 'images':
      return 'Image';
    case 'documents':
      return 'Document';
    case 'media':
      return 'Media';
    default:
      return 'Other';
  }
}

export function getFileExtension(file) {
  if (!file) return 'FILE';
  const name = file.originalName || '';
  const parts = name.split('.');
  if (parts.length > 1) {
    const ext = parts.pop();
    if (ext && ext.length <= 6) {
      return ext.toUpperCase();
    }
  }
  if (file.mimeType) {
    const sub = file.mimeType.split('/')[1];
    if (sub) {
      return sub.split('+')[0].toUpperCase();
    }
  }
  return 'FILE';
}
