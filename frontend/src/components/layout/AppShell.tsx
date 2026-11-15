import React, { useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Navbar } from './Navbar';
import { BreadcrumbContext } from './breadcrumb-context';
import styles from './shell.module.css';

/**
 * Fixed sidebar and top bar; only the main area scrolls. Below 900px the sidebar
 * becomes an off-canvas drawer opened from the top bar's menu button.
 */
export const AppShell: React.FC = () => {
  const [detailCrumb, setDetailCrumb] = useState<string | null>(null);
  const { pathname } = useLocation();
  // The drawer is open only for the route it was opened on, so navigating closes it.
  const [openPath, setOpenPath] = useState<string | null>(null);
  const navOpen = openPath === pathname;
  const setNavOpen = (open: boolean) => setOpenPath(open ? pathname : null);

  useEffect(() => {
    if (!navOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpenPath(null);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [navOpen]);

  return (
    <BreadcrumbContext.Provider value={setDetailCrumb}>
      <div className={styles.shellContainer}>
        <Sidebar open={navOpen} />
        {navOpen && <div className={styles.backdrop} onClick={() => setNavOpen(false)} aria-hidden="true" />}
        <div className={styles.mainWrapper}>
          <Navbar detailCrumb={detailCrumb} navOpen={navOpen} onToggleNav={() => setNavOpen(!navOpen)} />
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
