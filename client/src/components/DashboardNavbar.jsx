import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Search, X, Lock, LogOut } from 'lucide-react';
import './DashboardNavbar.css';

/**
 * DashboardNavbar — 56px header with FileNest wordmark, centered search, and profile pill
 */
export default function DashboardNavbar({ searchQuery, onSearchChange, onOpenSettings }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  function handleLogout() {
    logout();
    navigate('/', { replace: true });
  }

  const displayName = user?.name || 'joash';
  const initial = displayName.charAt(0).toUpperCase();

  return (
    <header className="dash-navbar">
      <div className="dash-navbar-grid">
        <div className="dash-navbar-left">
          <span
            className="dash-navbar-brand"
            onClick={() => navigate('/dashboard')}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === 'Enter' && navigate('/dashboard')}
          >
            FileNest
          </span>
        </div>

        <div className="dash-navbar-center">
          <div className="dash-search-box">
            <Search size={18} strokeWidth={1.5} className="dash-search-icon" aria-hidden="true" />
            <input
              type="text"
              placeholder="Search files by name"
              className="dash-search-input"
              value={searchQuery || ''}
              onChange={(e) => onSearchChange(e.target.value)}
              aria-label="Search files by name"
            />
            {searchQuery && (
              <button
                className="dash-search-clear"
                onClick={() => onSearchChange('')}
                title="Clear search"
                aria-label="Clear search"
              >
                <X size={15} strokeWidth={1.5} />
              </button>
            )}
          </div>
        </div>

        <div className="dash-navbar-right" ref={dropdownRef}>
          <button
            className="dash-profile-pill"
            onClick={() => setDropdownOpen(!dropdownOpen)}
            aria-expanded={dropdownOpen}
            aria-label="User account menu"
          >
            <span className="dash-profile-avatar" aria-hidden="true">
              {initial}
            </span>
            <span className="dash-profile-name">{displayName}</span>
          </button>

          {dropdownOpen && (
            <div className="dash-user-dropdown" role="menu">
              <div className="dash-user-dropdown-header">
                <span className="dash-dropdown-name">{displayName}</span>
                {user?.email && <span className="dash-dropdown-email">{user.email}</span>}
              </div>

              <div className="dash-dropdown-divider" />

              <button
                className="dash-dropdown-item"
                role="menuitem"
                onClick={() => {
                  setDropdownOpen(false);
                  onOpenSettings();
                }}
              >
                <Lock size={16} strokeWidth={1.5} />
                <span>Change password</span>
              </button>

              <button
                className="dash-dropdown-item dash-dropdown-item--danger"
                role="menuitem"
                onClick={handleLogout}
              >
                <LogOut size={16} strokeWidth={1.5} />
                <span>Sign out</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
