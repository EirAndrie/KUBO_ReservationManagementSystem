import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { AutoComplete, Badge, Button, Input, Popover } from 'antd';
import type { InputRef } from 'antd';
import { BellOutlined, PlusOutlined, RightOutlined, SearchOutlined } from '@ant-design/icons';
import { useAuth } from '@/features/auth';
import { useChargeRequests } from '@/features/payment';
import { useCheckInOutQueue } from '@/features/check-in-out';
import { ReservationWizard } from '@/features/reservation';
import { ThemeToggle } from '@/theme';
import styles from './shell.module.css';

const SECTION_LABELS: Record<string, string> = {
  admin: 'Overview',
  staff: 'Today',
  reservations: 'Reservations',
  'check-in-out': 'Arrivals & departures',
  guests: 'Guests',
  payments: 'Payments',
  kubos: 'Kubos',
  'kubo-types': 'Kubo types & rates',
  employees: 'Employees',
  'audit-logs': 'Audit log',
};

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);

/** Notification list: pending approvals for Administrators, today's desk work for Staff. */
const Notifications: React.FC<{ isAdmin: boolean }> = ({ isAdmin }) => {
  const requests = useChargeRequests({ status: 'Pending' }, isAdmin);
  const queue = useCheckInOutQueue(undefined, { enabled: !isAdmin });

  const items: Array<{ to: string; text: string }> = [];
  if (isAdmin) {
    const n = requests.data?.length ?? 0;
    if (n > 0) items.push({ to: '/admin', text: `${n} charge request${n === 1 ? '' : 's'} waiting for approval` });
  } else {
    if (queue.arrivals.length > 0)
      items.push({ to: '/check-in-out', text: `${queue.arrivals.length} arrival${queue.arrivals.length === 1 ? '' : 's'} to check in` });
    if (queue.departures.length > 0)
      items.push({ to: '/check-in-out', text: `${queue.departures.length} departure${queue.departures.length === 1 ? '' : 's'} due` });
  }

  const content = (
    <div className={styles.notifList}>
      {items.length === 0 ? (
        <div className={styles.notifEmpty}>You're all caught up.</div>
      ) : (
        items.map((item) => (
          <Link key={item.text} to={item.to} className={styles.notifItem}>
            {item.text}
          </Link>
        ))
      )}
    </div>
  );

  return (
    <Popover content={content} title="Notifications" trigger="click" placement="bottomRight">
      <Button type="text" aria-label={`Notifications${items.length ? ` (${items.length})` : ''}`} icon={
        <Badge dot={items.length > 0} offset={[-2, 2]}>
          <BellOutlined style={{ fontSize: 16 }} />
        </Badge>
      } />
    </Popover>
  );
};

/**
 * Top bar: breadcrumbs, global search (⌘K / Ctrl+K), notifications, the
 * theme switcher, and "New reservation" for Staff only (reservation creation
 * is a Staff action in the backend).
 */
export const Navbar: React.FC<{ detailCrumb: string | null }> = ({ detailCrumb }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { role } = useAuth();
  const isAdmin = role === 'Administrator';
  const searchRef = useRef<InputRef>(null);
  const [query, setQuery] = useState('');
  const [wizardOpen, setWizardOpen] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const segments = location.pathname.split('/').filter(Boolean);
  const section = segments[0] ?? '';
  const sectionLabel = SECTION_LABELS[section] ?? '';
  const hasDetail = segments.length > 1;

  const searchTargets = useMemo(() => {
    const q = query.trim();
    if (!q) return [];
    const targets = [{ value: `/reservations?search=${encodeURIComponent(q)}`, label: `Reservations matching “${q}”` }];
    if (!isAdmin) targets.push({ value: `/guests?search=${encodeURIComponent(q)}`, label: `Guests matching “${q}”` });
    targets.push({ value: `/kubos?search=${encodeURIComponent(q)}`, label: `Kubos matching “${q}”` });
    return targets;
  }, [query, isAdmin]);

  const go = (to: string) => {
    navigate(to);
    setQuery('');
    searchRef.current?.blur();
  };

  return (
    <header className={styles.topbar}>
      <nav className={styles.crumbs} aria-label="Breadcrumb">
        {hasDetail ? (
          <>
            <Link to={`/${section}`}>{sectionLabel}</Link>
            <RightOutlined className={styles.crumbSep} aria-hidden="true" />
            <span className={styles.crumbCurrent} aria-current="page">
              {detailCrumb ?? '…'}
            </span>
          </>
        ) : (
          <span className={styles.crumbCurrent} aria-current="page">
            {sectionLabel}
          </span>
        )}
      </nav>

      <AutoComplete
        className={styles.search}
        options={searchTargets}
        value={query}
        onChange={setQuery}
        onSelect={(value: string) => go(value)}
        defaultActiveFirstOption
      >
        <Input
          ref={searchRef}
          prefix={<SearchOutlined className="muted" />}
          suffix={<kbd className={styles.kbd}>{isMac ? '⌘K' : 'Ctrl K'}</kbd>}
          placeholder="Search anything…"
          aria-label="Search reservations, guests and kubos"
          onPressEnter={() => searchTargets[0] && go(searchTargets[0].value)}
        />
      </AutoComplete>

      <div className={styles.topActions}>
        <Notifications isAdmin={isAdmin} />
        <ThemeToggle />
        {role === 'Staff' && (
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setWizardOpen(true)} style={{ marginLeft: 8 }}>
            New reservation
          </Button>
        )}
      </div>

      {role === 'Staff' && (
        <ReservationWizard
          open={wizardOpen}
          onCancel={() => setWizardOpen(false)}
          onSuccess={() => setWizardOpen(false)}
        />
      )}
    </header>
  );
};
