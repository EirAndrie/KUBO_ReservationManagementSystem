import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  AppstoreOutlined,
  CalendarOutlined,
  CreditCardOutlined,
  FileTextOutlined,
  HomeOutlined,
  LoginOutlined,
  LogoutOutlined,
  TeamOutlined,
  UserOutlined,
  BlockOutlined,
  TagsOutlined,
} from '@ant-design/icons';
import { useAuth } from '@/features/auth';
import { useCheckInOutQueue } from '@/features/check-in-out';
import { Avatar, RowMenu } from '@/components/common';
import { useThemeMode } from '@/theme';
import styles from './shell.module.css';

interface NavItem {
  name: string;
  to: string;
  icon: React.ReactNode;
  count?: number;
}

const NavItemLink: React.FC<{ item: NavItem }> = ({ item }) => (
  <NavLink
    to={item.to}
    className={({ isActive }) => `${styles.navItem} ${isActive ? styles.navItemActive : ''}`}
  >
    <span className={styles.navIcon} aria-hidden="true">
      {item.icon}
    </span>
    <span className={styles.navLabel}>{item.name}</span>
    {item.count !== undefined && item.count > 0 && (
      <span className={styles.navCount} aria-label={`${item.count} today`}>
        {item.count}
      </span>
    )}
  </NavLink>
);

/** Live count for the Staff "Arrivals & departures" item. */
function useFrontDeskCount(enabled: boolean): number | undefined {
  const { arrivals, departures, isSuccess } = useCheckInOutQueue(undefined, { enabled });
  if (!enabled || !isSuccess) return undefined;
  return arrivals.length + departures.length;
}

/**
 * Light 232px sidebar. Navigation is role-specific (BR-005): Administrators
 * see oversight pages plus an "Admin" group; Staff see front-desk pages.
 * The signed-in user and sign-out live at the bottom.
 */
export const Sidebar: React.FC = () => {
  const navigate = useNavigate();
  const { user, role, logout } = useAuth();
  const { mode } = useThemeMode();
  const isAdmin = role === 'Administrator';
  const deskCount = useFrontDeskCount(!isAdmin && Boolean(role));

  const main: NavItem[] = isAdmin
    ? [
        { name: 'Overview', to: '/admin', icon: <AppstoreOutlined /> },
        { name: 'Reservations', to: '/reservations', icon: <CalendarOutlined /> },
        { name: 'Kubos', to: '/kubos', icon: <HomeOutlined /> },
        { name: 'Kubo types & rates', to: '/kubo-types', icon: <BlockOutlined /> },
      ]
    : [
        { name: 'Today', to: '/staff', icon: <AppstoreOutlined /> },
        { name: 'Arrivals & departures', to: '/check-in-out', icon: <LoginOutlined />, count: deskCount },
        { name: 'Reservations', to: '/reservations', icon: <CalendarOutlined /> },
        { name: 'Guests', to: '/guests', icon: <UserOutlined /> },
        { name: 'Payments', to: '/payments', icon: <CreditCardOutlined /> },
        { name: 'Kubos', to: '/kubos', icon: <HomeOutlined /> },
      ];

  const adminGroup: NavItem[] = isAdmin
    ? [
        { name: 'Employees', to: '/employees', icon: <TeamOutlined /> },
        { name: 'Charge catalog', to: '/additional-charge-catalog', icon: <TagsOutlined /> },
        { name: 'Audit log', to: '/audit-logs', icon: <FileTextOutlined /> },
      ]
    : [];

  const handleSignOut = () => {
    logout();
    navigate('/login', { replace: true });
  };

  const displayName = user?.fullName || user?.username || (isAdmin ? 'Administrator' : 'Staff');

  return (
    <aside className={styles.sidebar} aria-label="Main navigation">
      <div className={styles.brand}>
        <img
          src={mode === 'dark' ? '/images/kubo-logo-white.png' : '/images/kubo-logo-black.png'}
          alt=""
          className={styles.brandLogo}
        />
        <div>
          <div className={styles.brandName}>Kubo Resort</div>
          <div className={styles.brandSub}>Reservation system</div>
        </div>
      </div>

      <nav className={styles.nav}>
        {main.map((item) => (
          <NavItemLink key={item.to} item={item} />
        ))}
        {adminGroup.length > 0 && (
          <>
            <div className={styles.navGroupLabel}>Admin</div>
            {adminGroup.map((item) => (
              <NavItemLink key={item.to} item={item} />
            ))}
          </>
        )}
      </nav>

      <div className={styles.userCard}>
        <Avatar name={displayName} size={30} />
        <div className={styles.userText}>
          <div className={styles.userName}>{displayName}</div>
          <div className={styles.userRole}>{isAdmin ? 'Administrator' : 'Front desk'}</div>
        </div>
        <RowMenu
          label="Account menu"
          items={[{ key: 'signout', label: 'Sign out', icon: <LogoutOutlined />, onClick: handleSignOut }]}
        />
      </div>
    </aside>
  );
};
