import React from 'react';
import styles from './common.module.css';

export interface SectionProps {
  title?: React.ReactNode;
  extra?: React.ReactNode;
  /** Removes body padding (for tables and lists that run edge to edge). */
  flush?: boolean;
  className?: string;
  style?: React.CSSProperties;
  children?: React.ReactNode;
}

/** Bordered card with an optional title row. */
export const Section: React.FC<SectionProps> = ({ title, extra, flush, className, style, children }) => (
  <section className={`${styles.card} ${className ?? ''}`} style={style}>
    {(title || extra) && (
      <header className={styles.cardHeader}>
        {typeof title === 'string' ? <h2 className={styles.cardTitle}>{title}</h2> : title}
        {extra && <div className={styles.pageActions}>{extra}</div>}
      </header>
    )}
    <div className={flush ? styles.cardFlush : styles.cardBody}>{children}</div>
  </section>
);

export interface KpiItem {
  label: React.ReactNode;
  value: React.ReactNode;
  hint?: React.ReactNode;
  icon?: React.ReactNode;
}

/** Horizontal strip of key numbers, separated by hairlines. */
export const KpiStrip: React.FC<{ items: KpiItem[]; loading?: boolean }> = ({ items, loading }) => (
  <div className={styles.kpiStrip}>
    {items.map((item, i) => (
      <div className={styles.kpi} key={i}>
        <div className={styles.kpiLabel}>
          {item.icon}
          {item.label}
        </div>
        <div className={styles.kpiValue}>{loading ? '—' : item.value}</div>
        {item.hint && <div className={styles.kpiHint}>{loading ? ' ' : item.hint}</div>}
      </div>
    ))}
  </div>
);

/** Small count pill used in tab labels. */
export const TabLabel: React.FC<{ text: string; count?: number; active?: boolean }> = ({
  text,
  count,
  active,
}) => (
  <span>
    {text}
    {count !== undefined && (
      <span className={`${styles.count} ${active ? styles.countActive : ''}`}>{count}</span>
    )}
  </span>
);

/** Primary line plus a muted second line. */
export const TwoLine: React.FC<{ primary: React.ReactNode; secondary?: React.ReactNode; mono?: boolean }> = ({
  primary,
  secondary,
  mono,
}) => (
  <span className={styles.twoLine}>
    <span className={mono ? 'mono' : undefined}>{primary}</span>
    {secondary && <span className={styles.twoLineSub}>{secondary}</span>}
  </span>
);

export const Callout: React.FC<{
  tone?: 'info' | 'warn' | 'danger';
  icon?: React.ReactNode;
  children: React.ReactNode;
  style?: React.CSSProperties;
}> = ({ tone = 'info', icon, children, style }) => {
  const cls = tone === 'warn' ? styles.calloutWarn : tone === 'danger' ? styles.calloutDanger : styles.calloutInfo;
  return (
    <div className={`${styles.callout} ${cls}`} role={tone === 'info' ? 'note' : 'alert'} style={style}>
      {icon}
      <div>{children}</div>
    </div>
  );
};

