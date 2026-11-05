import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Tag, Popconfirm } from 'antd';
import {
  LogoutOutlined,
  CalendarOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { useAuth } from '@/features/auth';
import styles from './shell.module.css';

export const Navbar: React.FC = () => {
  const navigate = useNavigate();
  const { user, role, logout } = useAuth();
  const isAdmin = role === 'Administrator';

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  const todayStr = dayjs().format('dddd, MMMM D, YYYY');

  return (
    <header className={styles.navbar}>
      {/* Date & Time */}
      <div className={styles.navbarLeft}>
        <div className={styles.todayDate}>
          <CalendarOutlined style={{ color: '#94a3b8' }} />
          <span>{todayStr}</span>
        </div>
      </div>

      {/* User Session & Sign Out */}
      <div className={styles.navbarRight}>
        {/* User Profile Badge */}
        <div className={styles.userBadge}>
          <div className={styles.userInfo}>
            <span className={styles.userName}>
              {user?.fullName || (isAdmin ? 'Administrator' : 'Staff')}
            </span>
            <Tag
              color="blue"
              style={{
                margin: 0,
                fontSize: '0.65rem',
                padding: '0 4px',
                lineHeight: '16px',
                width: 'fit-content',
                fontWeight: 600,
              }}
            >
              {role || 'Staff'}
            </Tag>
          </div>
        </div>

        {/* Logout Popconfirm */}
        <Popconfirm
          title="Log Out"
          description="Are you sure you want to end your current session?"
          onConfirm={handleLogout}
          okText="Log out"
          cancelText="Cancel"
          placement="bottomRight"
        >
          <Button
            type="default"
            danger
            icon={<LogoutOutlined />}
            size="middle"
            style={{ fontWeight: 600 }}
          >
            Log out
          </Button>
        </Popconfirm>
      </div>
    </header>
  );
};
