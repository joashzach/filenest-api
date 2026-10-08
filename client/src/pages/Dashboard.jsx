import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { getFiles, getDownloadUrl, deleteFile, getUploadUrl, uploadToS3, confirmUpload, moveFile } from '../services/FileApi';
import { getRootContents, getFolderContents, moveFolder } from '../services/FolderApi';
import { getFileCategory, getFileExtension, formatSize, formatRelativeTime, formatDate, formatTime } from '../utils/fileUtils';
import DashboardNavbar from '../components/DashboardNavbar';
import Sidebar from '../components/Sidebar';
import FileCard from '../components/FileCard';
import FileList from '../components/FileList';
import FolderCard from '../components/FolderCard';
import FolderRow from '../components/FolderRow';
import FolderBreadcrumb from '../components/FolderBreadcrumb';
import EmptyState from '../components/EmptyState';
import FilePreviewModal from '../components/FilePreviewModal';
import DeleteConfirmModal from '../components/DeleteConfirmModal';
import DeleteFolderModal from '../components/DeleteFolderModal';
import CreateFolderModal from '../components/CreateFolderModal';
import RenameFolderModal from '../components/RenameFolderModal';
import RenameFileModal from '../components/RenameFileModal';
import UserSettingsModal from '../components/UserSettingsModal';
import StorageOverview from '../components/StorageOverview';
import {
  List,
  LayoutGrid,
  RefreshCw,
  ChevronDown,
  Check,
  AlertCircle,
  Upload,
  FolderPlus,
  File,
  Image,
  FileText,
  Video,
  Download,
  Trash2,
  Pencil,
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
function FolderViewFileRow({ file, isDownloading, isDeleting, onPreview, onDownload, onDelete, onRename }) {
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

  return (
    <div
      className="filelist-row"
      style={{ height: '48px', minHeight: '48px', maxHeight: '48px', flexShrink: 0, flexGrow: 0, boxSizing: 'border-box' }}
      role="row"
      draggable={true}
      onDragStart={(e) => {
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
      </div>
      <div className="filelist-col filelist-col-type">{ext}</div>
      <div className="filelist-col filelist-col-size">{formatSize(file.size)}</div>
      <div
        className="filelist-col filelist-col-date"
        title={file.createdAt ? `${formatDate(file.createdAt)} ${formatTime(file.createdAt)}` : ''}
      >
        {formatRelativeTime(file.createdAt || file._id)}
      </div>
      <div className="filelist-col filelist-col-actions" onClick={(e) => e.stopPropagation()}>
        {onRename && (
          <button
            className="filelist-action-btn"
            title="Rename file"
            aria-label="Rename file"
            onClick={() => onRename(file)}
            disabled={isDownloading || isDeleting}
          >
            <Pencil size={13} strokeWidth={1.5} />
          </button>
        )}
        <button
          className="filelist-action-btn"
          title="Download file"
          aria-label="Download file"
          onClick={() => onDownload && onDownload(file)}
          disabled={isDownloading || isDeleting}
        >
          <Download size={15} strokeWidth={1.5} />
        </button>
        <button
          className="filelist-action-btn filelist-action-btn--delete"
          title="Delete file"
          aria-label="Delete file"
          onClick={() => onDelete && onDelete(file)}
          disabled={isDeleting || isDownloading}
        >
          <Trash2 size={15} strokeWidth={1.5} />
        </button>
      </div>
    </div>
  );
}

export default function Dashboard() {
  // ── All files (used for category filters & counts) ──────────────────────────
  const [allFiles, setAllFiles] = useState([]);
  const [allFilesLoading, setAllFilesLoading] = useState(true);

  // ── Folder browsing ─────────────────────────────────────────────────────────
  // breadcrumbs: Array<{ id: string|null, name: string }>
  // The first entry is always My Files (id: null)
  const [breadcrumbs, setBreadcrumbs] = useState([{ id: null, name: 'My Files' }]);
  const currentFolderId = breadcrumbs[breadcrumbs.length - 1].id;

  // Contents of the currently-open folder (folders + files in that folder)
  const [folderFolders, setFolderFolders] = useState([]);
  const [folderFiles, setFolderFiles] = useState([]);
  const [folderLoading, setFolderLoading] = useState(true);
  const [folderError, setFolderError] = useState('');

  // ── Root directory counts (folders + files in root directory) ───────────────
  const [rootCounts, setRootCounts] = useState({ folders: 0, files: 0 });

  // ── UI state ─────────────────────────────────────────────────────────────────
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');
  const [activeSection, setActiveSection] = useState('files'); // 'files' | 'storage'
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

  // ── Status & Actions ─────────────────────────────────────────────────────────
  const [downloadingId, setDownloadingId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [notification, setNotification] = useState(null);
  const [isWindowDragOver, setIsWindowDragOver] = useState(false);

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
      setAllFilesLoading(false);
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
  const fetchCurrentContents = useCallback(async () => {
    setFolderError('');
    setFolderLoading(true);
    try {
      let res;
      if (currentFolderId === null) {
        res = await getRootContents();
        const f = res.data?.folders || [];
        const fi = res.data?.files || [];
        setFolderFolders(f);
        setFolderFiles(fi);
        setRootCounts({ folders: f.length, files: fi.length });
      } else {
        res = await getFolderContents(currentFolderId);
        setFolderFolders(res.data?.folders || []);
        setFolderFiles(res.data?.files || []);
      }
    } catch (err) {
      setFolderError(err.message || 'Failed to load folder contents.');
    } finally {
      setFolderLoading(false);
    }
  }, [currentFolderId]);

  useEffect(() => {
    if (activeSection === 'files' && activeCategory === 'all') {
      fetchCurrentContents();
    }
  }, [fetchCurrentContents, activeSection, activeCategory]);

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

  // ── Category sidebar changes: reset to root & switch category ────────────────
  function handleCategoryChange(categoryId) {
    setBreadcrumbs([{ id: null, name: 'My Files' }]);
    setActiveCategory(categoryId);
    setSearchQuery('');
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

  // ── Delete file handler ───────────────────────────────────────────────────────
  async function handleDeleteConfirm(file) {
    if (!file?._id) return;
    setDeletingId(file._id);
    try {
      await deleteFile(file._id);
      showNotification(`Deleted ${file.originalName}`);
      setDeleteConfirmFile(null);
      if (previewFile?._id === file._id) setPreviewFile(null);
      // Refresh both views
      await Promise.all([fetchCurrentContents(), fetchAllFiles(), fetchRootCounts()]);
    } catch (err) {
      showNotification(err.message || 'Delete failed.', 'error');
    } finally {
      setDeletingId(null);
    }
  }

  // ── After any folder/file mutation: refresh ───────────────────────────────────
  async function handleContentsRefresh() {
    await Promise.all([fetchCurrentContents(), fetchAllFiles(), fetchRootCounts()]);
  }

  // ── Drag & drop move handler for files & folders ────────────────────────────
  const handleDropItemOnFolder = useCallback(
    async (targetFolder, itemData) => {
      if (!itemData || !itemData.id) return;
      const targetFolderId = targetFolder?._id || null;
      const targetFolderName = targetFolder?.name || 'My Files';

      // Cannot move folder into itself
      if (itemData.itemType === 'folder' && itemData.id === targetFolderId) {
        return;
      }

      try {
        if (itemData.itemType === 'file') {
          await moveFile(itemData.id, targetFolderId);
          showNotification(`Moved "${itemData.name}" into "${targetFolderName}".`);
        } else if (itemData.itemType === 'folder') {
          await moveFolder(itemData.id, targetFolderId);
          showNotification(`Moved folder "${itemData.name}" into "${targetFolderName}".`);
        }
        await handleContentsRefresh();
      } catch (err) {
        showNotification(err.message || 'Failed to move item.', 'error');
      }
    },
    [fetchCurrentContents, fetchAllFiles, fetchRootCounts]
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
        const targetFolder = isMyFilesView ? currentFolderId : null;
        await confirmUpload({ originalName, mimeType, size, key, folder: targetFolder || null });

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

      await handleContentsRefresh();
      showNotification(
        successCount === 1
          ? `Uploaded ${files[0].name} successfully!`
          : `Uploaded ${successCount} files successfully!`
      );
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

  let pageTitle;
  if (isMyFilesView) {
    pageTitle = breadcrumbs[breadcrumbs.length - 1]?.name || 'My Files';
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
    if (folderLoading) {
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
        <div className="dash-grid">
          {/* Folders first */}
          {folderFilteredFolders.map((folder) => (
            <FolderCard
              key={folder._id}
              folder={folder}
              onOpen={handleOpenFolder}
              onRename={setRenameFolderTarget}
              onDelete={setDeleteFolderTarget}
              onDropItem={handleDropItemOnFolder}
            />
          ))}
          {/* Then files */}
          {folderFilteredFiles.map((file) => (
            <FileCard
              key={file._id}
              file={file}
              onDownload={handleDownload}
              onDelete={(f) => setDeleteConfirmFile(f)}
              onPreview={(f) => setPreviewFile(f)}
              onRename={(f) => setRenameFileTarget(f)}
              isDownloading={downloadingId === file._id}
              isDeleting={deletingId === file._id}
            />
          ))}
        </div>
      );
    }

    // List view
    return (
      <div className="filelist-container">
        {/* Table header — shared with FileList */}
        <div className="filelist-header">
          <span className="filelist-th filelist-th-name">Name</span>
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
        {/* Left Sidebar 176px (desktop) / Drawer (mobile) */}
        <Sidebar
          files={allFiles}
          categoryCounts={categoryCounts}
          rootCounts={rootCounts}
          activeSection={activeSection}
          onSectionChange={(sec) => {
            setActiveSection(sec);
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
                  {countLabel && <span className="dash-count-inline">{countLabel}</span>}
                </div>

                {/* Right: Controls (Sort, View toggle, Refresh) + CTAs (New folder, Upload file) */}
                <div className="dash-toolbar-right">
                  <div className="dash-toolbar-controls">
                    {/* Sort dropdown */}
                    <div className="dash-sort-container" ref={sortRef}>
                      <button
                        className="dash-sort-btn"
                        onClick={() => setSortDropdownOpen(!sortDropdownOpen)}
                        aria-expanded={sortDropdownOpen}
                        aria-label="Sort files"
                      >
                        <span>{currentSortLabel}</span>
                        <ChevronDown size={15} strokeWidth={1.5} className="dash-sort-chevron" />
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

                    {/* View mode toggle */}
                    <div className="dash-view-toggle">
                      <button
                        className={`dash-view-btn ${viewMode === 'list' ? 'dash-view-btn--active' : ''}`}
                        onClick={() => setViewMode('list')}
                        title="List view"
                        aria-label="List view"
                      >
                        <List size={16} strokeWidth={1.5} />
                      </button>
                      <button
                        className={`dash-view-btn ${viewMode === 'grid' ? 'dash-view-btn--active' : ''}`}
                        onClick={() => setViewMode('grid')}
                        title="Grid view"
                        aria-label="Grid view"
                      >
                        <LayoutGrid size={16} strokeWidth={1.5} />
                      </button>
                    </div>

                    {/* Refresh button */}
                    <button
                      className="dash-refresh-btn"
                      onClick={isMyFilesView ? handleContentsRefresh : fetchAllFiles}
                      title="Refresh"
                      aria-label="Refresh"
                    >
                      <RefreshCw size={15} strokeWidth={1.5} />
                    </button>
                  </div>

                  <div className="dash-toolbar-ctas">
                    {/* Create folder button — only in My Files */}
                    {isMyFilesView && (
                      <button
                        className="dash-new-folder-btn"
                        onClick={() => setCreateFolderOpen(true)}
                        title="New folder"
                        aria-label="New folder"
                      >
                        <FolderPlus size={15} strokeWidth={1.5} />
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

                    {/* Upload file button — triggers native file browser directly */}
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
                          <Upload size={15} strokeWidth={1.5} />
                          <span className="dash-upload-btn-text">Upload file</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>

              {/* ── My Files view (folder-aware) ── */}
              {isMyFilesView && renderMyFiles()}

              {/* ── Category filter views (global, not folder-scoped) ── */}
              {isCategoryView && (
                viewMode === 'grid' && !allFilesLoading ? (
                  categoryFilteredFiles.length === 0 ? (
                    <EmptyState />
                  ) : (
                    <div className="dash-grid">
                      {categoryFilteredFiles.map((file) => (
                        <FileCard
                          key={file._id}
                          file={file}
                          onDownload={handleDownload}
                          onDelete={(f) => setDeleteConfirmFile(f)}
                          onPreview={(f) => setPreviewFile(f)}
                          onRename={(f) => setRenameFileTarget(f)}
                          isDownloading={downloadingId === file._id}
                          isDeleting={deletingId === file._id}
                        />
                      ))}
                    </div>
                  )
                ) : (
                  <FileList
                    files={categoryFilteredFiles}
                    loading={allFilesLoading}
                    error=""
                    onRefresh={fetchAllFiles}
                    onDownload={handleDownload}
                    onDelete={(f) => setDeleteConfirmFile(f)}
                    onPreview={(f) => setPreviewFile(f)}
                    onRename={(f) => setRenameFileTarget(f)}
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
        parentId={currentFolderId}
        onClose={() => setCreateFolderOpen(false)}
        onSuccess={() => {
          handleContentsRefresh();
          showNotification('Folder created!');
        }}
      />

      {/* Rename Folder Modal */}
      <RenameFolderModal
        isOpen={Boolean(renameFolderTarget)}
        folder={renameFolderTarget}
        onClose={() => setRenameFolderTarget(null)}
        onSuccess={() => {
          handleContentsRefresh();
          showNotification('Folder renamed!');
        }}
      />

      {/* Delete Folder Modal */}
      <DeleteFolderModal
        isOpen={Boolean(deleteFolderTarget)}
        folder={deleteFolderTarget}
        onClose={() => setDeleteFolderTarget(null)}
        onSuccess={() => {
          // If we deleted a folder we were browsing INTO, go up one level
          if (deleteFolderTarget?._id === currentFolderId) {
            setBreadcrumbs((prev) => prev.slice(0, -1));
          }
          handleContentsRefresh();
          showNotification('Folder deleted.');
        }}
      />

      {/* Rename File Modal */}
      <RenameFileModal
        isOpen={Boolean(renameFileTarget)}
        file={renameFileTarget}
        onClose={() => setRenameFileTarget(null)}
        onSuccess={() => {
          handleContentsRefresh();
          showNotification(`File renamed successfully!`);
        }}
      />

      {/* File Preview & Inspector Modal */}
      <FilePreviewModal
        file={previewFile}
        isOpen={Boolean(previewFile)}
        onClose={() => setPreviewFile(null)}
        onDownload={handleDownload}
        onDelete={(f) => setDeleteConfirmFile(f)}
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

      {/* User Settings Modal */}
      <UserSettingsModal
        isOpen={settingsModalOpen}
        onClose={() => setSettingsModalOpen(false)}
      />
    </div>
  );
}
