import React from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Navbar } from './Navbar';
import styles from './shell.module.css';

export const AppShell: React.FC = () => {
  return (
    <div className={styles.shellContainer}>
      <Sidebar />
      <div className={styles.mainWrapper}>
        <Navbar />
        <div className={styles.mainScrollArea}>
          <main className={styles.mainContent}>
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
};
