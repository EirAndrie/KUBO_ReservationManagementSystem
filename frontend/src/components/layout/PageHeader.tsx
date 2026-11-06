import React from 'react';
import styles from '../common/common.module.css';

export interface PageHeaderProps {
  title: React.ReactNode;
  /** One muted line under the title. */
  description?: React.ReactNode;
  /** Right-aligned actions: at most one primary button. */
  action?: React.ReactNode;
  /** Rendered before the title (e.g. an avatar). */
  leading?: React.ReactNode;
  /** Rendered next to the title (e.g. a status badge). */
  titleExtra?: React.ReactNode;
}

/** The single page header pattern: H1 22px/600, muted subtitle, actions on the right. */
export const PageHeader: React.FC<PageHeaderProps> = ({ title, description, action, leading, titleExtra }) => (
  <div className={styles.pageHeader}>
    <div className={styles.pageHeaderMain}>
      {leading}
      <div style={{ minWidth: 0 }}>
        <div className={styles.pageTitleRow}>
          <h1 className={styles.pageTitle}>{title}</h1>
          {titleExtra}
        </div>
        {description && <p className={styles.pageSubtitle}>{description}</p>}
      </div>
    </div>
    {action && <div className={styles.pageActions}>{action}</div>}
  </div>
);
