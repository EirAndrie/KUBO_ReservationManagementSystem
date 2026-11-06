import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Navbar } from './Navbar';
import { BreadcrumbContext } from './breadcrumb-context';
import styles from './shell.module.css';

/** Fixed sidebar and top bar; only the main area scrolls. */
export const AppShell: React.FC = () => {
  const [detailCrumb, setDetailCrumb] = useState<string | null>(null);

  return (
    <BreadcrumbContext.Provider value={setDetailCrumb}>
      <div className={styles.shellContainer}>
        <Sidebar />
        <div className={styles.mainWrapper}>
          <Navbar detailCrumb={detailCrumb} />
          <div className={styles.mainScrollArea}>
            <main className={styles.mainContent}>
              <Outlet />
            </main>
          </div>
        </div>
      </div>
    </BreadcrumbContext.Provider>
  );
};
