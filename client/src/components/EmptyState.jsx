import React from 'react';
import { File } from 'lucide-react';
import './EmptyState.css';

/**
 * EmptyState — Shared empty state when category or search has no files
 */
export default function EmptyState() {
  return (
    <div className="empty-state">
      <div className="empty-state-content">
        <File size={36} strokeWidth={1.5} className="empty-state-icon" />
        <p className="empty-state-title">No files found</p>
        <p className="empty-state-desc">Upload files or adjust your search filter.</p>
      </div>
    </div>
  );
}
