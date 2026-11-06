import React from 'react';
import { initials } from '@/lib/format';
import styles from './common.module.css';

const TINTS = ['blue', 'green', 'amber', 'violet', 'red', 'gray'] as const;

function tintFor(name: string): (typeof TINTS)[number] {
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) hash = (hash * 31 + name.charCodeAt(i)) | 0;
  return TINTS[Math.abs(hash) % TINTS.length];
}

/** Initials avatar on a soft tint derived from the name, so it stays stable. */
export const Avatar: React.FC<{ name?: string | null; size?: number }> = ({ name, size = 28 }) => {
  const text = name || '?';
  return (
    <span
      className={`${styles.avatar} ${styles[tintFor(text)]}`}
      style={{ width: size, height: size, fontSize: Math.max(10, Math.round(size * 0.38)) }}
      aria-hidden="true"
    >
      {initials(text)}
    </span>
  );
};
