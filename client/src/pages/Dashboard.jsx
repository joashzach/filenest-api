import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getFiles, getDownloadUrl, deleteFile, getUploadUrl, uploadToS3, confirmUpload, moveFile } from '../services/FileApi';
import { getRootContents, getFolderContents, moveFolder } from '../services/FolderApi';
import {
  getSharedWithMe,
  getSharedByMe,
  leaveFileShare,
  leaveFolderShare,
} from '../services/ShareApi';
import { getFileCategory, getFileExtension, formatSize, formatRelativeTime, formatDate, formatTime } from '../utils/fileUtils';
import DashboardNavbar from '../components/DashboardNavbar';
import Sidebar from '../components/Sidebar';
import FileCard from '../components/FileCard';
import FileList from '../components/FileList';
import FolderCard from '../components/FolderCard';
import FolderRow from '../components/FolderRow';
import FolderBreadcrumb from '../components/FolderBreadcrumb';
import EmptyState from '../components/EmptyState';
import SharedUsersCell from '../components/SharedUsersCell';
import OwnerCell from '../components/OwnerCell';
import RowActionMenu from '../components/RowActionMenu';
import FilePreviewModal from '../components/FilePreviewModal';
import DeleteConfirmModal from '../components/DeleteConfirmModal';
import DeleteFolderModal from '../components/DeleteFolderModal';
import CreateFolderModal from '../components/CreateFolderModal';
import RenameFolderModal from '../components/RenameFolderModal';
import RenameFileModal from '../components/RenameFileModal';
import MoveFileModal from '../components/MoveFileModal';
import UserSettingsModal from '../components/UserSettingsModal';
import StorageOverview from '../components/StorageOverview';
import ShareModal from '../components/ShareModal';
import usePermissions from '../hooks/usePermissions';
import {
  List,
  LayoutGrid,
  RefreshCw,
  ChevronDown,
  Check,
  AlertCircle,
  Upload,
  FolderPlus,
  SquarePlus,
  File,
  Image,
  FileText,
  Video,
  Download,
  Trash2,
  Pencil,
  Users,
  Share2,
  UserMinus,
  FolderInput,
} from 'lucide-react';
import './Dashboard.css';

const SORT_OPTIONS = [
  { id: 'newest', label: 'Newest first' },
  { id: 'oldest', label: 'Oldest first' },
  { id: 'name-asc', label: 'Name (A–Z)' },
  { id: 'name-desc', label: 'Name (Z–A)' },
  { id: 'size-desc', label: 'Size (Largest)' },
  { id: 'size-asc', label: 'Size (Smallest)' },
];

const CATEGORY_TITLES = {
  all: 'My Files',
  images: 'Images',
  documents: 'Documents',
  media: 'Media',
  other: 'Other',
};

function renderCategoryHeaderIcon(cat) {
  switch (cat) {
    case 'images':
      return <Image size={16} strokeWidth={1.5} className="folder-breadcrumb-root-icon" aria-hidden="true" />;
    case 'documents':
      return <FileText size={16} strokeWidth={1.5} className="folder-breadcrumb-root-icon" aria-hidden="true" />;
    case 'media':
      return <Video size={16} strokeWidth={1.5} className="folder-breadcrumb-root-icon" aria-hidden="true" />;
    default:
      return <File size={16} strokeWidth={1.5} className="folder-breadcrumb-root-icon" aria-hidden="true" />;
  }
}

/**
 * FolderViewFileRow — A file row rendered inside the My Files list view.
 * Uses the same filelist-row / filelist-col classes as FileList.
 * Defined at module level (not inside Dashboard) to avoid recreating on every render.
 */
