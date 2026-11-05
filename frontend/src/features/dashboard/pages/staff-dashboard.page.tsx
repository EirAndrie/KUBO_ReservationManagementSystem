import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Typography, Button, Alert } from 'antd';
import {
  CalendarOutlined,
  LoginOutlined,
  DollarOutlined,
  UserAddOutlined,
  SearchOutlined,
  LogoutOutlined,
  HomeOutlined,
  PlusCircleOutlined,
  PrinterOutlined,
  ArrowRightOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import { useAuth } from '@/features/auth';
import { useReservations } from '@/features/reservation';
import { useCheckInOutQueue } from '@/features/check-in-out';
import { usePayments } from '@/features/payment';
import styles from './staff-dashboard.module.css';

const { Title, Paragraph } = Typography;

export const StaffDashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const reservationsQuery = useReservations();
  const queueQuery = useCheckInOutQueue();
  const paymentsQuery = usePayments();
  const reservations = reservationsQuery.data ?? [];
  const { arrivals, departures } = queueQuery;
  const payments = paymentsQuery.data ?? [];

  const arrivalsCount = arrivals.length;
  const departuresCount = departures.length;
  const activeBookingsCount = reservations.filter((r) => r.status === 'CheckedIn').length;
  const hasDataError = reservationsQuery.isError || queueQuery.isError || paymentsQuery.isError;
  const retryDashboardData = () => {
    void Promise.all([
      reservationsQuery.refetch(),
      queueQuery.refetch(),
      paymentsQuery.refetch(),
    ]);
  };

  return (
    <main className={styles.pageContainer} aria-label="Staff Front Desk Operations Dashboard">
      {/* Header Banner */}
      <section className={styles.headerSection}>
        <div className={styles.titleArea}>
          <div className={styles.headerEyebrow}>Front-Desk Operations</div>
          <Title level={2} className={styles.pageTitle}>
            Front Desk Operations Portal
          </Title>
          <Paragraph className={styles.pageSubtitle}>
            Welcome, <strong>{user?.fullName || 'Front Desk Staff'}</strong>. Streamline guest intake, monitor daily arrivals & departures, and process payments.
          </Paragraph>
        </div>
      </section>

      {hasDataError && (
        <Alert
          type="error"
          showIcon
          style={{ marginBottom: 20 }}
          message="Some dashboard information could not be loaded"
          description="Retry to refresh arrivals, reservations, and payment records."
          action={
            <Button size="small" icon={<ReloadOutlined aria-hidden="true" />} onClick={retryDashboardData}>
              Retry
            </Button>
          }
        />
      )}

      {/* Operational KPI Counters */}
      <section className={styles.statsGrid}>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>Arrival Queue</span>
          <span className={styles.statValue} style={{ color: '#0284c7' }}>
            {queueQuery.isLoading || queueQuery.isError ? '—' : arrivalsCount}
          </span>
          <span className={styles.statHint}>Arrivals to review</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>Departures Due</span>
          <span className={styles.statValue} style={{ color: '#d97706' }}>
            {queueQuery.isLoading || queueQuery.isError ? '—' : departuresCount}
          </span>
          <span className={styles.statHint}>Check-outs due today or overdue</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>Active In-House Stays</span>
          <span className={styles.statValue} style={{ color: '#16a34a' }}>
            {reservationsQuery.isLoading || reservationsQuery.isError ? '—' : activeBookingsCount}
          </span>
          <span className={styles.statHint}>Guests currently checked in</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>Payment Records Loaded</span>
          <span className={styles.statValue}>
            {paymentsQuery.isLoading || paymentsQuery.isError ? '—' : payments.length}
          </span>
          <span className={styles.statHint}>Financial transactions recorded</span>
        </div>
      </section>

      {/* Three Flowchart Operational Pillars */}
      <section className={styles.pillarsGrid}>
        {/* Pillar 1: Guest / Booking */}
        <div className={styles.pillarCard}>
          <div className={styles.pillarHeader}>
            <div className={`${styles.pillarIcon} ${styles.iconBooking}`}>
              <CalendarOutlined />
            </div>
            <div className={styles.pillarTitleGroup}>
              <h3 className={styles.pillarTitle}>Guest & Booking</h3>
              <span className={styles.pillarTagline}>Find guests, create bookings, and manage reservations</span>
            </div>
          </div>

          <div className={styles.pillarActionList}>
            <div
              className={styles.actionItem}
              onClick={() => navigate('/reservations')}
            >
              <div className={styles.actionInfo}>
                <span className={styles.actionName}>New Reservation Wizard</span>
                <span className={styles.actionDescription}>
                  Create a reservation by choosing a guest, dates, and available units.
                </span>
              </div>
              <ArrowRightOutlined style={{ color: '#0284c7' }} />
            </div>

            <div
              className={styles.actionItem}
              onClick={() => navigate('/guests')}
            >
              <div className={styles.actionInfo}>
                <span className={styles.actionName}>Guest Directory & Register</span>
                <span className={styles.actionDescription}>
                  Find an existing guest or register a new profile.
                </span>
              </div>
              <UserAddOutlined style={{ color: '#0284c7' }} />
            </div>

            <div
              className={styles.actionItem}
              onClick={() => navigate('/reservations')}
            >
              <div className={styles.actionInfo}>
                <span className={styles.actionName}>Manage & Modify Bookings</span>
                <span className={styles.actionDescription}>
                  Review reservation details and update its status when needed.
                </span>
              </div>
              <SearchOutlined style={{ color: '#0284c7' }} />
            </div>
          </div>

          <Button
            type="primary"
            block
            icon={<CalendarOutlined />}
            onClick={() => navigate('/reservations')}
            style={{ background: '#0284c7', borderColor: '#0284c7' }}
          >
            Open Reservations
          </Button>
        </div>

        {/* Pillar 2: Stay Operations */}
        <div className={styles.pillarCard}>
          <div className={styles.pillarHeader}>
            <div className={`${styles.pillarIcon} ${styles.iconStay}`}>
              <LoginOutlined />
            </div>
            <div className={styles.pillarTitleGroup}>
              <h3 className={styles.pillarTitle}>Arrivals, Departures & Housekeeping</h3>
              <span className={styles.pillarTagline}>Process guest check-ins, check-outs, and unit readiness</span>
            </div>
          </div>

          <div className={styles.pillarActionList}>
            <div
              className={styles.actionItem}
              onClick={() => navigate('/check-in-out')}
            >
              <div className={styles.actionInfo}>
                <span className={styles.actionName}>Process Arrivals</span>
                <span className={styles.actionDescription}>
                  Check in guests, including early arrivals that need approval.
                </span>
              </div>
              <LoginOutlined style={{ color: '#d97706' }} />
            </div>

            <div
              className={styles.actionItem}
              onClick={() => navigate('/check-in-out')}
            >
              <div className={styles.actionInfo}>
                <span className={styles.actionName}>Departures Due for Check-Out</span>
                <span className={styles.actionDescription}>
                  Complete check-out after the guest's balance has been settled.
                </span>
              </div>
              <LogoutOutlined style={{ color: '#d97706' }} />
            </div>

            <div
              className={styles.actionItem}
              onClick={() => navigate('/kubos')}
            >
              <div className={styles.actionInfo}>
                <span className={styles.actionName}>Kubo Housekeeping Readiness</span>
                <span className={styles.actionDescription}>
                  Update a cleaned unit so it can be booked again.
                </span>
              </div>
              <HomeOutlined style={{ color: '#d97706' }} />
            </div>
          </div>

          <Button
            type="primary"
            block
            icon={<LoginOutlined />}
            onClick={() => navigate('/check-in-out')}
            style={{ background: '#d97706', borderColor: '#d97706' }}
          >
            Open Check-In / Out Desk
          </Button>
        </div>

        {/* Pillar 3: Billing & Settlement */}
        <div className={styles.pillarCard}>
          <div className={styles.pillarHeader}>
            <div className={`${styles.pillarIcon} ${styles.iconBilling}`}>
              <span className={styles.pesoSymbol} aria-hidden="true">₱</span>
            </div>
            <div className={styles.pillarTitleGroup}>
              <h3 className={styles.pillarTitle}>Payments & Charges</h3>
              <span className={styles.pillarTagline}>Record guest payments, added charges, and invoices</span>
            </div>
          </div>

          <div className={styles.pillarActionList}>
            <div
              className={styles.actionItem}
              onClick={() => navigate('/payments')}
            >
              <div className={styles.actionInfo}>
                <span className={styles.actionName}>Record Guest Payment</span>
                <span className={styles.actionDescription}>
                  Record a guest deposit or balance payment.
                </span>
              </div>
              <span className={styles.pesoSymbol} style={{ color: '#16a34a' }} aria-hidden="true">
                ₱
              </span>
            </div>

            <div
              className={styles.actionItem}
              onClick={() => navigate('/payments')}
            >
              <div className={styles.actionInfo}>
                <span className={styles.actionName}>Post Extra Charges (Incidentals)</span>
                <span className={styles.actionDescription}>
                  Add charges for extra beds, food, or damages.
                </span>
              </div>
              <PlusCircleOutlined style={{ color: '#16a34a' }} />
            </div>

            <div
              className={styles.actionItem}
              onClick={() => navigate('/payments')}
            >
              <div className={styles.actionInfo}>
                <span className={styles.actionName}>Print Invoice & Audit Statement</span>
                <span className={styles.actionDescription}>
                  Generate printable itemized guest statements
                </span>
              </div>
              <PrinterOutlined style={{ color: '#16a34a' }} />
            </div>
          </div>

          <Button
            type="primary"
            block
            icon={<DollarOutlined />}
            onClick={() => navigate('/payments')}
            style={{ background: '#16a34a', borderColor: '#16a34a' }}
          >
            Open Billing Ledger
          </Button>
        </div>
      </section>
    </main>
  );
};
