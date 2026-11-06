import React from 'react';
import { Button, Skeleton } from 'antd';
import { ExclamationCircleOutlined, InboxOutlined, LockOutlined } from '@ant-design/icons';
import styles from './common.module.css';

/** Placeholder rows shown while a list loads (instead of a spinner over an empty table). */
export const ListSkeleton: React.FC<{ rows?: number }> = ({ rows = 6 }) => (
  <div className={styles.skeletonWrap} aria-busy="true" aria-label="Loading">
    <Skeleton active title={false} paragraph={{ rows, width: '100%' }} />
  </div>
);

export const EmptyState: React.FC<{
  title: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
  icon?: React.ReactNode;
}> = ({ title, description, action, icon }) => (
  <div className={styles.state}>
    <span className={styles.stateIcon}>{icon ?? <InboxOutlined />}</span>
    <div className={styles.stateTitle}>{title}</div>
    {description && <div>{description}</div>}
    {action && <div style={{ marginTop: 4 }}>{action}</div>}
  </div>
);

/**
 * Inline query error with Retry. A 403 shows the access message instead of the
 * raw server text; a 401 never reaches here because the API client redirects.
 */
export const ErrorState: React.FC<{ error: unknown; onRetry?: () => void }> = ({ error, onRetry }) => {
  const status = (error as { status?: number } | null)?.status;
  if (status === 403) {
    return (
      <div className={styles.state} role="alert">
        <span className={styles.stateIcon}>
          <LockOutlined />
        </span>
        <div className={styles.stateTitle}>You don't have access to this page.</div>
        <div>Ask an administrator if you need it.</div>
      </div>
    );
  }
  const message = (error as Error | null)?.message || 'Something went wrong while loading.';
  return (
    <div className={styles.state} role="alert">
      <span className={styles.errorIcon}>
        <ExclamationCircleOutlined />
      </span>
      <div className={styles.stateTitle}>Couldn't load this data</div>
      <div>{message}</div>
      {onRetry && (
        <Button size="small" onClick={onRetry} style={{ marginTop: 4 }}>
          Retry
        </Button>
      )}
    </div>
  );
};

/** Renders skeleton → error → empty → children for a query result. */
export function QueryBoundary<T>({
  query,
  isEmpty,
  empty,
  rows,
  children,
}: {
  query: { isLoading: boolean; isError: boolean; error: unknown; refetch: () => unknown; data?: T };
  isEmpty?: (data: T) => boolean;
  empty?: React.ReactNode;
  rows?: number;
  children: (data: T) => React.ReactNode;
}) {
  if (query.isLoading) return <ListSkeleton rows={rows} />;
  if (query.isError) return <ErrorState error={query.error} onRetry={() => query.refetch()} />;
  const data = query.data as T;
  if (isEmpty && empty && isEmpty(data)) return <>{empty}</>;
  return <>{children(data)}</>;
}