function FolderViewFileRow({
  file,
  isDownloading,
  isDeleting,
  onPreview,
  onDownload,
  onDelete,
  onRename,
  onShare,
  onLeave,
  onMove,
  sharedView = null,
}) {
  const permissions = usePermissions(file);

  function renderIcon() {
    const cat = getFileCategory(file);
    switch (cat) {
      case 'images': return <Image size={16} strokeWidth={1.5} className="filelist-row-file-icon" />;
      case 'documents': return <FileText size={16} strokeWidth={1.5} className="filelist-row-file-icon" />;
      case 'media': return <Video size={16} strokeWidth={1.5} className="filelist-row-file-icon" />;
      default: return <File size={16} strokeWidth={1.5} className="filelist-row-file-icon" />;
    }
  }

  const ext = getFileExtension(file);
  const hasGrantees = (file.granteeCount ?? file.sharedWith?.length ?? file.grantees?.length ?? 0) > 0;
  const isSharingWithOthers =
    sharedView === 'by-me' || (sharedView !== 'with-me' && permissions.isOwner && hasGrantees);
  const isSharedWithMe =
    sharedView === 'with-me' ||
    permissions.isSharedWithMe ||
    (!permissions.isOwner && Boolean(permissions.role || file.permission || file.myPermission || file.inherited));
  const isShared = isSharingWithOthers || isSharedWithMe;
  const sharedTitle = isSharedWithMe ? 'Shared with me' : 'Shared with others';
  const ownerName = file.owner?.name || file.owner?.email;

  const rowModifier =
    sharedView === 'with-me'
      ? 'filelist-row--with-me'
      : sharedView === 'by-me'
      ? 'filelist-row--by-me'
      : '';

  return (
    <div
      className={`filelist-row ${rowModifier}`}
      style={{ height: '48px', minHeight: '48px', maxHeight: '48px', flexShrink: 0, flexGrow: 0, boxSizing: 'border-box' }}
      role="row"
      draggable={permissions.canMove}
      onDragStart={(e) => {
        if (!permissions.canMove) return;
        const payload = JSON.stringify({ itemType: 'file', id: file._id, name: file.originalName });
        e.dataTransfer.setData('application/x-filenest-item', payload);
        e.dataTransfer.setData('application/json', payload);
        e.dataTransfer.effectAllowed = 'move';
      }}
      onClick={() => onPreview && onPreview(file)}
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onPreview && onPreview(file)}
    >
      <div
        className="filelist-col filelist-col-name"
        title={file.originalName}
      >
        {renderIcon()}
        <span className="filelist-filename">{file.originalName}</span>
        {isShared && (
          <span title={sharedTitle} className="file-shared-indicator">
            <Users size={13} strokeWidth={1.5} />
          </span>
        )}
      </div>

      {sharedView === 'with-me' && (
        <>
          <div className="filelist-col filelist-col-shared-by">
            <SharedUsersCell owner={file.owner} mode="shared-by" />
          </div>
          <div className="filelist-col filelist-col-role">
            <span className="filelist-badge">
              {permissions.isOwner || permissions.role === 'owner' || permissions.role === 'editor' ? 'Editor' : 'Viewer'}
            </span>
          </div>
        </>
      )}

      {sharedView === 'by-me' && (
        <div className="filelist-col filelist-col-shared-with">
          <SharedUsersCell
            grantees={file.grantees || file.sharedWith}
            granteeCount={file.granteeCount}
            mode="shared-with"
          />
        </div>
      )}

      {!sharedView && (
        <>
          <OwnerCell item={file} />
          <div className="filelist-col filelist-col-type">{ext}</div>
          <div className="filelist-col filelist-col-size">{formatSize(file.size)}</div>
        </>
      )}

      <div
        className="filelist-col filelist-col-date"
        title={
          sharedView
            ? formatDate(file.sharedAt || file.updatedAt || file.createdAt) +
              ' ' +
              formatTime(file.sharedAt || file.updatedAt || file.createdAt)
            : file.createdAt
            ? `${formatDate(file.createdAt)} ${formatTime(file.createdAt)}`
            : ''
        }
      >
        {sharedView
          ? formatDate(file.sharedAt || file.updatedAt || file.createdAt)
          : formatRelativeTime(file.createdAt || file._id)}
      </div>

      <div className="filelist-col filelist-col-actions" onClick={(e) => e.stopPropagation()}>
        <RowActionMenu
          disabled={isDownloading || isDeleting}
          items={
            sharedView === 'by-me'
              ? [
                  onShare && {
                    key: 'share',
                    label: 'Share',
                    icon: Share2,
                    onClick: () => onShare(file),
                  },
                  onDownload && {
                    key: 'download',
                    label: 'Download',
                    icon: Download,
                    onClick: () => onDownload(file),
                  },
                  onRename && {
                    key: 'rename',
                    label: 'Rename',
                    icon: Pencil,
                    onClick: () => onRename(file),
                  },
                  onMove && {
                    key: 'move',
                    label: 'Move',
                    icon: FolderInput,
                    onClick: () => onMove(file),
                  },
                  onDelete && {
                    key: 'delete',
                    label: 'Delete',
                    icon: Trash2,
                    danger: true,
                    onClick: () => onDelete(file),
                  },
                ]
              : sharedView === 'with-me'
              ? [
                  onDownload && {
                    key: 'download',
                    label: 'Download',
                    icon: Download,
                    onClick: () => onDownload(file),
                  },
                  permissions.canRename && onRename && {
                    key: 'rename',
                    label: 'Rename',
                    icon: Pencil,
                    onClick: () => onRename(file),
                  },
                  permissions.canMove && onMove && {
                    key: 'move',
                    label: 'Move',
                    icon: FolderInput,
                    onClick: () => onMove(file),
                  },
                  (onDelete || onLeave) && {
                    key: 'delete',
                    label: 'Delete',
                    icon: Trash2,
                    danger: true,
                    onClick: () => (permissions.canDelete && onDelete ? onDelete(file) : onLeave ? onLeave(file) : onDelete && onDelete(file)),
                  },
                ]
              : [
                  permissions.canShare && onShare && {
                    key: 'share',
                    label: 'Share',
                    icon: Share2,
                    onClick: () => onShare(file),
                  },
                  (permissions.canDownload || Boolean(onDownload)) && onDownload && {
                    key: 'download',
                    label: 'Download',
                    icon: Download,
                    onClick: () => onDownload(file),
                  },
                  (permissions.canRename || permissions.isEditor || !permissions.isViewer) && onRename && {
                    key: 'rename',
                    label: 'Rename',
                    icon: Pencil,
                    onClick: () => onRename(file),
                  },
                  (permissions.canMove || permissions.isEditor || !permissions.isViewer) && onMove && {
                    key: 'move',
                    label: 'Move',
                    icon: FolderInput,
                    onClick: () => onMove(file),
                  },
                  (permissions.canDelete || permissions.canLeave || onLeave || onDelete) && {
                    key: 'delete',
                    label: 'Delete',
                    icon: Trash2,
                    danger: true,
                    onClick: () => (permissions.canDelete && onDelete ? onDelete(file) : onLeave ? onLeave(file) : onDelete && onDelete(file)),
                  },
                ]
          }
        />
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { user: currentUser } = useAuth();

  // ── All files (used for category filters & counts) ──────────────────────────
  const [allFiles, setAllFiles] = useState([]);
  const [allFilesInitialized, setAllFilesInitialized] = useState(false);

  // ── Folder browsing ─────────────────────────────────────────────────────────
  // breadcrumbs: Array<{ id: string|null, name: string }>
  // The first entry is always My Files (id: null)
  const [breadcrumbs, setBreadcrumbs] = useState([{ id: null, name: 'My Files' }]);
  const currentFolderId = breadcrumbs[breadcrumbs.length - 1].id;

  // Contents of the currently-open folder (folders + files in that folder)
  const [folderFolders, setFolderFolders] = useState([]);
  const [folderFiles, setFolderFiles] = useState([]);
  // folderLoading = true ONLY until the first successful load; after that we keep
  // the previous data visible during background refetches (never blank the list).
  const [folderLoading, setFolderLoading] = useState(true);
  const [folderInitialized, setFolderInitialized] = useState(false);
  const [folderError, setFolderError] = useState('');
  // Epoch counter: incremented whenever currentFolderId changes so that a slow
  // in-flight fetch for the old folder is silently discarded.
  const folderEpochRef = useRef(0);

  // ── Root directory counts (folders + files in root directory) ───────────────
  const [rootCounts, setRootCounts] = useState({ folders: 0, files: 0 });

  // ── UI state ─────────────────────────────────────────────────────────────────
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');
  const navigate = useNavigate();
  const { section, folderId } = useParams();

  // Route-derived active section ('files' | 'shared-by-me' | 'shared-with-me' | 'storage')
  const activeSection = useMemo(() => {
    if (section === 'shared-by-me') return 'shared-by-me';
    if (section === 'shared-with-me') return 'shared-with-me';
    if (section === 'storage') return 'storage';
    return 'files';
  }, [section]);

  function handleSectionChange(sec) {
    if (sec === 'shared-by-me') {
      setSharedByMeBreadcrumbs([{ id: null, name: 'Shared by me' }]);
      navigate('/dashboard/shared-by-me');
    } else if (sec === 'shared-with-me') {
      setSharedBreadcrumbs([{ id: null, name: 'Shared with me' }]);
      navigate('/dashboard/shared-with-me');
    } else if (sec === 'storage') {
      navigate('/dashboard/storage');
    } else {
      navigate('/dashboard');
    }
  }
  const [sortBy, setSortBy] = useState('newest');
  const [viewMode, setViewMode] = useState('list');
  const [sortDropdownOpen, setSortDropdownOpen] = useState(false);
  const sortRef = useRef(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // ── File actions & modals ───────────────────────────────────────────────────
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgressText, setUploadProgressText] = useState('');
  const fileInputRef = useRef(null);
  const [previewFile, setPreviewFile] = useState(null);
  const [deleteConfirmFile, setDeleteConfirmFile] = useState(null);
  const [renameFileTarget, setRenameFileTarget] = useState(null);
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);

  // ── Folder modals ────────────────────────────────────────────────────────────
  const [createFolderOpen, setCreateFolderOpen] = useState(false);
  const [renameFolderTarget, setRenameFolderTarget] = useState(null);
  const [deleteFolderTarget, setDeleteFolderTarget] = useState(null);
  const [moveTarget, setMoveTarget] = useState(null); // { item, itemType: 'file' | 'folder' } | null

  // ── Status & Actions ─────────────────────────────────────────────────────────
  const [downloadingId, setDownloadingId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [notification, setNotification] = useState(null);
  const [isWindowDragOver, setIsWindowDragOver] = useState(false);

  // ── Shared with me state ────────────────────────────────────────────────────
  const [sharedWithMeFiles, setSharedWithMeFiles] = useState([]);
  const [sharedWithMeFolders, setSharedWithMeFolders] = useState([]);
  const [sharedWithMeLoading, setSharedWithMeLoading] = useState(false);
  const [sharedWithMeInitialized, setSharedWithMeInitialized] = useState(false);
  const [sharedWithMeError, setSharedWithMeError] = useState('');
  const [sharedBreadcrumbs, setSharedBreadcrumbs] = useState([{ id: null, name: 'Shared with me' }]);
  const currentSharedFolderId = sharedBreadcrumbs[sharedBreadcrumbs.length - 1].id;
  const [sharedFolderContents, setSharedFolderContents] = useState({ folder: null, folders: [], files: [] });
  const sharedRootFolder =
    currentSharedFolderId !== null && sharedBreadcrumbs.length > 1
      ? sharedWithMeFolders.find((f) => f._id === sharedBreadcrumbs[1].id) ||
        (sharedFolderContents.folder?._id === sharedBreadcrumbs[1].id ? sharedFolderContents.folder : null) ||
        sharedFolderContents.folder ||
        sharedBreadcrumbs[1]
      : null;
  const [sharedFolderLoading, setSharedFolderLoading] = useState(false);
  const [sharedFolderInitialized, setSharedFolderInitialized] = useState(false);
  const [sharedFolderError, setSharedFolderError] = useState('');
  const [currentSharedFolderPermission, setCurrentSharedFolderPermission] = useState(null);

  // ── Shared by me state ──────────────────────────────────────────────────────
  const [sharedByMeFiles, setSharedByMeFiles] = useState([]);
  const [sharedByMeFolders, setSharedByMeFolders] = useState([]);
  const [sharedByMeLoading, setSharedByMeLoading] = useState(false);
  const [sharedByMeInitialized, setSharedByMeInitialized] = useState(false);
  const [sharedByMeError, setSharedByMeError] = useState('');
  const [sharedByMeBreadcrumbs, setSharedByMeBreadcrumbs] = useState([{ id: null, name: 'Shared by me' }]);
  const currentSharedByMeFolderId = sharedByMeBreadcrumbs[sharedByMeBreadcrumbs.length - 1].id;
  const sharedByMeRootFolder =
    currentSharedByMeFolderId !== null && sharedByMeBreadcrumbs.length > 1
      ? sharedByMeFolders.find((f) => f._id === sharedByMeBreadcrumbs[1].id) || sharedByMeBreadcrumbs[1]
      : null;
  const [sharedByMeFolderContents, setSharedByMeFolderContents] = useState({ folders: [], files: [] });
  const [sharedByMeFolderLoading, setSharedByMeFolderLoading] = useState(false);
  const [sharedByMeFolderInitialized, setSharedByMeFolderInitialized] = useState(false);
  const [sharedByMeFolderError, setSharedByMeFolderError] = useState('');

  // ── Share modal target ──────────────────────────────────────────────────────
  const [shareModalTarget, setShareModalTarget] = useState(null); // { item, itemType: 'file' | 'folder' }

  // ── Whether we're inside a folder (breadcrumbs > 1 = root + at least 1 folder)
  const isInFolder = breadcrumbs.length > 1;

  // Click outside for sort dropdown
  useEffect(() => {
    function handleClickOutside(e) {
      if (sortRef.current && !sortRef.current.contains(e.target)) {
        setSortDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Lock body scroll when any modal or the mobile drawer is open
  const isAnyOverlayOpen = Boolean(
    previewFile ||
    deleteConfirmFile ||
    renameFileTarget ||
    settingsModalOpen ||
    createFolderOpen ||
    renameFolderTarget ||
    deleteFolderTarget ||
    shareModalTarget ||
    mobileMenuOpen
  );

  useEffect(() => {
    if (isAnyOverlayOpen) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [isAnyOverlayOpen]);

  // ── Fetch ALL files (for category sidebar + StorageOverview) ─────────────────
  const fetchAllFiles = useCallback(async () => {
    try {
      const res = await getFiles();
      setAllFiles(res.data?.files || []);
    } catch {
      // Non-critical — categories may show stale counts but browsing still works
    } finally {
      setAllFilesInitialized(true);
    }
  }, []);

  useEffect(() => {
    fetchAllFiles();
  }, [fetchAllFiles]);

  // ── Fetch root directory counts (always reflects root regardless of current folder)
  const fetchRootCounts = useCallback(async () => {
    try {
      const res = await getRootContents();
      const folders = res.data?.folders || [];
      const files = res.data?.files || [];
      setRootCounts({ folders: folders.length, files: files.length });
    } catch {
      // Non-critical
    }
  }, []);

  useEffect(() => {
    fetchRootCounts();
  }, [fetchRootCounts]);

  // ── Fetch current folder contents ────────────────────────────────────────────
  // Only shows skeleton on very first load (folderInitialized === false);
  // subsequent refetches keep the existing list visible.
  const fetchCurrentContents = useCallback(async () => {
    setFolderError('');
    const epoch = ++folderEpochRef.current;
    // Only show the loading skeleton before the very first successful load.
    setFolderLoading((prev) => prev); // no-op — spinner only shown when !folderInitialized
    try {
      let res;
      if (currentFolderId === null) {
        res = await getRootContents();
        if (folderEpochRef.current !== epoch) return; // stale response, discard
        const f = res.data?.folders || [];
        const fi = res.data?.files || [];
        setFolderFolders(f);
        setFolderFiles(fi);
        setRootCounts({ folders: f.length, files: fi.length });
      } else {
        res = await getFolderContents(currentFolderId);
        if (folderEpochRef.current !== epoch) return;
        setFolderFolders(res.data?.folders || []);
        setFolderFiles(res.data?.files || []);
      }
      setFolderLoading(false);
      setFolderInitialized(true);
    } catch (err) {
      if (folderEpochRef.current !== epoch) return;
      setFolderError(err.message || 'Failed to load folder contents.');
      setFolderLoading(false);
    }
  }, [currentFolderId]);

  useEffect(() => {
    // Reset initialized flag when folder changes so skeleton shows for the new folder
    setFolderInitialized(false);
    setFolderLoading(true);
    // Invalidate any in-flight fetch from the previous folder
    folderEpochRef.current++;
  }, [currentFolderId]);

  // fetchCurrentContents also increments the epoch at the START of each call,
  // ensuring that only the most-recent call's response is applied.
  // The reset effect above pre-bumps so an in-flight old-folder request is discarded
  // immediately; fetchCurrentContents will bump again and capture that new value.

  useEffect(() => {
    if (activeSection === 'files' && activeCategory === 'all') {
      fetchCurrentContents();
    }
  }, [fetchCurrentContents, activeSection, activeCategory]);

  // ── Fetch Shared with me ─────────────────────────────────────────────────────
  // Loading spinner shown only on first load (sharedWithMeInitialized === false)
  const fetchSharedWithMe = useCallback(async () => {
    setSharedWithMeError('');
    try {
      const res = await getSharedWithMe();
      setSharedWithMeFiles(res.data?.files || []);
      setSharedWithMeFolders(res.data?.folders || []);
      setSharedWithMeInitialized(true);
    } catch (err) {
      setSharedWithMeError(err.message || 'Failed to load items shared with you.');
    } finally {
      setSharedWithMeLoading(false);
    }
  }, []);

  // ── Fetch Shared by me ───────────────────────────────────────────────────────
  // Loading spinner shown only on first load (sharedByMeInitialized === false)
  const fetchSharedByMe = useCallback(async () => {
    setSharedByMeError('');
    try {
      const res = await getSharedByMe();
      setSharedByMeFiles(res.data?.files || []);
      setSharedByMeFolders(res.data?.folders || []);
      setSharedByMeInitialized(true);
    } catch (err) {
      setSharedByMeError(err.message || 'Failed to load items you have shared.');
    } finally {
      setSharedByMeLoading(false);
    }
  }, []);

  // ── Fetch shared folder contents when browsing inside a shared folder ───────────
  // Loading spinner only on first entry into this folder (sharedFolderInitialized)
  const fetchSharedFolderContents = useCallback(async () => {
    if (!currentSharedFolderId) return;
    setSharedFolderError('');
    try {
      const res = await getFolderContents(currentSharedFolderId);
      setSharedFolderContents({
        folder: res.data?.folder || null,
        folders: res.data?.folders || [],
        files: res.data?.files || [],
      });
      if (res.data?.myPermission) {
        setCurrentSharedFolderPermission(res.data.myPermission);
      }
      if (res.data?.folder?.owner) {
        setSharedBreadcrumbs((prev) => {
          if (prev.length > 1 && (!prev[1].owner || !prev[1].owner.name)) {
            const next = [...prev];
            next[1] = { ...next[1], owner: res.data.folder.owner };
            return next;
          }
          return prev;
        });
      }
      setSharedFolderInitialized(true);
      setSharedFolderLoading(false);
    } catch (err) {
      if (
        err.status === 404 ||
        err.message?.includes('404') ||
        err.message?.includes('not exist') ||
        err.message?.includes('access')
      ) {
        setSharedBreadcrumbs([{ id: null, name: 'Shared with me' }]);
        showNotification('You no longer have access to this item.', 'error');
        fetchSharedWithMe();
      } else {
        setSharedFolderError(err.message || 'Failed to load folder contents.');
        setSharedFolderLoading(false);
      }
    }
  }, [currentSharedFolderId, fetchSharedWithMe]);

  // ── Fetch Shared by me folder contents when browsing inside a folder ─────────
  // Loading spinner only on first entry into this folder
  const fetchSharedByMeFolderContents = useCallback(async () => {
    if (!currentSharedByMeFolderId) return;
    setSharedByMeFolderError('');
    try {
      const res = await getFolderContents(currentSharedByMeFolderId);
      setSharedByMeFolderContents({
        folders: res.data?.folders || [],
        files: res.data?.files || [],
      });
      if (res.data?.folder?.name) {
        setSharedByMeBreadcrumbs((prev) => {
          if (
            prev.length > 1 &&
            prev[prev.length - 1].id === currentSharedByMeFolderId &&
            prev[prev.length - 1].name !== res.data.folder.name
          ) {
            const next = [...prev];
            next[next.length - 1] = { ...next[next.length - 1], name: res.data.folder.name };
            return next;
          }
          return prev;
        });
      }
      setSharedByMeFolderInitialized(true);
      setSharedByMeFolderLoading(false);
    } catch (err) {
      if (
        err.status === 404 ||
        err.message?.includes('404') ||
        err.message?.includes('not exist')
      ) {
        setSharedByMeBreadcrumbs([{ id: null, name: 'Shared by me' }]);
        showNotification('This folder no longer exists.', 'error');
        navigate('/dashboard/shared-by-me');
        fetchSharedByMe();
      } else {
        setSharedByMeFolderError(err.message || 'Failed to load folder contents.');
        setSharedByMeFolderLoading(false);
      }
    }
  }, [currentSharedByMeFolderId, fetchSharedByMe, navigate]);

  useEffect(() => {
    fetchSharedWithMe();
    fetchSharedByMe();
  }, [fetchSharedWithMe, fetchSharedByMe]);

  useEffect(() => {
    if (activeSection === 'shared-with-me') {
      if (currentSharedFolderId !== null) {
        fetchSharedFolderContents();
      } else {
        fetchSharedWithMe();
      }
    } else if (activeSection === 'shared-by-me') {
      if (currentSharedByMeFolderId !== null) {
        fetchSharedByMeFolderContents();
      } else {
        fetchSharedByMe();
      }
    }
  }, [
    activeSection,
    currentSharedFolderId,
    currentSharedByMeFolderId,
    fetchSharedFolderContents,
    fetchSharedWithMe,
    fetchSharedByMeFolderContents,
    fetchSharedByMe,
  ]);

  const handleFilesUploadRef = useRef();

  // ── Window drag & drop ───────────────────────────────────────────────────────
  useEffect(() => {
    let dragCounter = 0;

    function handleWindowDragEnter(e) {
      e.preventDefault();
      dragCounter++;
      const types = Array.from(e.dataTransfer.types || []);
      if (types.includes('Files') && !types.includes('application/x-filenest-item')) {
        setIsWindowDragOver(true);
      }
    }

    function handleWindowDragLeave(e) {
      e.preventDefault();
      dragCounter--;
      if (dragCounter <= 0) {
        dragCounter = 0;
        setIsWindowDragOver(false);
      }
    }

    function handleWindowDragOver(e) {
      e.preventDefault();
    }

    function handleWindowDrop(e) {
      e.preventDefault();
      dragCounter = 0;
      setIsWindowDragOver(false);
      const types = Array.from(e.dataTransfer.types || []);
      if (types.includes('application/x-filenest-item')) {
        return;
      }
      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        handleFilesUploadRef.current?.(e.dataTransfer.files);
      }
    }

    window.addEventListener('dragenter', handleWindowDragEnter);
    window.addEventListener('dragleave', handleWindowDragLeave);
    window.addEventListener('dragover', handleWindowDragOver);
    window.addEventListener('drop', handleWindowDrop);

    return () => {
      window.removeEventListener('dragenter', handleWindowDragEnter);
      window.removeEventListener('dragleave', handleWindowDragLeave);
      window.removeEventListener('dragover', handleWindowDragOver);
      window.removeEventListener('drop', handleWindowDrop);
    };
  }, []);

  function showNotification(message, type = 'success') {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3500);
  }

  // ── Folder navigation ────────────────────────────────────────────────────────
  function handleOpenFolder(folder) {
    if (!folder?._id) return;
    setBreadcrumbs((prev) => {
      if (prev.length > 0 && prev[prev.length - 1].id === folder._id) {
        return prev;
      }
      return [...prev, { id: folder._id, name: folder.name }];
    });
    setSearchQuery('');
  }

  function handleBreadcrumbNavigate(folderId) {
    setBreadcrumbs((prev) => {
      if (folderId === null) return [{ id: null, name: 'My Files' }];
      const idx = prev.findIndex((b) => b.id === folderId);
      if (idx === -1) return [{ id: null, name: 'My Files' }];
      return prev.slice(0, idx + 1);
    });
  }

  // ── Sync Shared with me breadcrumbs when route folderId changes ─────────────
  useEffect(() => {
    if (section === 'shared-with-me') {
      if (folderId) {
        setSharedBreadcrumbs((prev) => {
          if (prev[prev.length - 1]?.id === folderId) return prev;
          const found =
            sharedWithMeFolders.find((f) => f._id === folderId) ||
            sharedFolderContents.folders.find((f) => f._id === folderId);
          return [
            { id: null, name: 'Shared with me' },
            {
              id: folderId,
              name: found?.name || 'Folder',
              owner: found?.owner || sharedFolderContents.folder?.owner || prev[1]?.owner || null,
            },
          ];
        });
      } else {
        setSharedBreadcrumbs([{ id: null, name: 'Shared with me' }]);
        setCurrentSharedFolderPermission(null);
      }
    }
  }, [section, folderId, sharedWithMeFolders, sharedFolderContents.folders, sharedFolderContents.folder]);

  // ── Shared with me navigation ───────────────────────────────────────────────
  function handleOpenSharedFolder(folder) {
    if (!folder?._id) return;
    setCurrentSharedFolderPermission(folder.myPermission || folder.permission || 'viewer');
    setSharedBreadcrumbs((prev) => [
      ...prev,
      {
        id: folder._id,
        name: folder.name,
        owner: folder.owner || prev[1]?.owner || prev[prev.length - 1]?.owner || null,
      },
    ]);
    setSearchQuery('');
    navigate(`/dashboard/shared-with-me/${folder._id}`);
  }

  function handleSharedBreadcrumbNavigate(targetId) {
    if (targetId === null) {
      setSharedBreadcrumbs([{ id: null, name: 'Shared with me' }]);
      setCurrentSharedFolderPermission(null);
      navigate('/dashboard/shared-with-me');
    } else {
      const idx = sharedBreadcrumbs.findIndex((b) => b.id === targetId);
      if (idx !== -1) {
        setSharedBreadcrumbs(sharedBreadcrumbs.slice(0, idx + 1));
        navigate(`/dashboard/shared-with-me/${targetId}`);
      }
    }
  }

  // ── Sync Shared by me breadcrumbs when route folderId changes ───────────────
  useEffect(() => {
    if (section === 'shared-by-me') {
      if (folderId) {
        setSharedByMeBreadcrumbs((prev) => {
          if (prev[prev.length - 1]?.id === folderId) return prev;
          const found =
            sharedByMeFolders.find((f) => f._id === folderId) ||
            sharedByMeFolderContents.folders.find((f) => f._id === folderId);
          return [
            { id: null, name: 'Shared by me' },
            { id: folderId, name: found?.name || 'Folder' },
          ];
        });
      } else {
        setSharedByMeBreadcrumbs([{ id: null, name: 'Shared by me' }]);
      }
    }
  }, [section, folderId, sharedByMeFolders, sharedByMeFolderContents.folders]);

  // ── Shared by me navigation ─────────────────────────────────────────────────
  function handleOpenSharedByMeFolder(folder) {
    if (!folder?._id) return;
    setSharedByMeBreadcrumbs((prev) => [...prev, { id: folder._id, name: folder.name }]);
    setSearchQuery('');
    navigate(`/dashboard/shared-by-me/${folder._id}`);
  }

  function handleSharedByMeBreadcrumbNavigate(targetId) {
    if (targetId === null) {
      setSharedByMeBreadcrumbs([{ id: null, name: 'Shared by me' }]);
      navigate('/dashboard/shared-by-me');
    } else {
      const idx = sharedByMeBreadcrumbs.findIndex((b) => b.id === targetId);
      if (idx !== -1) {
        setSharedByMeBreadcrumbs(sharedByMeBreadcrumbs.slice(0, idx + 1));
        navigate(`/dashboard/shared-by-me/${targetId}`);
      }
    }
  }

  // ── Leave share handler (remove own direct grant or delete inherited item) ───
  async function handleLeaveShare(item, itemType = 'file') {
    // If inside a shared folder or item is inherited, removing it means deleting it from the shared folder for editors
    if (item.inherited || currentSharedFolderId !== null) {
      if (itemType === 'folder') {
        setDeleteFolderTarget(item);
      } else {
        setDeleteConfirmFile(item);
      }
      return;
    }

    try {
      const res =
        itemType === 'folder'
          ? await leaveFolderShare(item._id)
          : await leaveFileShare(item._id);

      if (res.data?.stillHasAccess) {
        const parentName = res.data?.throughFolder?.name || 'a parent folder';
        showNotification(`You still have access through '${parentName}'.`);
      } else {
        showNotification('Removed from Shared with me.');
      }
      fetchSharedWithMe();
      handleContentsRefresh();
    } catch (err) {
      showNotification(err.message || 'Failed to remove share.', 'error');
    }
  }

  // ── Category sidebar changes: reset to root & switch category ────────────────
  function handleCategoryChange(categoryId) {
    setBreadcrumbs([{ id: null, name: 'My Files' }]);
    setActiveCategory(categoryId);
    setSearchQuery('');
    if (activeSection !== 'files') {
      navigate('/dashboard');
    }
  }

  // ── Download handler ─────────────────────────────────────────────────────────
  async function handleDownload(file) {
    if (!file?._id) return;
    setDownloadingId(file._id);
    try {
      const data = await getDownloadUrl(file._id);
      const url = data.data?.result;

      if (!url) throw new Error('Storage service did not provide a download link.');

      const response = await fetch(url);
      if (!response.ok) throw new Error('Failed to download file from storage.');
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = file.originalName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);

      showNotification(`Downloaded ${file.originalName}`);
    } catch (err) {
      showNotification(err.message || 'Download failed.', 'error');
    } finally {
      setDownloadingId(null);
    }
  }

  // ── Delete file handler (optimistic) ─────────────────────────────────────────
  async function handleDeleteConfirm(file) {
    if (!file?._id) return;
    setDeletingId(file._id);

    // Snapshot for rollback
    const prevFolderFiles = folderFiles;
    const prevAllFiles = allFiles;
    const prevSharedWithMeFiles = sharedWithMeFiles;
    const prevSharedByMeFiles = sharedByMeFiles;
    const prevSharedFolderFiles = sharedFolderContents.files;
    const prevSharedByMeFolderFiles = sharedByMeFolderContents.files;

    // Optimistic: remove immediately from all lists
    const removeFile = (arr) => arr.filter((f) => f._id !== file._id);
    setFolderFiles(removeFile);
    setAllFiles(removeFile);
    setSharedWithMeFiles(removeFile);
    setSharedByMeFiles(removeFile);
    setSharedFolderContents((prev) => ({ ...prev, files: removeFile(prev.files) }));
    setSharedByMeFolderContents((prev) => ({ ...prev, files: removeFile(prev.files) }));
    setRootCounts((prev) => ({ ...prev, files: Math.max(0, prev.files - 1) }));

    setDeleteConfirmFile(null);
    if (previewFile?._id === file._id) setPreviewFile(null);
    showNotification(`Deleted ${file.originalName}`);

    try {
      await deleteFile(file._id);
      // Background reconcile (no loading state)
      handleContentsRefresh();
    } catch (err) {
      // Rollback
      setFolderFiles(prevFolderFiles);
      setAllFiles(prevAllFiles);
      setSharedWithMeFiles(prevSharedWithMeFiles);
      setSharedByMeFiles(prevSharedByMeFiles);
      setSharedFolderContents((prev) => ({ ...prev, files: prevSharedFolderFiles }));
      setSharedByMeFolderContents((prev) => ({ ...prev, files: prevSharedByMeFolderFiles }));
      setRootCounts((prev) => ({ ...prev, files: prev.files + 1 }));
      showNotification(err.message || 'Delete failed.', 'error');
    } finally {
      setDeletingId(null);
    }
  }

  // ── After any mutation: background reconcile (never blanks the list) ──────────
  function handleContentsRefresh() {
    // Fire all fetches concurrently; they silently update state in the background.
    // None of them set a loading=true, so the current data stays visible.
    fetchCurrentContents();
    fetchAllFiles();
    fetchRootCounts();
    fetchSharedWithMe();
    fetchSharedByMe();
    if (currentSharedFolderId) fetchSharedFolderContents();
    if (currentSharedByMeFolderId) fetchSharedByMeFolderContents();
  }

  // ── Drag & drop move handler for files & folders (optimistic) ───────────────
  const handleDropItemOnFolder = useCallback(
    async (targetFolder, itemData) => {
      if (!itemData || !itemData.id) return;
      const targetFolderId = targetFolder?._id || null;
      const targetFolderName = targetFolder?.name || 'My Files';

      // Cannot move folder into itself
      if (itemData.itemType === 'folder' && itemData.id === targetFolderId) {
        return;
      }

      // Optimistic: remove from current view immediately
      const snapshotFolderFolders = folderFolders;
      const snapshotFolderFiles = folderFiles;
      if (itemData.itemType === 'file') {
        setFolderFiles((prev) => prev.filter((f) => f._id !== itemData.id));
      } else {
        setFolderFolders((prev) => prev.filter((f) => f._id !== itemData.id));
      }

      try {
        if (itemData.itemType === 'file') {
          await moveFile(itemData.id, targetFolderId);
          showNotification(`Moved "${itemData.name}" into "${targetFolderName}".`);
        } else if (itemData.itemType === 'folder') {
          await moveFolder(itemData.id, targetFolderId);
          showNotification(`Moved folder "${itemData.name}" into "${targetFolderName}".`);
        }
        handleContentsRefresh();
      } catch (err) {
        // Rollback
        setFolderFolders(snapshotFolderFolders);
        setFolderFiles(snapshotFolderFiles);
        showNotification(err.message || 'Failed to move item.', 'error');
      }
    },
    [folderFolders, folderFiles, fetchCurrentContents, fetchAllFiles, fetchRootCounts]
  );

  // ── Direct file upload handler (native file browsing) ─────────────────────────
  async function handleFilesUpload(filesList) {
    if (!filesList || filesList.length === 0 || isUploading) return;
    const files = Array.from(filesList);
    setIsUploading(true);

    try {
      const CONCURRENCY = 3;
      let completedCount = 0;
      let successCount = 0;

      // Track individual file progress for smooth aggregate display
      const progressMap = new Array(files.length).fill(0);

      const updateProgressDisplay = () => {
        if (files.length === 1) {
          const pct = progressMap[0] || 0;
          setUploadProgressText(`Uploading ${pct}%`);
        } else {
          const totalProgress = Math.round(
            progressMap.reduce((acc, curr) => acc + curr, 0) / files.length
          );
          setUploadProgressText(`${completedCount}/${files.length} • ${totalProgress}%`);
        }
      };

      updateProgressDisplay();

      const uploadSingleFile = async (file, index) => {
        const originalName = file.name;
        const mimeType = file.type || 'application/octet-stream';
        const size = file.size;

        // 1. Get presigned upload URL
        const urlRes = await getUploadUrl({ originalName, mimeType });
        const { key, uploadUrl } = urlRes.data || {};
        if (!uploadUrl || !key) {
          throw new Error(`Failed to authorize upload for ${originalName}`);
        }

        // 2. Upload directly to S3 with live progress
        await uploadToS3(
          uploadUrl,
          file,
          (pct) => {
            progressMap[index] = pct;
            updateProgressDisplay();
          },
          mimeType
        );

        // 3. Confirm metadata
        const targetFolder = isSharedWithMeView
          ? currentSharedFolderId
          : isSharedByMeView
          ? currentSharedByMeFolderId
          : isMyFilesView
          ? currentFolderId
          : null;
        const confirmRes = await confirmUpload({ originalName, mimeType, size, key, folder: targetFolder || null });
        const uploadedFile = confirmRes?.data;
        if (uploadedFile?._id) {
          const fileToInsert = {
            ...uploadedFile,
            owner: (uploadedFile.owner && typeof uploadedFile.owner === 'object' && (uploadedFile.owner.name || uploadedFile.owner.email))
              ? uploadedFile.owner
              : {
                  _id: currentUser?._id,
                  name: currentUser?.name,
                  email: currentUser?.email,
                  avatar: currentUser?.avatar || null,
                },
          };
          if (isSharedWithMeView && currentSharedFolderId) {
            setSharedFolderContents((prev) => ({ ...prev, files: [fileToInsert, ...prev.files] }));
          } else if (isSharedByMeView && currentSharedByMeFolderId) {
            setSharedByMeFolderContents((prev) => ({ ...prev, files: [fileToInsert, ...prev.files] }));
          } else {
            setFolderFiles((prev) => [fileToInsert, ...prev]);
            setAllFiles((prev) => [fileToInsert, ...prev]);
            if (currentFolderId === null) {
              setRootCounts((prev) => ({ ...prev, files: prev.files + 1 }));
            }
          }
        }

        completedCount++;
        successCount++;
        progressMap[index] = 100;
        updateProgressDisplay();
      };

      // Work through files with concurrency limit
      const queue = files.map((file, idx) => ({ file, idx }));
      const workers = Array.from({ length: Math.min(CONCURRENCY, files.length) }, async () => {
        while (queue.length > 0) {
          const item = queue.shift();
          if (item) {
            await uploadSingleFile(item.file, item.idx);
          }
        }
      });

      await Promise.all(workers);

      showNotification(
        successCount === 1
          ? `Uploaded ${files[0].name} successfully!`
          : `Uploaded ${successCount} files successfully!`
      );
      // Background reconcile after upload — keeps current list visible
      handleContentsRefresh();
    } catch (err) {
      showNotification(err.message || 'File upload failed. Please try again.', 'error');
    } finally {
      setIsUploading(false);
      setUploadProgressText('');
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  }

  handleFilesUploadRef.current = handleFilesUpload;

  // ── Filter & sort files for category views ────────────────────────────────────
  // Category views (images, documents, media, other) work on ALL files globally
  const categoryFilteredFiles = useMemo(() => {
    let result = [...allFiles];

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      result = result.filter((f) => (f.originalName || '').toLowerCase().includes(query));
    }

    if (activeCategory !== 'all') {
      result = result.filter((f) => getFileCategory(f) === activeCategory);
    }

    result.sort((a, b) => {
      switch (sortBy) {
        case 'newest': return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
        case 'oldest': return new Date(a.createdAt || 0) - new Date(b.createdAt || 0);
        case 'name-asc': return (a.originalName || '').localeCompare(b.originalName || '');
        case 'name-desc': return (b.originalName || '').localeCompare(a.originalName || '');
        case 'size-desc': return (b.size || 0) - (a.size || 0);
        case 'size-asc': return (a.size || 0) - (b.size || 0);
        default: return 0;
      }
    });

    return result;
  }, [allFiles, searchQuery, activeCategory, sortBy]);

  // ── Filter & sort files for My Files (folder-aware) ───────────────────────────
  const folderFilteredFiles = useMemo(() => {
    let result = [...folderFiles];

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      result = result.filter((f) => (f.originalName || '').toLowerCase().includes(query));
    }

    result.sort((a, b) => {
      switch (sortBy) {
        case 'newest': return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
        case 'oldest': return new Date(a.createdAt || 0) - new Date(b.createdAt || 0);
        case 'name-asc': return (a.originalName || '').localeCompare(b.originalName || '');
        case 'name-desc': return (b.originalName || '').localeCompare(a.originalName || '');
        case 'size-desc': return (b.size || 0) - (a.size || 0);
        case 'size-asc': return (a.size || 0) - (b.size || 0);
        default: return 0;
      }
    });

    return result;
  }, [folderFiles, searchQuery, sortBy]);

  // Sort folders
  const folderFilteredFolders = useMemo(() => {
    let result = [...folderFolders];

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      result = result.filter((f) => (f.name || '').toLowerCase().includes(query));
    }

    result.sort((a, b) => {
      const aDate = new Date(a.createdAt || (a._id ? parseInt(a._id.toString().substring(0, 8), 16) * 1000 : 0));
      const bDate = new Date(b.createdAt || (b._id ? parseInt(b._id.toString().substring(0, 8), 16) * 1000 : 0));
      if (sortBy === 'name-desc') return (b.name || '').localeCompare(a.name || '');
      if (sortBy === 'oldest') return aDate - bDate;
      if (sortBy === 'newest') return bDate - aDate;
      // name-asc + anything else: alphabetical
      return (a.name || '').localeCompare(b.name || '');
    });

    return result;
  }, [folderFolders, searchQuery, sortBy]);

  // ── Filter & sort files for Shared with me ────────────────────────────────────
  const sharedWithMeFilteredFiles = useMemo(() => {
    const rawSource = currentSharedFolderId !== null ? sharedFolderContents.files : sharedWithMeFiles;

    const mainFolderUser =
      sharedRootFolder?.owner ||
      sharedFolderContents.folder?.owner ||
      sharedWithMeFolders.find((f) => f._id === currentSharedFolderId)?.owner ||
      sharedWithMeFolders.find((f) => f._id === sharedBreadcrumbs[1]?.id)?.owner ||
      null;

    const currentUserId = (currentUser?._id || currentUser?.id)?.toString();
    const currentUserEmail = currentUser?.email?.toLowerCase();

    const source = rawSource.map((file) => {
      const fileOwnerId =
        typeof file.owner === 'object' && file.owner !== null
          ? (file.owner._id || file.owner.id || '').toString()
          : String(file.owner || '');
      const fileOwnerEmail =
        typeof file.owner === 'object' && file.owner !== null
          ? file.owner.email?.toLowerCase()
          : (typeof file.owner === 'string' && file.owner.includes('@') ? file.owner.toLowerCase() : null);

      const isMine = Boolean(
        (currentUserId && fileOwnerId && currentUserId === fileOwnerId) ||
        (currentUserEmail && fileOwnerEmail && currentUserEmail === fileOwnerEmail) ||
        file.myPermission === 'owner'
      );

      if (isMine) {
        return {
          ...file,
          owner: (typeof file.owner === 'object' && file.owner !== null && (file.owner.name || file.owner.email))
            ? file.owner
            : {
                _id: currentUser?._id,
                name: currentUser?.name,
                email: currentUser?.email,
                avatar: currentUser?.avatar || null,
              },
        };
      }

      const hasValidOwner =
        file.owner &&
        typeof file.owner === 'object' &&
        (file.owner.name || file.owner.email) &&
        file.owner.name !== 'Unknown';

      if (!hasValidOwner && mainFolderUser) {
        return { ...file, owner: mainFolderUser };
      }
      return file;
    });

    let result = [...source];

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      result = result.filter((f) => (f.originalName || '').toLowerCase().includes(query));
    }

    result.sort((a, b) => {
      switch (sortBy) {
        case 'newest': return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
        case 'oldest': return new Date(a.createdAt || 0) - new Date(b.createdAt || 0);
        case 'name-asc': return (a.originalName || '').localeCompare(a.originalName || '');
        case 'name-desc': return (b.originalName || '').localeCompare(a.originalName || '');
        case 'size-desc': return (b.size || 0) - (a.size || 0);
        case 'size-asc': return (a.size || 0) - (b.size || 0);
        default: return 0;
      }
    });

    return result;
  }, [
    currentSharedFolderId,
    sharedFolderContents.files,
    sharedFolderContents.folder,
    sharedWithMeFiles,
    sharedWithMeFolders,
    sharedRootFolder,
    sharedBreadcrumbs,
    searchQuery,
    sortBy,
    currentUser,
  ]);

  // ── Filter & sort folders for Shared with me ──────────────────────────────────
  const sharedWithMeFilteredFolders = useMemo(() => {
    const rawSource = currentSharedFolderId !== null ? sharedFolderContents.folders : sharedWithMeFolders;

    const mainFolderUser =
      sharedRootFolder?.owner ||
      sharedFolderContents.folder?.owner ||
      sharedWithMeFolders.find((f) => f._id === currentSharedFolderId)?.owner ||
      sharedWithMeFolders.find((f) => f._id === sharedBreadcrumbs[1]?.id)?.owner ||
      null;

    const currentUserId = (currentUser?._id || currentUser?.id)?.toString();
    const currentUserEmail = currentUser?.email?.toLowerCase();

    const source = rawSource.map((fldr) => {
      const fldrOwnerId =
        typeof fldr.owner === 'object' && fldr.owner !== null
          ? (fldr.owner._id || fldr.owner.id || '').toString()
          : String(fldr.owner || '');
      const fldrOwnerEmail =
        typeof fldr.owner === 'object' && fldr.owner !== null
          ? fldr.owner.email?.toLowerCase()
          : (typeof fldr.owner === 'string' && fldr.owner.includes('@') ? fldr.owner.toLowerCase() : null);

      const isMine = Boolean(
        (currentUserId && fldrOwnerId && currentUserId === fldrOwnerId) ||
        (currentUserEmail && fldrOwnerEmail && currentUserEmail === fldrOwnerEmail) ||
        fldr.myPermission === 'owner'
      );

      if (isMine) {
        return {
          ...fldr,
          owner: (typeof fldr.owner === 'object' && fldr.owner !== null && (fldr.owner.name || fldr.owner.email))
            ? fldr.owner
            : {
                _id: currentUser?._id,
                name: currentUser?.name,
                email: currentUser?.email,
                avatar: currentUser?.avatar || null,
              },
        };
      }

      const hasValidOwner =
        fldr.owner &&
        typeof fldr.owner === 'object' &&
        (fldr.owner.name || fldr.owner.email) &&
        fldr.owner.name !== 'Unknown';

      if (!hasValidOwner && mainFolderUser) {
        return { ...fldr, owner: mainFolderUser };
      }
      return fldr;
    });

    let result = [...source];

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      result = result.filter((f) => (f.name || '').toLowerCase().includes(query));
    }

    result.sort((a, b) => {
      const aDate = new Date(a.createdAt || (a._id ? parseInt(a._id.toString().substring(0, 8), 16) * 1000 : 0));
      const bDate = new Date(b.createdAt || (b._id ? parseInt(b._id.toString().substring(0, 8), 16) * 1000 : 0));
      if (sortBy === 'name-desc') return (b.name || '').localeCompare(a.name || '');
      if (sortBy === 'oldest') return aDate - bDate;
      if (sortBy === 'newest') return bDate - aDate;
      return (a.name || '').localeCompare(b.name || '');
    });

    return result;
  }, [
    currentSharedFolderId,
    sharedFolderContents.folders,
    sharedFolderContents.folder,
    sharedWithMeFolders,
    sharedRootFolder,
    sharedBreadcrumbs,
    searchQuery,
    sortBy,
    currentUser,
  ]);

  // ── Filter & sort files for Shared by me ──────────────────────────────────────
  const sharedByMeFilteredFiles = useMemo(() => {
    const rawSource = currentSharedByMeFolderId !== null ? sharedByMeFolderContents.files : sharedByMeFiles;
    const source = rawSource.map((file) => {
      if ((file.grantees && file.grantees.length > 0) || file.granteeCount > 0) {
        return file;
      }
      if (sharedByMeRootFolder) {
        return {
          ...file,
          grantees: sharedByMeRootFolder.grantees || sharedByMeRootFolder.sharedWith || [],
          granteeCount: sharedByMeRootFolder.granteeCount || (sharedByMeRootFolder.grantees?.length ?? 0),
          sharedAt: file.sharedAt || sharedByMeRootFolder.sharedAt,
        };
      }
      return file;
    });

    let result = [...source];

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      result = result.filter((f) => (f.originalName || '').toLowerCase().includes(query));
    }

    result.sort((a, b) => {
      switch (sortBy) {
        case 'newest': return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
        case 'oldest': return new Date(a.createdAt || 0) - new Date(b.createdAt || 0);
        case 'name-asc': return (a.originalName || '').localeCompare(a.originalName || '');
        case 'name-desc': return (b.originalName || '').localeCompare(a.originalName || '');
        case 'size-desc': return (b.size || 0) - (a.size || 0);
        case 'size-asc': return (a.size || 0) - (b.size || 0);
        default: return 0;
      }
    });

    return result;
  }, [currentSharedByMeFolderId, sharedByMeFolderContents.files, sharedByMeFiles, sharedByMeRootFolder, searchQuery, sortBy]);

  // ── Filter & sort folders for Shared by me ────────────────────────────────────
  const sharedByMeFilteredFolders = useMemo(() => {
    const rawSource = currentSharedByMeFolderId !== null ? sharedByMeFolderContents.folders : sharedByMeFolders;
    const source = rawSource.map((fldr) => {
      if ((fldr.grantees && fldr.grantees.length > 0) || fldr.granteeCount > 0) {
        return fldr;
      }
      if (sharedByMeRootFolder) {
        return {
          ...fldr,
          grantees: sharedByMeRootFolder.grantees || sharedByMeRootFolder.sharedWith || [],
          granteeCount: sharedByMeRootFolder.granteeCount || (sharedByMeRootFolder.grantees?.length ?? 0),
          sharedAt: fldr.sharedAt || sharedByMeRootFolder.sharedAt,
        };
      }
      return fldr;
    });

    let result = [...source];

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      result = result.filter((f) => (f.name || '').toLowerCase().includes(query));
    }

    result.sort((a, b) => {
      const aDate = new Date(a.createdAt || (a._id ? parseInt(a._id.toString().substring(0, 8), 16) * 1000 : 0));
      const bDate = new Date(b.createdAt || (b._id ? parseInt(b._id.toString().substring(0, 8), 16) * 1000 : 0));
      if (sortBy === 'name-desc') return (b.name || '').localeCompare(a.name || '');
      if (sortBy === 'oldest') return aDate - bDate;
      if (sortBy === 'newest') return bDate - aDate;
      return (a.name || '').localeCompare(b.name || '');
    });

    return result;
  }, [currentSharedByMeFolderId, sharedByMeFolderContents.folders, sharedByMeFolders, sharedByMeRootFolder, searchQuery, sortBy]);

  // ── Category counts ───────────────────────────────────────────────────────────
  const categoryCounts = useMemo(() => {
    const rootTotal = (rootCounts?.folders || 0) + (rootCounts?.files || 0);
    const counts = { all: rootTotal, images: 0, documents: 0, media: 0, other: 0 };
    allFiles.forEach((file) => {
      const cat = getFileCategory(file);
      if (counts[cat] !== undefined) counts[cat]++;
      else counts.other++;
    });
    return counts;
  }, [allFiles, rootCounts]);

  // ── Derived UI values ─────────────────────────────────────────────────────────
  const currentSortLabel = SORT_OPTIONS.find((opt) => opt.id === sortBy)?.label || 'Newest first';

  // Determine what section we're showing
  const isCategoryView = activeSection === 'files' && activeCategory !== 'all';
  const isMyFilesView = activeSection === 'files' && activeCategory === 'all';
  const isSharedWithMeView = activeSection === 'shared-with-me';
  const isSharedByMeView = activeSection === 'shared-by-me';

  let pageTitle;
  if (isMyFilesView) {
    pageTitle = breadcrumbs[breadcrumbs.length - 1]?.name || 'My Files';
  } else if (isSharedWithMeView) {
    pageTitle = sharedBreadcrumbs[sharedBreadcrumbs.length - 1]?.name || 'Shared with me';
  } else if (isSharedByMeView) {
    pageTitle = sharedByMeBreadcrumbs[sharedByMeBreadcrumbs.length - 1]?.name || 'Shared by me';
  } else {
    pageTitle = CATEGORY_TITLES[activeCategory] || 'All files';
  }

  // Count label
  let countLabel;
  if (isMyFilesView) {
    const fCount = folderFilteredFolders.length;
    const fiCount = folderFilteredFiles.length;
    const total = fCount + fiCount;
    const parts = [];
    if (fCount > 0) parts.push(`${fCount} ${fCount === 1 ? 'folder' : 'folders'}`);
    if (fiCount > 0) parts.push(`${fiCount} ${fiCount === 1 ? 'file' : 'files'}`);
    countLabel = total === 0 ? '' : parts.join(', ');
  } else if (isSharedWithMeView) {
    const fCount = sharedWithMeFilteredFolders.length;
    const fiCount = sharedWithMeFilteredFiles.length;
    const total = fCount + fiCount;
    const parts = [];
    if (fCount > 0) parts.push(`${fCount} ${fCount === 1 ? 'folder' : 'folders'}`);
    if (fiCount > 0) parts.push(`${fiCount} ${fiCount === 1 ? 'file' : 'files'}`);
    countLabel = total === 0 ? '' : parts.join(', ');
  } else if (isSharedByMeView) {
    const fCount = sharedByMeFilteredFolders.length;
    const fiCount = sharedByMeFilteredFiles.length;
    const total = fCount + fiCount;
    const parts = [];
    if (fCount > 0) parts.push(`${fCount} ${fCount === 1 ? 'folder' : 'folders'}`);
    if (fiCount > 0) parts.push(`${fiCount} ${fiCount === 1 ? 'file' : 'files'}`);
    countLabel = total === 0 ? '' : parts.join(', ');
  } else {
    const n = categoryFilteredFiles.length;
    countLabel = `${n} ${n === 1 ? 'file' : 'files'}`;
  }

  // ── Empty state logic ─────────────────────────────────────────────────────────
  function renderMyFilesEmpty() {
    const noFolders = folderFilteredFolders.length === 0;
    const noFiles = folderFilteredFiles.length === 0;

    if (!noFolders || !noFiles) return null; // not empty

    if (searchQuery.trim()) {
      return (
        <div className="empty-state">
          <div className="empty-state-content">
            <div className="empty-state-icon-wrap">
              <svg width={36} height={36} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" style={{ color: '#6e7076' }}>
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
            </div>
            <p className="empty-state-title">No matching files or folders</p>
            <p className="empty-state-desc">No items matched "{searchQuery.trim()}".</p>
          </div>
        </div>
      );
    }

    const msg = isInFolder
      ? 'This folder is empty. Upload files or create a subfolder.'
      : 'No files or folders yet. Upload a file or create a folder.';

    return (
      <div className="empty-state">
        <div className="empty-state-content">
          <div className="empty-state-icon-wrap">
            {/* reuse existing empty-state icon style */}
            <svg width={36} height={36} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" style={{ color: '#6e7076' }}>
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
            </svg>
          </div>
          <p className="empty-state-title">{isInFolder ? 'Empty folder' : 'No files or folders yet'}</p>
          <p className="empty-state-desc">{msg}</p>
        </div>
      </div>
    );
  }

  // ── Render My Files content ───────────────────────────────────────────────────
  function renderMyFiles() {
    // Show skeleton only until the very first load completes
    if (!folderInitialized && folderLoading) {
      return (
        <div className="filelist-status">
          <div className="filelist-spinner" />
          <p className="filelist-status-text">Loading...</p>
        </div>
      );
    }

    if (folderError) {
      return (
        <div className="filelist-status">
          <p className="filelist-status-text filelist-status-error">{folderError}</p>
          <button className="filelist-retry-btn" onClick={fetchCurrentContents}>
            Retry
          </button>
        </div>
      );
    }

    const isEmpty = folderFilteredFolders.length === 0 && folderFilteredFiles.length === 0;
    if (isEmpty) return renderMyFilesEmpty();

    if (viewMode === 'grid') {
      return (
        <div className="dash-grid-container">
          {folderFilteredFolders.length > 0 && (
            <div className="dash-grid-section">
              <h3 className="dash-section-title">Folders</h3>
              <div className="dash-grid-folders">
                {folderFilteredFolders.map((folder) => (
                  <FolderCard
                    key={folder._id}
                    folder={folder}
                    onOpen={handleOpenFolder}
                    onRename={setRenameFolderTarget}
                    onDelete={setDeleteFolderTarget}
                    onShare={(f) => setShareModalTarget({ item: f, itemType: 'folder' })}
                    onMove={(f) => setMoveTarget({ item: f, itemType: 'folder' })}
                    onLeave={(f) => handleLeaveShare(f, 'folder')}
                    onDropItem={handleDropItemOnFolder}
                  />
                ))}
              </div>
            </div>
          )}

          {folderFilteredFiles.length > 0 && (
            <div className="dash-grid-section">
              <h3 className="dash-section-title">Files</h3>
              <div className="dash-grid-files">
                {folderFilteredFiles.map((file) => (
                  <FileCard
                    key={file._id}
                    file={file}
                    onDownload={handleDownload}
                    onDelete={(f) => setDeleteConfirmFile(f)}
                    onPreview={(f) => setPreviewFile(f)}
                    onRename={(f) => setRenameFileTarget(f)}
                    onShare={(f) => setShareModalTarget({ item: f, itemType: 'file' })}
                    onMove={(f) => setMoveTarget({ item: f, itemType: 'file' })}
                    isDownloading={downloadingId === file._id}
                    isDeleting={deletingId === file._id}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      );
    }

    // List view
    return (
      <div className="filelist-container">
        {/* Table header — shared with FileList */}
        <div className="filelist-header">
          <span className="filelist-th filelist-th-name">Name</span>
          <span className="filelist-th filelist-th-owner">Owner</span>
          <span className="filelist-th filelist-th-type">Type</span>
          <span className="filelist-th filelist-th-size">Size</span>
          <span className="filelist-th filelist-th-date">Date added</span>
          <span className="filelist-th filelist-th-actions" aria-hidden="true" />
        </div>
        <div className="filelist-rows" role="table">
          {/* Folders first */}
          {folderFilteredFolders.map((folder) => (
            <FolderRow
              key={folder._id}
              folder={folder}
              onOpen={handleOpenFolder}
              onRename={setRenameFolderTarget}
              onDelete={setDeleteFolderTarget}
              onShare={(f) => setShareModalTarget({ item: f, itemType: 'folder' })}
              onMove={(f) => setMoveTarget({ item: f, itemType: 'folder' })}
              onLeave={(f) => handleLeaveShare(f, 'folder')}
              onDropItem={handleDropItemOnFolder}
            />
          ))}
          {/* Then files */}
          {folderFilteredFiles.map((file) => (
            <FolderViewFileRow
              key={file._id}
              file={file}
              isDownloading={downloadingId === file._id}
              isDeleting={deletingId === file._id}
              onPreview={setPreviewFile}
              onDownload={handleDownload}
              onDelete={setDeleteConfirmFile}
              onRename={setRenameFileTarget}
              onShare={(f) => setShareModalTarget({ item: f, itemType: 'file' })}
              onMove={(f) => setMoveTarget({ item: f, itemType: 'file' })}
              onLeave={(f) => handleLeaveShare(f, 'file')}
            />
          ))}
        </div>
      </div>
    );
  }

  // ── Render Shared with me content ─────────────────────────────────────────────
  function renderSharedWithMe() {
    const isFirstLoad = currentSharedFolderId !== null
      ? sharedFolderLoading && !sharedFolderInitialized
      : sharedWithMeLoading && !sharedWithMeInitialized;
    const error = currentSharedFolderId !== null ? sharedFolderError : sharedWithMeError;

    if (isFirstLoad) {
      return (
        <div className="filelist-status">
          <div className="filelist-spinner" />
          <p className="filelist-status-text">Loading...</p>
        </div>
      );
    }

    if (error) {
      return (
        <div className="filelist-status">
          <p className="filelist-status-text filelist-status-error">{error}</p>
          <button
            className="filelist-retry-btn"
            onClick={currentSharedFolderId !== null ? fetchSharedFolderContents : fetchSharedWithMe}
          >
            Retry
          </button>
        </div>
      );
    }

    const isEmpty = sharedWithMeFilteredFolders.length === 0 && sharedWithMeFilteredFiles.length === 0;
    if (isEmpty) {
      if (searchQuery.trim()) {
        return (
          <div className="empty-state">
            <div className="empty-state-content">
              <div className="empty-state-icon-wrap">
                <Users size={36} strokeWidth={1.5} style={{ color: '#6e7076' }} />
              </div>
              <p className="empty-state-title">No matching files or folders</p>
              <p className="empty-state-desc">No shared items matched "{searchQuery.trim()}".</p>
            </div>
          </div>
        );
      }

      return (
        <div className="empty-state">
          <div className="empty-state-content">
            <div className="empty-state-icon-wrap">
              <Users size={36} strokeWidth={1.5} style={{ color: '#6e7076' }} />
            </div>
            <p className="empty-state-title">
              {currentSharedFolderId !== null ? 'Empty folder' : 'No items shared with you'}
            </p>
            <p className="empty-state-desc">
              {currentSharedFolderId !== null
                ? 'This folder is empty.'
                : 'Files and folders others share with you will appear here.'}
            </p>
          </div>
        </div>
      );
    }

    if (viewMode === 'grid') {
      return (
        <div className="dash-grid-container">
          {sharedWithMeFilteredFolders.length > 0 && (
            <div className="dash-grid-section">
              <h3 className="dash-section-title">Folders</h3>
              <div className="dash-grid-folders">
                {sharedWithMeFilteredFolders.map((folder) => (
                  <FolderCard
                    key={folder._id}
                    folder={folder}
                    onOpen={handleOpenSharedFolder}
                    onRename={setRenameFolderTarget}
                    onDelete={setDeleteFolderTarget}
                    onShare={(f) => setShareModalTarget({ item: f, itemType: 'folder' })}
                    onMove={currentSharedFolderId !== null ? (f) => setMoveTarget({ item: f, itemType: 'folder' }) : undefined}
                    onLeave={(f) => handleLeaveShare(f, 'folder')}
                    sharedView="with-me"
                  />
                ))}
              </div>
            </div>
          )}

          {sharedWithMeFilteredFiles.length > 0 && (
            <div className="dash-grid-section">
              <h3 className="dash-section-title">Files</h3>
              <div className="dash-grid-files">
                {sharedWithMeFilteredFiles.map((file) => (
                  <FileCard
                    key={file._id}
                    file={file}
                    onDownload={handleDownload}
                    onDelete={(f) => setDeleteConfirmFile(f)}
                    onPreview={(f) => setPreviewFile(f)}
                    onRename={(f) => setRenameFileTarget(f)}
                    onShare={(f) => setShareModalTarget({ item: f, itemType: 'file' })}
                    onMove={currentSharedFolderId !== null ? (f) => setMoveTarget({ item: f, itemType: 'file' }) : undefined}
                    onLeave={(f) => handleLeaveShare(f, 'file')}
                    sharedView="with-me"
                    isDownloading={downloadingId === file._id}
                    isDeleting={deletingId === file._id}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      );
    }

    return (
      <div className="filelist-container">
        <div className="filelist-header filelist-header--with-me">
          <span className="filelist-th filelist-th-name">Name</span>
          <span className="filelist-th filelist-th-shared-by">Shared by</span>
          <span className="filelist-th filelist-th-role">Permission</span>
          <span className="filelist-th filelist-th-date">Date shared</span>
          <span className="filelist-th filelist-th-actions" aria-hidden="true" />
        </div>
        <div className="filelist-rows" role="table">
          {sharedWithMeFilteredFolders.map((folder) => (
            <FolderRow
              key={folder._id}
              folder={folder}
              onOpen={handleOpenSharedFolder}
              onRename={setRenameFolderTarget}
              onDelete={setDeleteFolderTarget}
              onShare={(f) => setShareModalTarget({ item: f, itemType: 'folder' })}
              onMove={currentSharedFolderId !== null ? (f) => setMoveTarget({ item: f, itemType: 'folder' }) : undefined}
              onLeave={(f) => handleLeaveShare(f, 'folder')}
              sharedView="with-me"
            />
          ))}
          {sharedWithMeFilteredFiles.map((file) => (
            <FolderViewFileRow
              key={file._id}
              file={file}
              isDownloading={downloadingId === file._id}
              isDeleting={deletingId === file._id}
              onPreview={setPreviewFile}
              onDownload={handleDownload}
              onDelete={setDeleteConfirmFile}
              onRename={setRenameFileTarget}
              onShare={(f) => setShareModalTarget({ item: f, itemType: 'file' })}
              onMove={currentSharedFolderId !== null ? (f) => setMoveTarget({ item: f, itemType: 'file' }) : undefined}
              onLeave={(f) => handleLeaveShare(f, 'file')}
              sharedView="with-me"
            />
          ))}
        </div>
      </div>
    );
  }

  // ── Render Shared by me content ───────────────────────────────────────────────
  function renderSharedByMe() {
    const isFirstLoad = currentSharedByMeFolderId !== null
      ? sharedByMeFolderLoading && !sharedByMeFolderInitialized
      : sharedByMeLoading && !sharedByMeInitialized;
    const error = currentSharedByMeFolderId !== null ? sharedByMeFolderError : sharedByMeError;

    if (isFirstLoad) {
      return (
        <div className="filelist-status">
          <div className="filelist-spinner" />
          <p className="filelist-status-text">Loading...</p>
        </div>
      );
    }

    if (error) {
      return (
        <div className="filelist-status">
          <p className="filelist-status-text filelist-status-error">{error}</p>
          <button
            className="filelist-retry-btn"
            onClick={currentSharedByMeFolderId !== null ? fetchSharedByMeFolderContents : fetchSharedByMe}
          >
            Retry
          </button>
        </div>
      );
    }

    const isEmpty = sharedByMeFilteredFolders.length === 0 && sharedByMeFilteredFiles.length === 0;
    if (isEmpty) {
      if (searchQuery.trim()) {
        return (
          <div className="empty-state">
            <div className="empty-state-content">
              <div className="empty-state-icon-wrap">
                <Share2 size={36} strokeWidth={1.5} style={{ color: '#6e7076' }} />
              </div>
              <p className="empty-state-title">No matching files or folders</p>
              <p className="empty-state-desc">No shared items matched "{searchQuery.trim()}".</p>
            </div>
          </div>
        );
      }

      return (
        <div className="empty-state">
          <div className="empty-state-content">
            <div className="empty-state-icon-wrap">
              <Share2 size={36} strokeWidth={1.5} style={{ color: '#6e7076' }} />
            </div>
            <p className="empty-state-title">
              {currentSharedByMeFolderId !== null ? 'Empty folder' : "You haven't shared anything yet"}
            </p>
            <p className="empty-state-desc">
              {currentSharedByMeFolderId !== null
                ? 'This folder is empty.'
                : 'Items you share with others will appear here.'}
            </p>
          </div>
        </div>
      );
    }

    if (viewMode === 'grid') {
      return (
        <div className="dash-grid-container">
          {sharedByMeFilteredFolders.length > 0 && (
            <div className="dash-grid-section">
              <h3 className="dash-section-title">Folders</h3>
              <div className="dash-grid-folders">
                {sharedByMeFilteredFolders.map((folder) => (
                  <FolderCard
                    key={folder._id}
                    folder={folder}
                    onOpen={handleOpenSharedByMeFolder}
                    onRename={setRenameFolderTarget}
                    onDelete={setDeleteFolderTarget}
                    onShare={(f) => setShareModalTarget({ item: f, itemType: 'folder' })}
                    onMove={currentSharedByMeFolderId !== null ? (f) => setMoveTarget({ item: f, itemType: 'folder' }) : undefined}
                    sharedView="by-me"
                  />
                ))}
              </div>
            </div>
          )}

          {sharedByMeFilteredFiles.length > 0 && (
            <div className="dash-grid-section">
              <h3 className="dash-section-title">Files</h3>
              <div className="dash-grid-files">
                {sharedByMeFilteredFiles.map((file) => (
                  <FileCard
                    key={file._id}
                    file={file}
                    onDownload={handleDownload}
                    onDelete={(f) => setDeleteConfirmFile(f)}
                    onPreview={(f) => setPreviewFile(f)}
                    onRename={(f) => setRenameFileTarget(f)}
                    onShare={(f) => setShareModalTarget({ item: f, itemType: 'file' })}
                    onMove={currentSharedByMeFolderId !== null ? (f) => setMoveTarget({ item: f, itemType: 'file' }) : undefined}
                    sharedView="by-me"
                    isDownloading={downloadingId === file._id}
                    isDeleting={deletingId === file._id}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      );
    }

    return (
      <div className="filelist-container">
        <div className="filelist-header filelist-header--by-me">
          <span className="filelist-th filelist-th-name">Name</span>
          <span className="filelist-th filelist-th-shared-with">Shared with</span>
          <span className="filelist-th filelist-th-date">Date shared</span>
          <span className="filelist-th filelist-th-actions" aria-hidden="true" />
        </div>
        <div className="filelist-rows" role="table">
          {sharedByMeFilteredFolders.map((folder) => (
            <FolderRow
              key={folder._id}
              folder={folder}
              onOpen={handleOpenSharedByMeFolder}
              onRename={setRenameFolderTarget}
              onDelete={setDeleteFolderTarget}
              onShare={(f) => setShareModalTarget({ item: f, itemType: 'folder' })}
              onMove={currentSharedByMeFolderId !== null ? (f) => setMoveTarget({ item: f, itemType: 'folder' }) : undefined}
              sharedView="by-me"
            />
          ))}
          {sharedByMeFilteredFiles.map((file) => (
            <FolderViewFileRow
              key={file._id}
              file={file}
              isDownloading={downloadingId === file._id}
              isDeleting={deletingId === file._id}
              onPreview={setPreviewFile}
              onDownload={handleDownload}
              onDelete={setDeleteConfirmFile}
              onRename={setRenameFileTarget}
              onShare={(f) => setShareModalTarget({ item: f, itemType: 'file' })}
              onMove={currentSharedByMeFolderId !== null ? (f) => setMoveTarget({ item: f, itemType: 'file' }) : undefined}
              sharedView="by-me"
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="dash-layout">
      {/* Top Navbar 56px */}
      <DashboardNavbar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onOpenSettings={() => setSettingsModalOpen(true)}
        isMobileMenuOpen={mobileMenuOpen}
        onToggleMobileMenu={() => setMobileMenuOpen((prev) => !prev)}
      />

      {/* Main Container */}
      <div className="dash-body">
        {/* Left Sidebar 194px (desktop) / Drawer (mobile) */}
        <Sidebar
          files={allFiles}
          categoryCounts={categoryCounts}
          rootCounts={rootCounts}
          sharedWithMeCount={sharedWithMeFolders.length + sharedWithMeFiles.length}
          sharedByMeCount={sharedByMeFolders.length + sharedByMeFiles.length}
          activeSection={activeSection}
          onSectionChange={(sec) => {
            handleSectionChange(sec);
            setMobileMenuOpen(false);
          }}
          activeCategory={activeCategory}
          onCategoryChange={(cat) => {
            handleCategoryChange(cat);
            setMobileMenuOpen(false);
          }}
          isOpen={mobileMenuOpen}
          onClose={() => setMobileMenuOpen(false)}
        />

        {/* Content Area */}
        <main className="dash-main">
          {/* Notification Toast */}
          {notification && (
            <div className={`dash-toast dash-toast--${notification.type}`}>
              {notification.type === 'success' ? (
                <Check size={17} strokeWidth={1.5} />
              ) : (
                <AlertCircle size={17} strokeWidth={1.5} />
              )}
              <span>{notification.message}</span>
            </div>
          )}

          {activeSection === 'storage' ? (
            <div className="dash-content-inner">
              <StorageOverview
                files={allFiles}
                onPreview={(file) => setPreviewFile(file)}
                onDownload={handleDownload}
              />
            </div>
          ) : (
            <div className="dash-content-inner">
              {/* Single Toolbar Row matching UI design exactly */}
              <div className="dash-single-toolbar">
                {/* Left: Breadcrumbs / Title + Count inline */}
                <div className="dash-toolbar-left">
                  {isMyFilesView ? (
                    <FolderBreadcrumb
                      breadcrumbs={breadcrumbs}
                      onNavigate={handleBreadcrumbNavigate}
                      onDropItem={handleDropItemOnFolder}
                    />
                  ) : isSharedWithMeView ? (
                    <FolderBreadcrumb
                      breadcrumbs={sharedBreadcrumbs}
                      onNavigate={handleSharedBreadcrumbNavigate}
                      onDropItem={null}
                    />
                  ) : isSharedByMeView ? (
                    <FolderBreadcrumb
                      breadcrumbs={sharedByMeBreadcrumbs}
                      onNavigate={handleSharedByMeBreadcrumbNavigate}
                      onDropItem={null}
                    />
                  ) : (
                    <nav className="folder-breadcrumb" aria-label="Category view">
                      <div className="folder-breadcrumb-container">
                        {renderCategoryHeaderIcon(activeCategory)}
                        <span className="folder-breadcrumb-current" aria-current="page">
                          {pageTitle}
                        </span>
                      </div>
                    </nav>
                  )}
                  {countLabel && (
                    <span className="dash-count-inline">
                      {countLabel}
                    </span>
                  )}
                </div>

                {/* Right: Controls in exact order matching design: View toggle, Sort, New folder, Upload file */}
                <div className="dash-toolbar-right">
                  {/* View mode toggle */}
                  <div className="dash-view-toggle">
                    <div
                      className={`dash-view-indicator dash-view-indicator--${viewMode}`}
                      aria-hidden="true"
                    />
                    <button
                      type="button"
                      className={`dash-view-btn ${viewMode === 'list' ? 'dash-view-btn--active' : ''}`}
                      onClick={() => setViewMode('list')}
                      title="List view"
                      aria-label="List view"
                    >
                      <List size={16} strokeWidth={1.5} />
                    </button>
                    <button
                      type="button"
                      className={`dash-view-btn ${viewMode === 'grid' ? 'dash-view-btn--active' : ''}`}
                      onClick={() => setViewMode('grid')}
                      title="Grid view"
                      aria-label="Grid view"
                    >
                      <LayoutGrid size={16} strokeWidth={1.5} />
                    </button>
                  </div>

                  {/* Sort dropdown */}
                  <div className="dash-sort-container" ref={sortRef}>
                    <button
                      className="dash-sort-btn"
                      onClick={() => setSortDropdownOpen(!sortDropdownOpen)}
                      aria-expanded={sortDropdownOpen}
                      aria-label="Sort files"
                    >
                      <span>{currentSortLabel}</span>
                      <ChevronDown size={14} strokeWidth={1.5} className="dash-sort-chevron" />
                    </button>

                    {sortDropdownOpen && (
                      <div className="dash-sort-menu" role="menu">
                        {SORT_OPTIONS.map((opt) => (
                          <button
                            key={opt.id}
                            className={`dash-sort-item ${sortBy === opt.id ? 'dash-sort-item--active' : ''}`}
                            onClick={() => {
                              setSortBy(opt.id);
                              setSortDropdownOpen(false);
                            }}
                            role="menuitem"
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Create folder button — shown in My Files or inside a folder in Shared by me */}
                  {(isMyFilesView || (isSharedByMeView && currentSharedByMeFolderId !== null)) && (
                    <button
                      className="dash-new-folder-btn"
                      onClick={() => setCreateFolderOpen(true)}
                      title="New folder"
                      aria-label="New folder"
                    >
                      <SquarePlus size={16} strokeWidth={1.5} />
                      <span>New folder</span>
                    </button>
                  )}

                  {/* Hidden file input for native file browsing */}
                  <input
                    type="file"
                    ref={fileInputRef}
                    style={{ display: 'none' }}
                    multiple
                    onChange={(e) => {
                      if (e.target.files && e.target.files.length > 0) {
                        handleFilesUpload(e.target.files);
                      }
                    }}
                  />

                  {/* Upload file button — shown in My Files or inside a shared folder where user is editor/owner */}
                  {(isMyFilesView || (isSharedWithMeView && currentSharedFolderId !== null && currentSharedFolderPermission === 'editor') || (isSharedByMeView && currentSharedByMeFolderId !== null)) && (
                    <button
                      className={`dash-upload-btn ${isUploading ? 'dash-upload-btn--uploading' : ''}`}
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isUploading}
                      title={isUploading ? (uploadProgressText || 'Uploading...') : 'Upload file'}
                      aria-label="Upload file"
                    >
                      {isUploading ? (
                        <>
                          <span className="dash-upload-spinner" />
                          <span className="dash-upload-btn-text">{uploadProgressText || 'Uploading...'}</span>
                        </>
                      ) : (
                        <>
                          <Upload size={15} strokeWidth={1.8} />
                          <span className="dash-upload-btn-text">Upload file</span>
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>

              {/* ── My Files view (folder-aware) ── */}
              {isMyFilesView && renderMyFiles()}

              {/* ── Shared with me view ── */}
              {isSharedWithMeView && renderSharedWithMe()}

              {/* ── Shared by me view ── */}
              {isSharedByMeView && renderSharedByMe()}

              {/* ── Category filter views (global, not folder-scoped) ── */}
              {isCategoryView && (
                !allFilesInitialized ? (
                  <div className="filelist-status">
                    <div className="filelist-spinner" />
                    <p className="filelist-status-text">Loading files...</p>
                  </div>
                ) : categoryFilteredFiles.length === 0 ? (
                  <EmptyState />
                ) : viewMode === 'grid' ? (
                  <div className="dash-grid-container">
                    <div className="dash-grid-section">
                      <div className="dash-grid-files">
                        {categoryFilteredFiles.map((file) => (
                          <FileCard
                            key={file._id}
                            file={file}
                            onDownload={handleDownload}
                            onDelete={(f) => setDeleteConfirmFile(f)}
                            onPreview={(f) => setPreviewFile(f)}
                            onRename={(f) => setRenameFileTarget(f)}
                            onShare={(f) => setShareModalTarget({ item: f, itemType: 'file' })}
                            onMove={(f) => setMoveTarget({ item: f, itemType: 'file' })}
                            onLeave={(f) => handleLeaveShare(f, 'file')}
                            isDownloading={downloadingId === file._id}
                            isDeleting={deletingId === file._id}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  <FileList
                    files={categoryFilteredFiles}
                    loading={false}
                    error=""
                    onRefresh={fetchAllFiles}
                    onDownload={handleDownload}
                    onDelete={(f) => setDeleteConfirmFile(f)}
                    onPreview={(f) => setPreviewFile(f)}
                    onRename={(f) => setRenameFileTarget(f)}
                    onShare={(f) => setShareModalTarget({ item: f, itemType: 'file' })}
                    onMove={(f) => setMoveTarget({ item: f, itemType: 'file' })}
                    onLeave={(f) => handleLeaveShare(f, 'file')}
                    downloadingId={downloadingId}
                    deletingId={deletingId}
                  />
                )
              )}
            </div>
          )}
        </main>
      </div>

      {/* Global Drag Overlay */}
      {isWindowDragOver && (
        <div className="window-drag-overlay">
          <div className="window-drag-box">
            <Upload size={36} strokeWidth={1.5} />
            <h2 className="window-drag-title">Drop file anywhere to upload</h2>
            <p className="window-drag-desc">Uploads directly to your storage</p>
          </div>
        </div>
      )}


      {/* Create Folder Modal */}
      <CreateFolderModal
        isOpen={createFolderOpen}
        parentId={isSharedByMeView ? currentSharedByMeFolderId : currentFolderId}
        onClose={() => setCreateFolderOpen(false)}
        onSuccess={(newFolder) => {
          showNotification('Folder created!');
          // Optimistic: insert the new folder at the top of the current list
          if (newFolder?._id) {
            const folder = {
              ...newFolder,
              createdAt: newFolder.createdAt || new Date().toISOString(),
              owner: (newFolder.owner && typeof newFolder.owner === 'object' && (newFolder.owner.name || newFolder.owner.email))
                ? newFolder.owner
                : {
                    _id: currentUser?._id,
                    name: currentUser?.name,
                    email: currentUser?.email,
                    avatar: currentUser?.avatar || null,
                  },
            };
            if (isSharedByMeView && currentSharedByMeFolderId) {
              setSharedByMeFolderContents((prev) => ({ ...prev, folders: [folder, ...prev.folders] }));
            } else if (isSharedByMeView) {
              setSharedByMeFolders((prev) => [folder, ...prev]);
            } else {
              setFolderFolders((prev) => [folder, ...prev]);
            }
            setRootCounts((prev) => (currentFolderId === null ? { ...prev, folders: prev.folders + 1 } : prev));
          }
          // Background reconcile
          handleContentsRefresh();
        }}
      />

      {/* Rename Folder Modal */}
      <RenameFolderModal
        isOpen={Boolean(renameFolderTarget)}
        folder={renameFolderTarget}
        onClose={() => setRenameFolderTarget(null)}
        onSuccess={(updatedFolder) => {
          showNotification('Folder renamed!');
          const fid = renameFolderTarget?._id;
          const newName = updatedFolder?.name;
          if (fid && newName) {
            const patchFolders = (arr) =>
              arr.map((f) => (f._id === fid ? { ...f, name: newName } : f));
            setFolderFolders(patchFolders);
            setSharedByMeFolders(patchFolders);
            setSharedWithMeFolders(patchFolders);
            setSharedFolderContents((prev) => ({ ...prev, folders: patchFolders(prev.folders) }));
            setSharedByMeFolderContents((prev) => ({ ...prev, folders: patchFolders(prev.folders) }));
            // Also patch breadcrumb label if we renamed the currently-open folder
            setBreadcrumbs((prev) => prev.map((b) => (b.id === fid ? { ...b, name: newName } : b)));
            setSharedBreadcrumbs((prev) => prev.map((b) => (b.id === fid ? { ...b, name: newName } : b)));
            setSharedByMeBreadcrumbs((prev) => prev.map((b) => (b.id === fid ? { ...b, name: newName } : b)));
          }
          handleContentsRefresh();
        }}
      />

      {/* Delete Folder Modal */}
      <DeleteFolderModal
        isOpen={Boolean(deleteFolderTarget)}
        folder={deleteFolderTarget}
        onClose={() => setDeleteFolderTarget(null)}
        onSuccess={() => {
          showNotification('Folder deleted.');
          const fid = deleteFolderTarget?._id;
          // Optimistic: remove folder from all lists immediately
          if (fid) {
            const removeFolder = (arr) => arr.filter((f) => f._id !== fid);
            setFolderFolders(removeFolder);
            setSharedByMeFolders(removeFolder);
            setSharedWithMeFolders(removeFolder);
            setSharedFolderContents((prev) => ({ ...prev, folders: removeFolder(prev.folders) }));
            setSharedByMeFolderContents((prev) => ({ ...prev, folders: removeFolder(prev.folders) }));
            setRootCounts((prev) => ({ ...prev, folders: Math.max(0, prev.folders - 1) }));
          }
          // If we deleted a folder we were browsing INTO, go up one level
          if (fid === currentFolderId) {
            setBreadcrumbs((prev) => prev.slice(0, -1));
          }
          if (fid === currentSharedFolderId) {
            setSharedBreadcrumbs((prev) => prev.slice(0, -1));
          }
          if (fid === currentSharedByMeFolderId) {
            setSharedByMeBreadcrumbs((prev) => prev.slice(0, -1));
          }
          handleContentsRefresh();
        }}
      />

      {/* Move File / Folder Modal */}
      <MoveFileModal
        isOpen={Boolean(moveTarget)}
        item={moveTarget?.item}
        itemType={moveTarget?.itemType || 'file'}
        currentFolderId={currentSharedByMeFolderId || currentSharedFolderId || currentFolderId}
        sharedRootFolder={null}
        onClose={() => setMoveTarget(null)}
        onSuccess={() => {
          showNotification(
            `Moved ${moveTarget?.itemType === 'folder' ? 'folder' : 'file'} successfully!`
          );
          const mid = moveTarget?.item?._id;
          // Optimistic: remove moved item from the current view
          if (mid) {
            if (moveTarget?.itemType === 'folder') {
              setFolderFolders((prev) => prev.filter((f) => f._id !== mid));
              setSharedFolderContents((prev) => ({ ...prev, folders: prev.folders.filter((f) => f._id !== mid) }));
              setSharedByMeFolderContents((prev) => ({ ...prev, folders: prev.folders.filter((f) => f._id !== mid) }));
            } else {
              setFolderFiles((prev) => prev.filter((f) => f._id !== mid));
              setSharedFolderContents((prev) => ({ ...prev, files: prev.files.filter((f) => f._id !== mid) }));
              setSharedByMeFolderContents((prev) => ({ ...prev, files: prev.files.filter((f) => f._id !== mid) }));
            }
          }
          setMoveTarget(null);
          handleContentsRefresh();
        }}
      />

      {/* Rename File Modal */}
      <RenameFileModal
        isOpen={Boolean(renameFileTarget)}
        file={renameFileTarget}
        onClose={() => setRenameFileTarget(null)}
        onSuccess={(updatedFile) => {
          showNotification('File renamed successfully!');
          const fid = renameFileTarget?._id;
          const newName = updatedFile?.originalName || updatedFile?.name;
          if (fid && newName) {
            const patchFiles = (arr) =>
              arr.map((f) => (f._id === fid ? { ...f, originalName: newName } : f));
            setFolderFiles(patchFiles);
            setAllFiles(patchFiles);
            setSharedWithMeFiles(patchFiles);
            setSharedByMeFiles(patchFiles);
            setSharedFolderContents((prev) => ({ ...prev, files: patchFiles(prev.files) }));
            setSharedByMeFolderContents((prev) => ({ ...prev, files: patchFiles(prev.files) }));
          }
          handleContentsRefresh();
        }}
      />

      {/* File Preview & Inspector Modal */}
      <FilePreviewModal
        file={previewFile}
        isOpen={Boolean(previewFile)}
        onClose={() => setPreviewFile(null)}
        onDownload={handleDownload}
        onDelete={(f) => setDeleteConfirmFile(f)}
        onAccessRevoked={() => {
          setPreviewFile(null);
          handleSectionChange('shared-with-me');
          setSharedBreadcrumbs([{ id: null, name: 'Shared with me' }]);
          showNotification('You no longer have access to this item.', 'error');
          fetchSharedWithMe();
        }}
        isDownloading={downloadingId === previewFile?._id}
        isDeleting={deletingId === previewFile?._id}
      />

      {/* Delete File Confirmation Modal */}
      <DeleteConfirmModal
        file={deleteConfirmFile}
        isOpen={Boolean(deleteConfirmFile)}
        onClose={() => setDeleteConfirmFile(null)}
        onConfirm={handleDeleteConfirm}
        isDeleting={deletingId === deleteConfirmFile?._id}
      />

      {/* Share Modal */}
      <ShareModal
        isOpen={Boolean(shareModalTarget)}
        item={shareModalTarget?.item}
        itemType={shareModalTarget?.itemType || 'file'}
        onClose={() => setShareModalTarget(null)}
        onChanged={() => {
          fetchSharedByMe();
          fetchSharedWithMe();
          handleContentsRefresh();
        }}
      />

      {/* User Settings Modal */}
      <UserSettingsModal
        isOpen={settingsModalOpen}
        onClose={() => setSettingsModalOpen(false)}
      />
    </div>
  );
}
