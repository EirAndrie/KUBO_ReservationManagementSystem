import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Typography, Button, Alert } from 'antd';
import {
  AppstoreOutlined,
  HomeOutlined,
  TeamOutlined,
  FileSearchOutlined,
  AuditOutlined,
  ArrowRightOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import { useAuth } from '@/features/auth';
import { useKuboTypes } from '@/features/kubo-type';
import { useReservations } from '@/features/reservation';
import { useEmployees } from '@/features/employee';
import { useAuditLogs } from '@/features/audit-logs';
import styles from './admin-dashboard.module.css';

const { Title, Paragraph } = Typography;

export const AdminDashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const kuboTypesQuery = useKuboTypes();
  const reservationsQuery = useReservations();
  const employeesQuery = useEmployees({ status: 'Active' });
  const auditLogsQuery = useAuditLogs({ limit: 5 });
  const kuboTypes = kuboTypesQuery.data ?? [];
  const reservations = reservationsQuery.data ?? [];
  const employees = employeesQuery.data ?? [];
  const auditLogs = auditLogsQuery.data ?? [];
  const dataQueries = [kuboTypesQuery, reservationsQuery, employeesQuery, auditLogsQuery];
  const hasDataError = dataQueries.some((query) => query.isError);
  const retryDashboardData = () => {
    void Promise.all(dataQueries.map((query) => query.refetch()));
  };

  return (
    <main className={styles.pageContainer} aria-label="Administrator Oversight Dashboard">
      {/* Header Banner */}
      <section className={styles.headerSection}>
        <div className={styles.titleArea}>
          <div className={styles.headerEyebrow}>Administrator</div>
          <Title level={2} className={styles.pageTitle}>
            Administrator Oversight Portal
          </Title>
          <Paragraph className={styles.pageSubtitle}>
            Welcome back, <strong>{user?.fullName || 'Administrator'}</strong>. You are managing resort configurations, rates, personnel, and compliance auditing.
          </Paragraph>
        </div>
      </section>

      {hasDataError && (
        <Alert
          type="error"
          showIcon
          style={{ marginBottom: 20 }}
          message="Some overview information could not be loaded"
          description="Retry to refresh Kubo types, reservations, staff accounts, and recent audit entries."
          action={
            <Button size="small" icon={<ReloadOutlined aria-hidden="true" />} onClick={retryDashboardData}>
              Retry
            </Button>
          }
        />
      )}

      {/* Overview Stat Counters */}
      <section className={styles.statsGrid}>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>Kubo Types</span>
          <span className={styles.statValue}>
            {kuboTypesQuery.isLoading || kuboTypesQuery.isError ? '—' : kuboTypes.length}
          </span>
          <span className={styles.statHint}>Configured accommodation categories</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>Reservations Loaded</span>
          <span className={styles.statValue}>
            {reservationsQuery.isLoading || reservationsQuery.isError ? '—' : reservations.length}
          </span>
          <span className={styles.statHint}>Records returned by the current list query</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>Active Staff Accounts</span>
          <span className={styles.statValue}>
            {employeesQuery.isLoading || employeesQuery.isError ? '—' : employees.length}
          </span>
          <span className={styles.statHint}>Employee accounts currently marked active</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>Recent Audit Entries</span>
          <span className={styles.statValue}>
            {auditLogsQuery.isLoading || auditLogsQuery.isError ? '—' : auditLogs.length}
          </span>
          <span className={styles.statHint}>Most recent entries loaded</span>
        </div>
      </section>

      {/* Primary Administrative Portals */}
      <section className={styles.actionsGrid}>
        {/* Kubo Types & Nightly Rates */}
        <div className={styles.adminCard}>
          <div className={styles.cardHeader}>
            <div className={styles.cardIcon}>
              <AppstoreOutlined />
            </div>
            <div className={styles.cardBody}>
              <h3 className={styles.cardTitle}>Kubo Types & Nightly Rates</h3>
              <p className={styles.cardDesc}>
                Configure cottage categories, guest capacities, and nightly rates. Rate changes apply to new bookings.
              </p>
            </div>
          </div>
          <Button
            type="default"
            icon={<ArrowRightOutlined />}
            onClick={() => navigate('/kubo-types')}
          >
            Manage Rates & Categories
          </Button>
        </div>

        {/* Physical Kubo Inventory */}
        <div className={styles.adminCard}>
          <div className={styles.cardHeader}>
            <div className={styles.cardIcon}>
              <HomeOutlined />
            </div>
            <div className={styles.cardBody}>
              <h3 className={styles.cardTitle}>Kubo Units & Inventory</h3>
              <p className={styles.cardDesc}>
                Manage cottage units, availability, housekeeping, and maintenance status.
              </p>
            </div>
          </div>
          <Button
            type="default"
            icon={<ArrowRightOutlined />}
            onClick={() => navigate('/kubos')}
          >
            Manage Kubo Units
          </Button>
        </div>

        {/* Staff & Role Management */}
        <div className={styles.adminCard}>
          <div className={styles.cardHeader}>
            <div className={styles.cardIcon}>
              <TeamOutlined />
            </div>
            <div className={styles.cardBody}>
              <h3 className={styles.cardTitle}>Employee & Role Administration</h3>
              <p className={styles.cardDesc}>
                Manage staff accounts, role assignments, and account status.
              </p>
            </div>
          </div>
          <Button
            type="default"
            icon={<ArrowRightOutlined />}
            onClick={() => navigate('/employees')}
          >
            Manage Employees & Roles
          </Button>
        </div>

        {/* Read-Only Reservation Review */}
        <div className={styles.adminCard}>
          <div className={styles.cardHeader}>
            <div className={styles.cardIcon}>
              <FileSearchOutlined />
            </div>
            <div className={styles.cardBody}>
              <h3 className={styles.cardTitle}>Reservation Review</h3>
              <p className={styles.cardDesc}>
                Review guest reservations, assigned units, and payment history.
              </p>
            </div>
          </div>
          <Button
            type="default"
            icon={<ArrowRightOutlined />}
            onClick={() => navigate('/reservations')}
          >
            Review Reservations
          </Button>
        </div>

        {/* System Audit Logs */}
        <div className={styles.adminCard}>
          <div className={styles.cardHeader}>
            <div className={styles.cardIcon}>
              <AuditOutlined />
            </div>
            <div className={styles.cardBody}>
              <h3 className={styles.cardTitle}>System Audit Activity Log</h3>
              <p className={styles.cardDesc}>
                Review recorded changes and actions across the system.
              </p>
            </div>
          </div>
          <Button
            type="default"
            icon={<ArrowRightOutlined />}
            onClick={() => navigate('/audit-logs')}
          >
            View System Audit Logs
          </Button>
        </div>
      </section>
    </main>
  );
};
