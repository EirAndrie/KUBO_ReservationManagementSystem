import React, { useState, useMemo, useCallback } from 'react';
import {
  Table,
  Button,
  Input,
  Select,
  DatePicker,
  Alert,
  Modal,
  Tag,
  Empty,
  Typography,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import type { Dayjs } from 'dayjs';
import {
  SearchOutlined,
  PlusOutlined,
  EyeOutlined,
  FilterOutlined,
  ReloadOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  InboxOutlined,
  ExclamationCircleOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useReservations } from '../hooks/use-reservations.hook';
import {
  useConfirmReservation,
  useCancelReservation,
} from '../hooks/use-reservation-mutations.hook';
import { ReservationStatusTag } from '../components/reservation-status-tag.component';
import { ReservationWizard } from '../components/reservation-wizard.component';
import {
  STATUS_OPTIONS,
  BOOKING_SOURCE_OPTIONS,
  BOOKING_SOURCE_LABELS,
  RESERVATION_LIMITS,
} from '../constants/reservation.constants';
import type {
  Reservation,
  ReservationStatus,
  BookingSource,
} from '../types/reservation.types';
import styles from './reservation-list.module.css';

const { Text } = Typography;
const { RangePicker } = DatePicker;
const { TextArea } = Input;

/**
 * Primary Reservation Directory and Lifecycle Management Page.
 *
 * Implements:
 * - Filtering by Status, Booking Source, Date Range, and Search term.
 * - Real-time state updates with TanStack Query.
 * - Integration with multi-step ReservationWizard.
 * - Contextual actions (Confirm, Cancel with mandatory reason).
 * - WCAG 2.2 AA accessibility: status tags combine icons and semantic text.
 * - Zero Emoji Policy: Icons exclusively from @ant-design/icons.
 */
export const ReservationListPage: React.FC = () => {
  const navigate = useNavigate();

  // Filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<ReservationStatus | 'all'>('all');
  const [sourceFilter, setSourceFilter] = useState<BookingSource | 'all'>('all');
  const [dateRange, setDateRange] = useState<[Dayjs, Dayjs] | null>(null);
  const [debounceTimer, setDebounceTimer] = useState<ReturnType<typeof setTimeout> | null>(null);

  // Wizard modal state
  const [isWizardOpen, setIsWizardOpen] = useState(false);

  // Cancellation modal state
  const [cancellingReservation, setCancellingReservation] = useState<Reservation | null>(null);
  const [cancelReason, setCancelReason] = useState('');

  const queryParams = useMemo(() => {
    return {
      search: debouncedSearch || undefined,
      status: statusFilter !== 'all' ? statusFilter : undefined,
      bookingSource: sourceFilter !== 'all' ? sourceFilter : undefined,
      checkInDate: dateRange ? dateRange[0].format('YYYY-MM-DD') : undefined,
      checkOutDate: dateRange ? dateRange[1].format('YYYY-MM-DD') : undefined,
      limit: 100,
    };
  }, [debouncedSearch, statusFilter, sourceFilter, dateRange]);

  const { data: rawReservations, isLoading, isError, error, refetch } = useReservations(queryParams);
  const confirmMutation = useConfirmReservation();
  const cancelMutation = useCancelReservation();

  const reservations = useMemo(() => rawReservations ?? [], [rawReservations]);

  const handleSearchChange = useCallback(
    (value: string) => {
      setSearchTerm(value);
      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }
      const timer = setTimeout(() => {
        setDebouncedSearch(value.trim());
      }, 350);
      setDebounceTimer(timer);
    },
    [debounceTimer],
  );

  const formatCurrency = (val: string | number) =>
    new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP',
      minimumFractionDigits: 2,
    }).format(Number(val) || 0);

  // Quick Confirm handler
  const handleQuickConfirm = async (reservation: Reservation) => {
    await confirmMutation.mutateAsync(reservation.reservation_id);
  };

  // Cancellation submit handler
  const handleConfirmCancel = async () => {
    if (!cancellingReservation || !cancelReason.trim()) return;

    await cancelMutation.mutateAsync({
      id: cancellingReservation.reservation_id,
      data: { reason: cancelReason.trim() },
    });

    setCancellingReservation(null);
    setCancelReason('');
  };

  const columns: ColumnsType<Reservation> = [
    {
      title: 'Reference',
      dataIndex: 'reference_code',
      key: 'reference_code',
      width: 140,
      render: (code: string) => (
        <Text copyable={{ text: code }} className={styles.refCode}>
          {code}
        </Text>
      ),
    },
    {
      title: 'Guest',
      key: 'guest',
      width: 180,
      render: (_, record) => (
        <div className={styles.guestCell}>
          <span className={styles.guestName}>{record.guest_name}</span>
        </div>
      ),
    },
    {
      title: 'Stay Dates',
      key: 'dates',
      width: 190,
      render: (_, record) => {
        const firstAssignment = record.assignments?.[0];
        if (!firstAssignment) return <span style={{ color: '#94a3b8' }}>No dates</span>;

        const checkIn = dayjs(firstAssignment.check_in_date);
        const checkOut = dayjs(firstAssignment.check_out_date);
        const nights = Math.max(1, checkOut.diff(checkIn, 'day'));

        return (
          <div style={{ fontSize: '0.85rem' }}>
            <div>
              {checkIn.format('MMM D')} – {checkOut.format('MMM D, YYYY')}
            </div>
            <div style={{ color: '#0284c7', fontSize: '0.78rem', fontWeight: 600 }}>
              {nights} {nights === 1 ? 'night' : 'nights'}
            </div>
          </div>
        );
      },
    },
    {
      title: 'Kubos',
      key: 'kubos',
      width: 160,
      render: (_, record) => {
        if (!record.assignments || record.assignments.length === 0) {
          return <span style={{ color: '#94a3b8' }}>None</span>;
        }
        return (
          <div className={styles.kuboTags}>
            {record.assignments.map((a, i) => (
              <Tag key={i} color="cyan" style={{ margin: 0, fontSize: '0.78rem' }}>
                Kubo {a.kubo_number || a.kubo_id.slice(0, 4)}
              </Tag>
            ))}
          </div>
        );
      },
    },
    {
      title: 'Source',
      dataIndex: 'booking_source',
      key: 'booking_source',
      width: 120,
      render: (source: BookingSource) => (
        <span style={{ fontSize: '0.82rem', color: '#475569' }}>
          {BOOKING_SOURCE_LABELS[source] || source}
        </span>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 140,
      render: (status: ReservationStatus) => <ReservationStatusTag status={status} />,
    },
    {
      title: 'Financials',
      key: 'financials',
      width: 180,
      render: (_, record) => {
        const balance = Number(record.outstanding_balance) || 0;
        const isSettled = balance <= 0;

        return (
          <div style={{ fontSize: '0.82rem' }}>
            <div style={{ fontWeight: 600, color: '#0c4a6e' }}>
              {formatCurrency(record.accommodation_total)}
            </div>
            <div style={{ color: isSettled ? '#15803d' : '#b45309', fontSize: '0.76rem' }}>
              {isSettled ? 'Fully Settled' : `Bal: ${formatCurrency(balance)}`}
            </div>
          </div>
        );
      },
    },
    {
      title: '',
      key: 'actions',
      width: 200,
      fixed: 'right' as const,
      align: 'right' as const,
      render: (_, record) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'flex-end' }}>
          <Button
            size="small"
            icon={<EyeOutlined aria-hidden="true" />}
            onClick={() => navigate(`/reservations/${record.reservation_id}`)}
            aria-label={`View reservation ${record.reference_code}`}
          >
            View
          </Button>

          {record.status === 'Pending' && (
            <Button
              size="small"
              type="primary"
              icon={<CheckCircleOutlined aria-hidden="true" />}
              loading={confirmMutation.isPending}
              onClick={() => handleQuickConfirm(record)}
              aria-label={`Confirm reservation ${record.reference_code}`}
            >
              Confirm
            </Button>
          )}

          {['Pending', 'Confirmed'].includes(record.status) && (
            <Button
              size="small"
              danger
              icon={<CloseCircleOutlined aria-hidden="true" />}
              onClick={() => {
                setCancellingReservation(record);
                setCancelReason('');
              }}
              aria-label={`Cancel reservation ${record.reference_code}`}
            >
              Cancel
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <main className={styles.pageContainer} aria-label="Reservation Management">
      {/* Hero Header */}
      <section className={styles.heroCard}>
        <div>
          <div className={styles.heroEyebrow}>
            <span>Operational Bookings & Reservations</span>
          </div>
          <h1 className={styles.heroTitle}>Reservation Directory</h1>
          <p className={styles.heroSubtitle}>
            Manage resort bookings, assign available kubos, confirm reservations, and track guest check-in/out schedules.
          </p>
        </div>
        <Button
          type="primary"
          icon={<PlusOutlined aria-hidden="true" />}
          size="large"
          className={styles.newButton}
          onClick={() => setIsWizardOpen(true)}
          aria-label="Create new reservation"
        >
          New Reservation
        </Button>
      </section>

      {/* Error Banner */}
      {isError && (
        <Alert
          className={styles.errorBanner}
          type="error"
          showIcon
          message="Failed to load reservations"
          description={
            error instanceof Error
              ? error.message
              : 'An unexpected error occurred while communicating with the server.'
          }
          action={
            <Button
              size="small"
              danger
              icon={<ReloadOutlined aria-hidden="true" />}
              onClick={() => refetch()}
            >
              Retry
            </Button>
          }
        />
      )}

      {/* Filter Toolbar */}
      <section className={styles.toolbarContainer} aria-label="Reservation filters">
        <div className={styles.filterGroup}>
          <Input
            className={styles.searchInput}
            placeholder="Search code or guest name..."
            prefix={<SearchOutlined style={{ color: '#94a3b8' }} aria-hidden="true" />}
            value={searchTerm}
            onChange={(e) => handleSearchChange(e.target.value)}
            allowClear
            aria-label="Search reservations"
          />

          <Select
            className={styles.filterSelect}
            value={statusFilter}
            onChange={(val) => setStatusFilter(val)}
            suffixIcon={<FilterOutlined style={{ color: '#94a3b8' }} aria-hidden="true" />}
            options={[{ label: 'All Statuses', value: 'all' }, ...STATUS_OPTIONS]}
            aria-label="Filter by reservation status"
          />

          <Select
            className={styles.filterSelect}
            value={sourceFilter}
            onChange={(val) => setSourceFilter(val)}
            suffixIcon={<FilterOutlined style={{ color: '#94a3b8' }} aria-hidden="true" />}
            options={[{ label: 'All Sources', value: 'all' }, ...BOOKING_SOURCE_OPTIONS]}
            aria-label="Filter by booking source"
          />

          <RangePicker
            style={{ width: 240 }}
            value={dateRange}
            onChange={(dates) => setDateRange(dates as [Dayjs, Dayjs] | null)}
            placeholder={['Check-in', 'Check-out']}
            allowClear
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span className={styles.resultsBadge} aria-live="polite">
            {reservations.length} {reservations.length === 1 ? 'booking' : 'bookings'}
          </span>
          {(searchTerm || statusFilter !== 'all' || sourceFilter !== 'all' || dateRange) && (
            <Button
              size="small"
              onClick={() => {
                setSearchTerm('');
                setDebouncedSearch('');
                setStatusFilter('all');
                setSourceFilter('all');
                setDateRange(null);
              }}
            >
              Clear Filters
            </Button>
          )}
        </div>
      </section>

      {/* Data Table / Empty Viewport */}
      {!isLoading && reservations.length === 0 ? (
        <div className={styles.emptyStateCard} role="status">
          <Empty
            image={<InboxOutlined style={{ fontSize: 56, color: '#94a3b8' }} aria-hidden="true" />}
            description={
              <div>
                <p style={{ fontSize: 16, fontWeight: 600, color: '#1f2937', margin: '0 0 6px 0' }}>
                  {debouncedSearch || statusFilter !== 'all' || sourceFilter !== 'all' || dateRange
                    ? 'No Reservations Match Your Filters'
                    : 'No Active Reservations Recorded'}
                </p>
                <p style={{ color: '#64748b', margin: 0, maxWidth: 420 }}>
                  {debouncedSearch || statusFilter !== 'all' || sourceFilter !== 'all' || dateRange
                    ? 'Try widening your date range or clearing specific filter criteria.'
                    : 'Start booking resort stays by launching the multi-step reservation wizard.'}
                </p>
              </div>
            }
          >
            {debouncedSearch || statusFilter !== 'all' || sourceFilter !== 'all' || dateRange ? (
              <Button
                type="default"
                onClick={() => {
                  setSearchTerm('');
                  setDebouncedSearch('');
                  setStatusFilter('all');
                  setSourceFilter('all');
                  setDateRange(null);
                }}
              >
                Reset Filters
              </Button>
            ) : (
              <Button
                type="primary"
                icon={<PlusOutlined aria-hidden="true" />}
                size="large"
                style={{ marginTop: 16 }}
                onClick={() => setIsWizardOpen(true)}
              >
                Create First Reservation
              </Button>
            )}
          </Empty>
        </div>
      ) : (
        <div className={styles.tableCard}>
          <Table<Reservation>
            dataSource={reservations}
            columns={columns}
            rowKey="reservation_id"
            loading={isLoading}
            pagination={{
              pageSize: 20,
              showSizeChanger: true,
              showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} reservations`,
              pageSizeOptions: ['10', '20', '50'],
            }}
            scroll={{ x: 1320 }}
            size="middle"
            aria-label="Reservations data table"
          />
        </div>
      )}

      {/* Multi-step Booking Wizard */}
      <ReservationWizard
        open={isWizardOpen}
        onCancel={() => setIsWizardOpen(false)}
        onSuccess={() => refetch()}
      />

      {/* Cancellation Reason Modal with Strict Danger Token by Intent */}
      <Modal
        open={Boolean(cancellingReservation)}
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#dc2626' }}>
            <ExclamationCircleOutlined aria-hidden="true" />
            <span>Cancel Reservation {cancellingReservation?.reference_code}</span>
          </div>
        }
        onCancel={() => {
          setCancellingReservation(null);
          setCancelReason('');
        }}
        onOk={handleConfirmCancel}
        okText="Confirm Cancellation"
        okButtonProps={{
          danger: true,
          loading: cancelMutation.isPending,
          disabled: !cancelReason.trim(),
        }}
        cancelButtonProps={{
          disabled: cancelMutation.isPending,
        }}
        destroyOnClose
      >
        <p style={{ color: '#475569', fontSize: '0.9rem', marginTop: 12 }}>
          Cancelling this reservation will release all assigned kubos back to available inventory. This action cannot be undone (BR-035).
        </p>
        <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: 6 }}>
          Cancellation Reason <span style={{ color: '#ef4444' }}>*</span>
        </label>
        <TextArea
          rows={3}
          value={cancelReason}
          onChange={(e) => setCancelReason(e.target.value)}
          placeholder="State the reason for cancellation (e.g., Guest requested cancellation, emergency, travel change)..."
          maxLength={RESERVATION_LIMITS.MAX_CANCELLATION_REASON}
          showCount
          autoFocus
        />
      </Modal>
    </main>
  );
};
