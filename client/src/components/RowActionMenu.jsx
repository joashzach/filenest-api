import React, { useState, useRef, useEffect, useLayoutEffect, useCallback } from 'react';
import { MoreVertical } from 'lucide-react';
import './RowActionMenu.css';

/**
 * RowActionMenu — clean 3-dots row menu anchored to each row.
 * Closes on click outside or Escape.
 * Supports auto-placement: detects if space below is limited (e.g. last rows in list)
 * and flips upwards so the menu doesn't force container scroll expansion or get clipped.
 *
 * Props:
 *   items: Array<{ key: string, label: string, icon: Component, onClick: Function, danger?: boolean, disabled?: boolean }>
 *   disabled?: boolean
 *   direction?: 'auto' | 'up' | 'down'
 */
export default function RowActionMenu({
  items = [],
  disabled = false,
  direction = 'auto',
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [placement, setPlacement] = useState('down'); // 'down' | 'up'
  const containerRef = useRef(null);
  const triggerBtnRef = useRef(null);
  const dropdownRef = useRef(null);

  const validItems = items.filter((item) => item && !item.disabled);

  // Computes whether the dropdown should open 'up' or 'down'
  const calculatePlacement = useCallback(() => {
    if (direction === 'up') return 'up';
    if (direction === 'down') return 'down';
    if (!triggerBtnRef.current) return 'down';

    const triggerRect = triggerBtnRef.current.getBoundingClientRect();
    const dropdownHeight = dropdownRef.current
      ? dropdownRef.current.offsetHeight
      : validItems.length * 36 + 14;

    // Viewport boundaries
    const spaceBelowViewport = window.innerHeight - triggerRect.bottom;
    const spaceAboveViewport = triggerRect.top;

    // Check all scrollable/overflowing ancestors up to document body
    let minSpaceBelow = spaceBelowViewport;
    let minSpaceAbove = spaceAboveViewport;

    let parent = triggerBtnRef.current.parentElement;
    while (parent && parent !== document.body && parent !== document.documentElement) {
      const style = window.getComputedStyle(parent);
      const overflowY = style.overflowY;
      const overflow = style.overflow;
      if (
        overflowY === 'auto' ||
        overflowY === 'scroll' ||
        overflow === 'auto' ||
        overflow === 'scroll'
      ) {
        const parentRect = parent.getBoundingClientRect();
        const spaceBelowParent = parentRect.bottom - triggerRect.bottom;
        const spaceAboveParent = triggerRect.top - parentRect.top;
        if (spaceBelowParent < minSpaceBelow) minSpaceBelow = spaceBelowParent;
        if (spaceAboveParent < minSpaceAbove) minSpaceAbove = spaceAboveParent;
      }
      parent = parent.parentElement;
    }

    // Required height with a comfortable buffer
    const requiredHeight = dropdownHeight + 8;

    // If space below is not enough to show the full menu without creating extra scroll space
    // or clipping, and there is more room above (or enough room above), flip up!
    if (
      minSpaceBelow < requiredHeight &&
      (minSpaceAbove >= requiredHeight || minSpaceAbove > minSpaceBelow)
    ) {
      return 'up';
    }

    return 'down';
  }, [direction, validItems.length]);

  const handleToggle = (e) => {
    e.stopPropagation();
    if (!isOpen) {
      // Calculate placement immediately before opening to avoid flash
      const initialPlacement = calculatePlacement();
      setPlacement(initialPlacement);
      setIsOpen(true);
    } else {
      setIsOpen(false);
    }
  };

  // Synchronously verify placement after dropdown element mounts and has real dimensions
  useLayoutEffect(() => {
    if (!isOpen) return;
    const verifiedPlacement = calculatePlacement();
    if (verifiedPlacement !== placement) {
      setPlacement(verifiedPlacement);
    }
  }, [isOpen, calculatePlacement, placement]);

  // Handle outside clicks, escape key, and scroll/resize adjustments
  useEffect(() => {
    if (!isOpen) return;

    function handleClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    }

    function handleKeyDown(e) {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    }

    function handleScrollOrResize() {
      // If the row scrolls out of viewport, close menu
      if (triggerBtnRef.current) {
        const rect = triggerBtnRef.current.getBoundingClientRect();
        if (rect.bottom < 0 || rect.top > window.innerHeight) {
          setIsOpen(false);
          return;
        }
      }
      const nextPlacement = calculatePlacement();
      setPlacement((prev) => (prev !== nextPlacement ? nextPlacement : prev));
    }

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    window.addEventListener('resize', handleScrollOrResize);
    window.addEventListener('scroll', handleScrollOrResize, true);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('resize', handleScrollOrResize);
      window.removeEventListener('scroll', handleScrollOrResize, true);
    };
  }, [isOpen, calculatePlacement]);

  if (validItems.length === 0) return null;

  return (
    <div
      className={`row-action-menu-wrap ${isOpen ? 'row-action-menu-wrap--open' : ''} ${
        placement === 'up' ? 'row-action-menu-wrap--up' : 'row-action-menu-wrap--down'
      }`}
      ref={containerRef}
      onClick={(e) => e.stopPropagation()}
    >
      <button
        ref={triggerBtnRef}
        type="button"
        className={`row-action-trigger-btn ${isOpen ? 'row-action-trigger-btn--active' : ''}`}
        title="More actions"
        aria-label="More actions"
        aria-expanded={isOpen}
        aria-haspopup="menu"
        disabled={disabled}
        onClick={handleToggle}
      >
        <MoreVertical size={16} strokeWidth={1.5} />
      </button>

      {isOpen && (
        <div
          ref={dropdownRef}
          className={`row-action-dropdown ${
            placement === 'up' ? 'row-action-dropdown--up' : 'row-action-dropdown--down'
          }`}
          role="menu"
        >
          {validItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.key || item.label}
                type="button"
                className={`row-action-item ${item.danger ? 'row-action-item--danger' : ''}`}
                role="menuitem"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsOpen(false);
                  if (item.onClick) item.onClick();
                }}
              >
                {Icon && <Icon size={14} strokeWidth={1.5} className="row-action-item-icon" />}
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

