import React, { useState } from 'react';
import {
  Tabs,
  Table,
  Button,
  DatePicker,
  Tag,
  Alert,
  Empty,
  Badge,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import type { Dayjs } from 'dayjs';
import {
  LoginOutlined,
  LogoutOutlined,
  ReloadOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  CreditCardOutlined,
  InboxOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import { useCheckInOutQueue } from '../hooks/use-check-in-out.hook';
import { CheckInModal } from '../components/check-in-modal.component';
import { CheckOutModal } from '../components/check-out-modal.component';
import { RecordPaymentModal } from '../components/record-payment-modal.component';
import type { ArrivalRecord, DepartureRecord } from '../types/check-in-out.types';
import type { Reservation } from '@/features/reservation';
import styles from './check-in-out.module.css';

/**
 * Front-desk Operational Queue for Check-In and Check-Out.
 *
 * Implements:
 * - Tab 1: Today's Arrivals (only Confirmed bookings can check in, BR-058).
 * - Early check-in verification and explicit staff approval flow (BR-059).
 * - Tab 2: Today's Departures (BR-062, BR-063, BR-064).
 * - Strict zero-balance settlement validation before check-out is completed (BR-064).
 * - Inline integration with payment recording modal if balance remains.
 * - Multi-kubo per-assignment check-in/out support (BR-065).
 * - Frontloaded action verbs: "Check In Guest", "Complete Check-Out", "Record Final Payment".
 */
export const CheckInOutPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'arrivals' | 'departures'>('arrivals');
  const [selectedDate, setSelectedDate] = useState<Dayjs>(dayjs());

  const dateStr = selectedDate.format('YYYY-MM-DD');
  const { arrivals, departures, isLoading, isError, error, refetch } = useCheckInOutQueue(dateStr);

  // Modal states
  const [activeArrival, setActiveArrival] = useState<ArrivalRecord | null>(null);
  const [activeDeparture, setActiveDeparture] = useState<DepartureRecord | null>(null);
  const [paymentReservation, setPaymentReservation] = useState<Reservation | null>(null);

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP',
      minimumFractionDigits: 2,
    }).format(val);

  // Columns for Arrivals Queue
  const arrivalColumns: ColumnsType<ArrivalRecord> = [
    {
      title: 'Reference',
      key: 'ref',
      width: 140,
      render: (_, record) => (
        <span className={styles.refCode}>
          {record.reservation.reference_code}
        </span>
      ),
    },
    {
      title: 'Guest',
      key: 'guest',
      width: 190,
      render: (_, record) => (
        <div className={styles.guestCell}>
          <span className={styles.guestName}>{record.reservation.guest_name}</span>
          <span style={{ fontSize: '0.78rem', color: '#64748b' }}>
            Booked via {record.reservation.booking_source}
          </span>
        </div>
      ),
    },
    {
      title: 'Kubo Assignment',
      key: 'kubo',
      width: 180,
      render: (_, record) => (
        <div>
          <div style={{ fontWeight: 600, color: '#0c4a6e' }}>
            Kubo {record.assignment.kubo_number || record.assignment.kubo_id.slice(0, 4)}
          </div>
          <div style={{ fontSize: '0.78rem', color: '#64748b' }}>
            {record.assignment.type_name || 'Standard'} • Up to {record.assignment.capacity || 2} guests
          </div>
        </div>
      ),
    },
    {
      title: 'Scheduled Arrival',
      key: 'arrival_date',
      width: 150,
      render: (_, record) => (
        <div>
          <div style={{ fontWeight: 500 }}>
            {dayjs(record.assignment.check_in_date).format('MMM D, YYYY')}
          </div>
          {record.assignment.scheduled_check_in_time && (
            <div style={{ fontSize: '0.78rem', color: '#64748b' }}>
              Est: {record.assignment.scheduled_check_in_time}
            </div>
          )}
        </div>
      ),
    },
    {
      title: 'Arrival Timing',
      key: 'timing',
      width: 180,
      render: (_, record) => {
        if (!record.isEarly) {
          return (
            <Tag color="success" icon={<CheckCircleOutlined aria-hidden="true" />}>
              Scheduled Today
            </Tag>
          );
        }
        if (record.assignment.early_check_in_approved) {
          return (
            <Tag color="cyan" icon={<CheckCircleOutlined aria-hidden="true" />}>
              Early Approved
            </Tag>
          );
        }
        return (
          <Tag color="warning" icon={<WarningOutlined aria-hidden="true" />}>
            Early • Needs Approval
          </Tag>
        );
      },
    },
    {
      title: '',
      key: 'actions',
      width: 160,
      align: 'right',
      render: (_, record) => (
        <Button
          type="primary"
          icon={<LoginOutlined aria-hidden="true" />}
          onClick={() => setActiveArrival(record)}
          style={{
            background: record.isEarly && !record.assignment.early_check_in_approved ? '#d97706' : '#16a34a',
            borderColor: record.isEarly && !record.assignment.early_check_in_approved ? '#d97706' : '#16a34a',
            fontWeight: 600,
          }}
          aria-label={`Check in guest ${record.reservation.guest_name}`}
        >
          Check In Guest
        </Button>
      ),
    },
  ];

  // Columns for Departures Queue
  const departureColumns: ColumnsType<DepartureRecord> = [
    {
      title: 'Reference',
      key: 'ref',
      width: 140,
      render: (_, record) => (
        <span className={styles.refCode}>
          {record.reservation.reference_code}
        </span>
      ),
    },
    {
      title: 'Guest',
      key: 'guest',
      width: 190,
      render: (_, record) => (
        <div className={styles.guestCell}>
          <span className={styles.guestName}>{record.reservation.guest_name}</span>
        </div>
      ),
    },
    {
      title: 'Kubo Unit',
      key: 'kubo',
      width: 180,
      render: (_, record) => (
        <div>
          <div style={{ fontWeight: 600, color: '#0c4a6e' }}>
            Kubo {record.assignment.kubo_number || record.assignment.kubo_id.slice(0, 4)}
          </div>
          <div style={{ fontSize: '0.78rem', color: '#64748b' }}>
            {record.assignment.type_name || 'Standard'}
          </div>
        </div>
      ),
    },
    {
      title: 'Scheduled Departure',
      key: 'departure_date',
      width: 150,
      render: (_, record) => (
        <div style={{ fontWeight: 500 }}>
          {dayjs(record.assignment.check_out_date).format('MMM D, YYYY')}
        </div>
      ),
    },
    {
      title: 'Settlement Status',
      key: 'settlement',
      width: 190,
      render: (_, record) => {
        if (record.isSettled) {
          return (
            <Tag color="success" icon={<CheckCircleOutlined aria-hidden="true" />}>
              Fully Settled (₱0.00)
            </Tag>
          );
        }
        return (
          <Tag color="error" icon={<ExclamationCircleOutlined aria-hidden="true" />}>
            Unpaid: {formatCurrency(record.outstandingBalance)}
          </Tag>
        );
      },
    },
    {
      title: '',
      key: 'actions',
      width: 190,
      align: 'right',
      render: (_, record) => (
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          {!record.isSettled ? (
            <Button
              type="primary"
              icon={<CreditCardOutlined aria-hidden="true" />}
              onClick={() => setPaymentReservation(record.reservation)}
              style={{ background: '#0284c7', borderColor: '#0284c7', fontWeight: 600 }}
              aria-label={`Record payment for ${record.reservation.guest_name}`}
            >
              Record Final Payment
            </Button>
          ) : (
            <Button
              type="primary"
              icon={<LogoutOutlined aria-hidden="true" />}
              onClick={() => setActiveDeparture(record)}
              style={{ background: '#7c3aed', borderColor: '#7c3aed', fontWeight: 600 }}
              aria-label={`Check out ${record.reservation.guest_name}`}
            >
              Complete Check-Out
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <main className={styles.pageContainer} aria-label="Front-desk operations">
      {/* Hero Header */}
      <section className={styles.heroCard}>
        <div>
          <div className={styles.heroEyebrow}>
            <span>Front-Desk Operations</span>
          </div>
          <h1 className={styles.heroTitle}>Check-In & Check-Out Queue</h1>
          <p className={styles.heroSubtitle}>
            Process guest arrivals, early check-in overrides, key handovers, departure settlements, and housekeeping transitions.
          </p>
        </div>
      </section>

      {/* Date & Refresh Toolbar */}
      <section className={styles.dateToolbar} aria-label="Operational queue controls">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: '0.9rem', fontWeight: 600, color: '#334155' }}>
            Operational Date:
          </span>
          <DatePicker
            value={selectedDate}
            onChange={(d) => setSelectedDate(d || dayjs())}
            allowClear={false}
            style={{ width: 180, height: 38 }}
            format="MMMM D, YYYY"
          />
          <Button
            size="small"
            onClick={() => setSelectedDate(dayjs())}
          >
            Today
          </Button>
        </div>

        <Button
          icon={<ReloadOutlined aria-hidden="true" />}
          onClick={() => refetch()}
          loading={isLoading}
        >
          Refresh Queue
        </Button>
      </section>

      {/* Error Alert */}
      {isError && (
        <Alert
          style={{ marginBottom: 20, borderRadius: 8 }}
          type="error"
          showIcon
          message="Failed to load operational queue"
          description={
            error instanceof Error
              ? error.message
              : 'An unexpected error occurred while communicating with the server.'
          }
        />
      )}

      {/* Tabs */}
      <Tabs
        activeKey={activeTab}
        onChange={(k) => setActiveTab(k as 'arrivals' | 'departures')}
        type="card"
        size="large"
        items={[
          {
            key: 'arrivals',
            label: (
              <span style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '2px 8px' }}>
                <LoginOutlined aria-hidden="true" />
                <span>Arrivals to Process</span>
                <Badge count={arrivals.length} overflowCount={99} style={{ backgroundColor: '#16a34a' }} />
              </span>
            ),
            children: (
              <div className={styles.tableCard}>
                {!isLoading && arrivals.length === 0 ? (
                  <div className={styles.emptyStateCard} role="status">
                    <Empty
                      image={<InboxOutlined style={{ fontSize: 56, color: '#94a3b8' }} aria-hidden="true" />}
                      description={
                        <div>
                          <p style={{ fontSize: 16, fontWeight: 600, color: '#1f2937', margin: '0 0 6px 0' }}>
                            No Pending Arrivals
                          </p>
                          <p style={{ color: '#64748b', margin: 0 }}>
                            There are no confirmed guest arrivals scheduled for {selectedDate.format('MMM D, YYYY')}.
                          </p>
                        </div>
                      }
                    />
                  </div>
                ) : (
                  <Table<ArrivalRecord>
                    dataSource={arrivals}
                    columns={arrivalColumns}
                    rowKey={(r) => `${r.reservation.reservation_id}-${r.assignment.kubo_id}`}
                    loading={isLoading}
                    pagination={{ pageSize: 15 }}
                    scroll={{ x: 900 }}
                  />
                )}
              </div>
            ),
          },
          {
            key: 'departures',
            label: (
              <span style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '2px 8px' }}>
                <LogoutOutlined aria-hidden="true" />
                <span>Departures Due</span>
                <Badge count={departures.length} overflowCount={99} style={{ backgroundColor: '#7c3aed' }} />
              </span>
            ),
            children: (
              <div className={styles.tableCard}>
                {!isLoading && departures.length === 0 ? (
                  <div className={styles.emptyStateCard} role="status">
                    <Empty
                      image={<InboxOutlined style={{ fontSize: 56, color: '#94a3b8' }} aria-hidden="true" />}
                      description={
                        <div>
                          <p style={{ fontSize: 16, fontWeight: 600, color: '#1f2937', margin: '0 0 6px 0' }}>
                            No Pending Departures
                          </p>
                          <p style={{ color: '#64748b', margin: 0 }}>
                            There are no checked-in guests scheduled for departure on {selectedDate.format('MMM D, YYYY')}.
                          </p>
                        </div>
                      }
                    />
                  </div>
                ) : (
                  <Table<DepartureRecord>
                    dataSource={departures}
                    columns={departureColumns}
                    rowKey={(r) => `${r.reservation.reservation_id}-${r.assignment.kubo_id}`}
                    loading={isLoading}
                    pagination={{ pageSize: 15 }}
                    scroll={{ x: 900 }}
                  />
                )}
              </div>
            ),
          },
        ]}
      />

      {/* Check-In Modal */}
      <CheckInModal
        arrival={activeArrival}
        open={Boolean(activeArrival)}
        onCancel={() => setActiveArrival(null)}
        onSuccess={() => refetch()}
      />

      {/* Check-Out Modal */}
      <CheckOutModal
        departure={activeDeparture}
        open={Boolean(activeDeparture)}
        onCancel={() => setActiveDeparture(null)}
        onRequestPayment={() => {
          if (activeDeparture) {
            setPaymentReservation(activeDeparture.reservation);
          }
        }}
        onSuccess={() => refetch()}
      />

      {/* Record Final Payment Modal */}
      <RecordPaymentModal
        reservation={paymentReservation}
        open={Boolean(paymentReservation)}
        onCancel={() => setPaymentReservation(null)}
        onSuccess={() => refetch()}
      />
    </main>
  );
};
