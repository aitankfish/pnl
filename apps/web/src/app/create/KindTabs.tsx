'use client';

import React from 'react';

const BG = '#0a0814';
const CREAM = '#f4eee4';
const CREAM_DIM = 'rgba(244,238,228,0.65)';
const HAIR_STRONG = 'rgba(244,238,228,0.16)';
const AMBER = '#e89660';

export type CreateKind = 'project' | 'research';

export function KindTabs({
  kind,
  onChange,
}: {
  kind: CreateKind;
  onChange: (k: CreateKind) => void;
}) {
  const tabs: Array<{ value: CreateKind; label: string }> = [
    { value: 'project', label: 'Project' },
    { value: 'research', label: 'Research paper' },
  ];
  return (
    <div className="flex justify-center mb-6">
      <div
        className="inline-flex"
        style={{ border: `1px solid ${HAIR_STRONG}`, padding: 2 }}
      >
        {tabs.map((t) => {
          const active = t.value === kind;
          return (
            <button
              key={t.value}
              type="button"
              onClick={() => onChange(t.value)}
              className="mono uppercase tracking-[0.22em] text-[0.6rem] px-4 py-2 transition-colors"
              style={{
                background: active ? AMBER : 'transparent',
                color: active ? BG : CREAM_DIM,
              }}
              onMouseEnter={(e) => {
                if (!active) e.currentTarget.style.color = CREAM;
              }}
              onMouseLeave={(e) => {
                if (!active) e.currentTarget.style.color = CREAM_DIM;
              }}
            >
              {t.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
