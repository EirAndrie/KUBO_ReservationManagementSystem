import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  HomeOutlined,
  AppstoreOutlined,
  CalendarOutlined,
  UserOutlined,
  CreditCardOutlined,
  TeamOutlined,
  LoginOutlined,
  CrownOutlined,
  IdcardOutlined,
  AuditOutlined,
} from '@ant-design/icons';
import { useAuth } from '@/features/auth';
import styles from './shell.module.css';

interface NavItem {
  name: string;
  to: string;
  icon: React.ComponentType<{ className?: string }>;
}

export const Sidebar: React.FC = () => {
  const { role } = useAuth();
  const isAdmin = role === 'Administrator';

  // Role-specific navigation menus strictly enforcing flowchart separation of duties (BR-005)
  const navigation: NavItem[] = isAdmin
    ? [
        { name: 'Admin Dashboard', to: '/admin', icon: CrownOutlined },
        { name: 'Kubo Cottages', to: '/kubos', icon: HomeOutlined },
        { name: 'Kubo Types & Rates', to: '/kubo-types', icon: AppstoreOutlined },
        { name: 'Reservations (Audit)', to: '/reservations', icon: CalendarOutlined },
        { name: 'Staff Management', to: '/employees', icon: TeamOutlined },
        { name: 'System Audit Logs', to: '/audit-logs', icon: AuditOutlined },
      ]
    : [
        { name: 'Staff Dashboard', to: '/staff', icon: IdcardOutlined },
        { name: 'Check-In / Out Queue', to: '/check-in-out', icon: LoginOutlined },
        { name: 'Reservations', to: '/reservations', icon: CalendarOutlined },
        { name: 'Guests Directory', to: '/guests', icon: UserOutlined },
        { name: 'Billing & Charges', to: '/payments', icon: CreditCardOutlined },
        { name: 'Kubo Cottages', to: '/kubos', icon: HomeOutlined },
      ];

  return (
    <aside
      className={`${styles.sidebar} ${isAdmin ? styles.sidebarAdmin : styles.sidebarStaff}`}
      aria-label="Resort Management Navigation"
    >
      {/* Brand Header */}
      <div className={styles.brandHeader}>
        <img
          src="/images/kubo-logo.jpg"
          alt="KUBO Resort Logo"
          className={styles.brandLogoImage}
        />
        <div className={styles.brandTitleGroup}>
          <span className={styles.brandTitle}>KUBO RESORT</span>
          <span
            className={`${styles.brandSubtitle} ${
              isAdmin ? styles.brandSubtitleAdmin : styles.brandSubtitleStaff
            }`}
          >
            {isAdmin ? 'Administrator' : 'Front Desk Operations'}
          </span>
        </div>
      </div>

      {/* Navigation Links */}
      <nav className={styles.navSection}>
        <p
          className={`${styles.navSectionTitle} ${
            isAdmin ? styles.navSectionTitleAdmin : styles.navSectionTitleStaff
          }`}
        >
          {isAdmin ? 'System Governance' : 'Daily Operations'}
        </p>
        {navigation.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => {
                const baseClass = `${styles.navItem} ${
                  isAdmin ? styles.navItemAdmin : styles.navItemStaff
                }`;
                const activeClass = isAdmin
                  ? styles.navItemAdminActive
                  : styles.navItemStaffActive;
                return isActive ? `${baseClass} ${activeClass}` : baseClass;
              }}
            >
              <Icon className={styles.navItemIcon} />
              <span>{item.name}</span>
            </NavLink>
          );
        })}
      </nav>

      {/* Footer Role Indicator */}
      <div className={styles.sidebarFooter}>
        {isAdmin ? 'Administrator Mode' : 'Front Desk Staff Mode'}
      </div>
    </aside>
  );
};
