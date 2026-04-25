'use client';

// Cosmic Dropdown — replaces native <select> with an in-theme panel.
// One component handles both flat option lists and grouped lists. The trigger
// matches the rest of the cosmic-plant input fields; the open panel uses the
// same glass treatment as NotificationDropdown so all dropdown surfaces feel
// like one family.

import React, { useEffect, useRef, useState } from 'react';

const BG = '#0a0814';
const CREAM = '#f4eee4';
const CREAM_DIM = 'rgba(244,238,228,0.65)';
const CREAM_FAINT = 'rgba(244,238,228,0.4)';
const HAIR = 'rgba(244,238,228,0.08)';
const HAIR_STRONG = 'rgba(244,238,228,0.16)';
const AMBER = '#e89660';
const EARTH = '#d67347';

export interface DropdownOption {
  value: string;
  label: string;
  hint?: string;
}

export interface DropdownGroup {
  label: string;
  options: DropdownOption[];
}

export interface DropdownProps {
  value: string;
  onChange: (v: string) => void;
  options?: DropdownOption[];
  groups?: DropdownGroup[];
  placeholder: string;
  hasError?: boolean;
  /** Optional small-size variant for tight rails (filter bars, etc.) */
  compact?: boolean;
  className?: string;
}

export function Dropdown({
  value,
  onChange,
  options,
  groups,
  placeholder,
  hasError,
  compact,
  className,
}: DropdownProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const findSelected = (): DropdownOption | null => {
    if (options) {
      const o = options.find((x) => x.value === value);
      if (o) return o;
    }
    if (groups) {
      for (const g of groups) {
        const o = g.options.find((x) => x.value === value);
        if (o) return o;
      }
    }
    return null;
  };
  const selected = findSelected();

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const triggerBorder = hasError ? EARTH + '88' : open ? AMBER : HAIR_STRONG;

  return (
    <div ref={containerRef} className={`relative ${className || ''}`}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="w-full text-left flex items-center justify-between transition-colors"
        style={{
          background: 'transparent',
          color: selected ? CREAM : CREAM_FAINT,
          padding: compact ? '0.5rem 0.85rem' : '0.75rem 1rem',
          fontSize: compact ? '0.85rem' : '1rem',
          border: `1px solid ${triggerBorder}`,
          fontFamily: 'var(--font-fraunces, serif)',
          cursor: 'pointer',
        }}
      >
        <span className="truncate flex-1">
          {selected ? (
            <>
              {selected.label}
              {selected.hint && (
                <span
                  className="mono ml-2 text-[0.55rem] uppercase tracking-[0.22em]"
                  style={{ color: CREAM_FAINT }}
                >
                  · {selected.hint}
                </span>
              )}
            </>
          ) : (
            placeholder
          )}
        </span>
        <svg
          viewBox="0 0 20 20"
          fill="none"
          className="w-4 h-4 ml-2 flex-shrink-0 transition-transform"
          style={{
            transform: open ? 'rotate(180deg)' : 'rotate(0)',
            color: open ? AMBER : CREAM_FAINT,
          }}
        >
          <path
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M6 8l4 4 4-4"
          />
        </svg>
      </button>

      {open && (
        <div
          role="listbox"
          className="absolute left-0 right-0 mt-1 z-50 max-h-72 overflow-y-auto"
          style={{
            background: 'rgba(10,8,20,0.96)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            border: `1px solid ${HAIR_STRONG}`,
            boxShadow: '0 16px 40px rgba(0,0,0,0.55)',
            animation: 'dropdownIn 180ms ease-out',
          }}
        >
          {options &&
            options.map((o) => (
              <DropdownItem
                key={o.value}
                option={o}
                selected={o.value === value}
                onSelect={() => {
                  onChange(o.value);
                  setOpen(false);
                }}
              />
            ))}
          {groups &&
            groups.map((g, i) => (
              <div key={g.label}>
                <p
                  className="mono uppercase tracking-[0.24em] text-[0.55rem] px-4 pt-3 pb-1.5"
                  style={{
                    color: AMBER,
                    borderTop: i > 0 ? `1px solid ${HAIR}` : undefined,
                    marginTop: i > 0 ? '0.25rem' : 0,
                  }}
                >
                  {g.label}
                </p>
                {g.options.map((o) => (
                  <DropdownItem
                    key={o.value}
                    option={o}
                    selected={o.value === value}
                    onSelect={() => {
                      onChange(o.value);
                      setOpen(false);
                    }}
                  />
                ))}
              </div>
            ))}
        </div>
      )}

      <style>{`
        @keyframes dropdownIn {
          from { opacity: 0; transform: translateY(-4px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}

function DropdownItem({
  option,
  selected,
  onSelect,
}: {
  option: DropdownOption;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      role="option"
      aria-selected={selected}
      onClick={onSelect}
      className="w-full text-left transition-colors flex items-center justify-between"
      style={{
        background: selected ? 'rgba(232,150,96,0.08)' : 'transparent',
        borderLeft: `2px solid ${selected ? AMBER : 'transparent'}`,
        color: selected ? CREAM : CREAM_DIM,
        padding: '0.55rem 1rem 0.55rem 0.85rem',
        cursor: 'pointer',
      }}
      onMouseEnter={(e) => {
        if (!selected) e.currentTarget.style.background = 'rgba(244,238,228,0.04)';
      }}
      onMouseLeave={(e) => {
        if (!selected) e.currentTarget.style.background = 'transparent';
      }}
    >
      <span style={{ fontFamily: 'var(--font-fraunces, serif)', fontSize: '0.92rem' }}>
        {option.label}
        {option.hint && (
          <span
            className="mono ml-2 text-[0.52rem] uppercase tracking-[0.22em]"
            style={{ color: CREAM_FAINT }}
          >
            · {option.hint}
          </span>
        )}
      </span>
      {selected && (
        <span
          className="w-1.5 h-1.5 flex-shrink-0"
          style={{ background: AMBER, boxShadow: `0 0 6px ${AMBER}` }}
        />
      )}
    </button>
  );
}
