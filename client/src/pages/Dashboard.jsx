import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { getFiles, getDownloadUrl, deleteFile } from '../services/FileApi';
import { getFileCategory } from '../utils/fileUtils';
import DashboardNavbar from '../components/DashboardNavbar';
import Sidebar from '../components/Sidebar';
import FileCard from '../components/FileCard';
import FileList from '../components/FileList';
import EmptyState from '../components/EmptyState';
import UploadModal from '../components/UploadModal';
import FilePreviewModal from '../components/FilePreviewModal';
import DeleteConfirmModal from '../components/DeleteConfirmModal';
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
  all: 'All files',
  images: 'Images',
  documents: 'Documents',
  media: 'Media',
  other: 'Other',
};

export default function Dashboard() {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');
  const [activeSection, setActiveSection] = useState('files'); // 'files' | 'storage'
  const [sortBy, setSortBy] = useState('newest');
  const [viewMode, setViewMode] = useState('list'); // Default view is table (list)
  const [sortDropdownOpen, setSortDropdownOpen] = useState(false);
  const sortRef = useRef(null);

  // Modals
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [previewFile, setPreviewFile] = useState(null);
  const [deleteConfirmFile, setDeleteConfirmFile] = useState(null);
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);

  // Status & Actions
  const [downloadingId, setDownloadingId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [notification, setNotification] = useState(null);
  const [isWindowDragOver, setIsWindowDragOver] = useState(false);

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

  // Fetch real files from backend
  const fetchFiles = useCallback(async () => {
    setError('');
    try {
      const res = await getFiles();
      setFiles(res.data?.files || []);
    } catch (err) {
      setError(err.message || 'Failed to load files from storage.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFiles();
  }, [fetchFiles]);

  // Window drag & drop listeners
  useEffect(() => {
    let dragCounter = 0;

    function handleWindowDragEnter(e) {
      e.preventDefault();
      dragCounter++;
      if (e.dataTransfer.types && e.dataTransfer.types.includes('Files')) {
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
      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        setUploadModalOpen(true);
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
    setTimeout(() => {
      setNotification(null);
    }, 3500);
  }

  // Real download handler
  async function handleDownload(file) {
    if (!file?._id) return;
    setDownloadingId(file._id);
    try {
      const data = await getDownloadUrl(file._id);
      const url = data.data?.result;

      if (!url) {
        throw new Error('Storage service did not provide a download link.');
      }

      const response = await fetch(url);
      if (!response.ok) {
        throw new Error('Failed to download file from storage.');
      }
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

  // Delete file action
  async function handleDeleteConfirm(file) {
    if (!file?._id) return;
    setDeletingId(file._id);
    try {
      await deleteFile(file._id);
      showNotification(`Deleted ${file.originalName}`);
      setDeleteConfirmFile(null);
      if (previewFile?._id === file._id) {
        setPreviewFile(null);
      }
      await fetchFiles();
    } catch (err) {
      showNotification(err.message || 'Delete failed.', 'error');
    } finally {
      setDeletingId(null);
    }
  }

  // Filter & sort files
  const filteredFiles = useMemo(() => {
    let result = [...files];

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      result = result.filter((f) => (f.originalName || '').toLowerCase().includes(query));
    }

    // Filter by category
    if (activeCategory !== 'all') {
      result = result.filter((f) => getFileCategory(f) === activeCategory);
    }

    // Sort files
    result.sort((a, b) => {
      switch (sortBy) {
        case 'newest':
          return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
        case 'oldest':
          return new Date(a.createdAt || 0) - new Date(b.createdAt || 0);
        case 'name-asc':
          return (a.originalName || '').localeCompare(b.originalName || '');
        case 'name-desc':
          return (b.originalName || '').localeCompare(a.originalName || '');
        case 'size-desc':
          return (b.size || 0) - (a.size || 0);
        case 'size-asc':
          return (a.size || 0) - (b.size || 0);
        default:
          return 0;
      }
    });

    return result;
  }, [files, searchQuery, activeCategory, sortBy]);

  // Compute category counts
  const categoryCounts = useMemo(() => {
    const counts = { all: files.length, images: 0, documents: 0, media: 0, other: 0 };
    files.forEach((file) => {
      const cat = getFileCategory(file);
      if (counts[cat] !== undefined) {
        counts[cat]++;
      } else {
        counts.other++;
      }
    });
    return counts;
  }, [files]);

  const currentSortLabel = SORT_OPTIONS.find((opt) => opt.id === sortBy)?.label || 'Newest first';
  const pageTitle = CATEGORY_TITLES[activeCategory] || 'All files';
  const countLabel = `${filteredFiles.length} ${filteredFiles.length === 1 ? 'file' : 'files'}`;

  return (
    <div className="dash-layout">
      {/* Top Navbar 56px */}
      <DashboardNavbar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onOpenSettings={() => setSettingsModalOpen(true)}
      />

      {/* Main Container */}
      <div className="dash-body">
        {/* Left Sidebar 176px */}
        <Sidebar
          files={files}
          categoryCounts={categoryCounts}
          activeSection={activeSection}
          onSectionChange={setActiveSection}
          activeCategory={activeCategory}
          onCategoryChange={setActiveCategory}
          onUploadClick={() => setUploadModalOpen(true)}
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
                files={files}
                onPreview={(file) => setPreviewFile(file)}
                onDownload={handleDownload}
              />
            </div>
          ) : (
            <div className="dash-content-inner">
              {/* Header Toolbar */}
              <div className="dash-header">
                <div className="dash-title-group">
                  <h1 className="dash-title">{pageTitle}</h1>
                  <span className="dash-count">{countLabel}</span>
                </div>

                <div className="dash-header-actions">
                  {/* View mode toggle */}
                  <div className="dash-view-toggle">
                    <button
                      className={`dash-view-btn ${viewMode === 'list' ? 'dash-view-btn--active' : ''}`}
                      onClick={() => setViewMode('list')}
                      title="List view"
                      aria-label="List view"
                    >
                      <List size={17} strokeWidth={1.5} />
                    </button>
                    <button
                      className={`dash-view-btn ${viewMode === 'grid' ? 'dash-view-btn--active' : ''}`}
                      onClick={() => setViewMode('grid')}
                      title="Grid view"
                      aria-label="Grid view"
                    >
                      <LayoutGrid size={17} strokeWidth={1.5} />
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
                      <ChevronDown size={17} strokeWidth={1.5} className="dash-sort-chevron" />
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

                  {/* Refresh button */}
                  <button
                    className="dash-refresh-btn"
                    onClick={fetchFiles}
                    title="Refresh files"
                    aria-label="Refresh files"
                  >
                    <RefreshCw size={17} strokeWidth={1.5} />
                  </button>
                </div>
              </div>

              {/* Main Files Display */}
              {!loading && !error && filteredFiles.length === 0 ? (
                <EmptyState />
              ) : viewMode === 'grid' && !loading && !error ? (
                <div className="dash-grid">
                  {filteredFiles.map((file) => (
                    <FileCard
                      key={file._id}
                      file={file}
                      onDownload={handleDownload}
                      onDelete={(f) => setDeleteConfirmFile(f)}
                      onPreview={(f) => setPreviewFile(f)}
                      isDownloading={downloadingId === file._id}
                      isDeleting={deletingId === file._id}
                    />
                  ))}
                </div>
              ) : (
                <FileList
                  files={filteredFiles}
                  loading={loading}
                  error={error}
                  onRefresh={fetchFiles}
                  onDownload={handleDownload}
                  onDelete={(f) => setDeleteConfirmFile(f)}
                  onPreview={(f) => setPreviewFile(f)}
                  downloadingId={downloadingId}
                  deletingId={deletingId}
                />
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

      {/* Upload Modal */}
      <UploadModal
        isOpen={uploadModalOpen}
        onClose={() => setUploadModalOpen(false)}
        onSuccess={() => {
          fetchFiles();
          showNotification('File successfully uploaded!');
        }}
      />

      {/* File Preview & Inspector Modal */}
      <FilePreviewModal
        file={previewFile}
        isOpen={Boolean(previewFile)}
        onClose={() => setPreviewFile(null)}
        onDownload={handleDownload}
        onDelete={(f) => {
          setDeleteConfirmFile(f);
        }}
        isDownloading={downloadingId === previewFile?._id}
        isDeleting={deletingId === previewFile?._id}
      />

      {/* Delete Confirmation Modal */}
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
