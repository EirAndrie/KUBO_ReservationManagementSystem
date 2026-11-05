import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Card,
  Button,
  Table,
  Tag,
  Alert,
  Modal,
  Input,
  Skeleton,
  Typography,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import {
  ArrowLeftOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  LoginOutlined,
  LogoutOutlined,
  StopOutlined,
  UserOutlined,
  HomeOutlined,
  DollarOutlined,
  CreditCardOutlined,
  FileTextOutlined,
  ExclamationCircleOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import {
  useReservation,
  useReservationPayments,
  useReservationCharges,
} from '../hooks/use-reservations.hook';
import {
  useConfirmReservation,
  useCancelReservation,
  useMarkNoShow,
} from '../hooks/use-reservation-mutations.hook';
import { ReservationStatusTag } from '../components/reservation-status-tag.component';
import {
  BOOKING_SOURCE_LABELS,
  RESERVATION_LIMITS,
  RESERVATION_POLICIES,
} from '../constants/reservation.constants';
import type {
  ReservationAssignment,
  PaymentItem,
  AdditionalChargeItem,
} from '../types/reservation.types';
import styles from './reservation-detail.module.css';

const { Title } = Typography;
const { TextArea } = Input;

/**
 * Reservation Detail & Lifecycle Management Page.
 *
 * Implements:
 * - Reference code heading, status tag, and contextual actions.
 * - Cancellation modal with strict Token by Intent danger styling (BR-035).
 * - Dynamic financial summary derivation: Accommodation + Charges - Net Paid (BR-040, BR-047).
 * - Rate snapshot display: price_at_booking captured at reservation creation (BR-020).
 * - Multi-section grid layout: Guest info, Assigned Kubos, Financials, Payments, Charges.
 */
export const ReservationDetailPage: React.FC = () => {
  const { reservationId } = useParams<{ reservationId: string }>();
  const navigate = useNavigate();

  const {
    data: reservation,
    isLoading,
    isError,
    error,
    refetch,
  } = useReservation(reservationId);

  const { data: payments = [] } = useReservationPayments(reservationId);
  const { data: charges = [] } = useReservationCharges(reservationId);

  const confirmMutation = useConfirmReservation();
  const cancelMutation = useCancelReservation();
  const noShowMutation = useMarkNoShow();

  // Cancellation modal state
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');

  const formatCurrency = (val: string | number) =>
    new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP',
      minimumFractionDigits: 2,
    }).format(Number(val) || 0);

  if (isLoading) {
    return (
      <main className={styles.pageContainer}>
        <Skeleton active paragraph={{ rows: 14 }} />
      </main>
    );
  }

  if (isError || !reservation) {
    return (
      <main className={styles.pageContainer}>
        <Alert
          className={styles.errorBanner}
          type="error"
          showIcon
          message="Failed to load reservation"
          description={
            error instanceof Error
              ? error.message
              : 'The requested reservation could not be found or the server is unavailable.'
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
        <Button
          icon={<ArrowLeftOutlined aria-hidden="true" />}
          onClick={() => navigate('/reservations')}
        >
          Back to Reservations
        </Button>
      </main>
    );
  }

  // Dynamic Financial Calculations (BR-040, BR-047)
  const accommodationTotal = Number(reservation.accommodation_total) || 0;
  const chargesTotal = charges.reduce((sum: number, c: AdditionalChargeItem) => sum + Number(c.amount || 0), 0)
    || Number(reservation.charges_total) || 0;
  const netPaid = payments.reduce((sum: number, p: PaymentItem) => {
    const amt = Number(p.amount || 0);
    return p.transaction_type === 'Refund' ? sum - amt : sum + amt;
  }, 0) || Number(reservation.net_paid) || 0;

  const totalBilled = accommodationTotal + chargesTotal;
  const outstandingBalance = totalBilled - netPaid;
  const isSettled = outstandingBalance <= 0;

  // Actions
  const handleConfirm = async () => {
    if (!reservationId) return;
    await confirmMutation.mutateAsync(reservationId);
  };

  const handleMarkNoShow = async () => {
    if (!reservationId) return;
    await noShowMutation.mutateAsync(reservationId);
  };

  const handleCancelSubmit = async () => {
    if (!reservationId || !cancelReason.trim()) return;
    await cancelMutation.mutateAsync({
      id: reservationId,
      data: { reason: cancelReason.trim() },
    });
    setIsCancelModalOpen(false);
    setCancelReason('');
  };

  // Kubo Assignment Columns
  const assignmentColumns: ColumnsType<ReservationAssignment> = [
    {
      title: 'Kubo Unit',
      key: 'kubo',
      render: (_, record) => (
        <div>
          <div style={{ fontWeight: 600, color: '#0c4a6e' }}>
            Kubo {record.kubo_number || record.kubo_id.slice(0, 4)}
          </div>
          <div style={{ fontSize: '0.78rem', color: '#64748b' }}>
            {record.type_name || 'Standard Cottage'}
          </div>
        </div>
      ),
    },
    {
      title: 'Stay Dates',
      key: 'dates',
      render: (_, record) => {
        const checkIn = dayjs(record.check_in_date);
        const checkOut = dayjs(record.check_out_date);
        const nights = Math.max(1, checkOut.diff(checkIn, 'day'));
        return (
          <div style={{ fontSize: '0.82rem' }}>
            <div>{checkIn.format('MMM D')} – {checkOut.format('MMM D, YYYY')}</div>
            <div style={{ color: '#0284c7', fontWeight: 600 }}>{nights} nights</div>
          </div>
        );
      },
    },
    {
      title: 'Rate Snapshot (BR-020)',
      dataIndex: 'price_at_booking',
      key: 'price_at_booking',
      align: 'right',
      render: (rate: number | string) => (
        <span style={{ fontFamily: 'monospace', fontWeight: 500 }}>
          {formatCurrency(rate)} / night
        </span>
      ),
    },
    {
      title: 'Subtotal',
      key: 'subtotal',
      align: 'right',
      render: (_, record) => {
        const checkIn = dayjs(record.check_in_date);
        const checkOut = dayjs(record.check_out_date);
        const nights = Math.max(1, checkOut.diff(checkIn, 'day'));
        const subtotal = Number(record.price_at_booking) * nights;
        return (
          <span style={{ fontWeight: 700, color: '#0c4a6e' }}>
            {formatCurrency(subtotal)}
          </span>
        );
      },
    },
  ];

  return (
    <main className={styles.pageContainer} aria-label={`Reservation ${reservation.reference_code}`}>
      {/* Navigation */}
      <button
        className={styles.backLink}
        onClick={() => navigate('/reservations')}
        aria-label="Back to reservations directory"
      >
        <ArrowLeftOutlined aria-hidden="true" />
        <span>Reservation Directory</span>
      </button>

      {/* Header Banner */}
      <section className={styles.headerCard}>
        <div className={styles.headerMain}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Title level={1} className={styles.refCode}>
              {reservation.reference_code}
            </Title>
            <ReservationStatusTag status={reservation.status} />
          </div>
          <div className={styles.headerMeta}>
            <span>Guest: <strong>{reservation.guest_name}</strong></span>
            <span>•</span>
            <span>Source: <strong>{BOOKING_SOURCE_LABELS[reservation.booking_source] || reservation.booking_source}</strong></span>
            <span>•</span>
            <span>Booked: {dayjs(reservation.reserved_at).format('MMM D, YYYY h:mm A')}</span>
          </div>
        </div>

        {/* Contextual Action Buttons */}
        <div className={styles.headerActions}>
          {reservation.status === 'Pending' && (
            <>
              <Button
                type="primary"
                icon={<CheckCircleOutlined aria-hidden="true" />}
                loading={confirmMutation.isPending}
                onClick={handleConfirm}
                style={{ background: '#16a34a', borderColor: '#16a34a' }}
              >
                Confirm Booking
              </Button>
              <Button
                danger
                icon={<CloseCircleOutlined aria-hidden="true" />}
                onClick={() => setIsCancelModalOpen(true)}
              >
                Cancel
              </Button>
            </>
          )}

          {reservation.status === 'Confirmed' && (
            <>
              <Button
                type="primary"
                icon={<LoginOutlined aria-hidden="true" />}
                onClick={() => navigate('/check-in-out')}
                style={{ background: '#0284c7', borderColor: '#0284c7' }}
              >
                Check In Guest
              </Button>
              <Button
                icon={<StopOutlined aria-hidden="true" />}
                loading={noShowMutation.isPending}
                onClick={handleMarkNoShow}
              >
                Mark No-Show
              </Button>
              <Button
                danger
                icon={<CloseCircleOutlined aria-hidden="true" />}
                onClick={() => setIsCancelModalOpen(true)}
              >
                Cancel
              </Button>
            </>
          )}

          {reservation.status === 'CheckedIn' && (
            <Button
              type="primary"
              icon={<LogoutOutlined aria-hidden="true" />}
              onClick={() => navigate('/check-in-out')}
              style={{ background: '#7c3aed', borderColor: '#7c3aed' }}
            >
              Check Out Guest
            </Button>
          )}
        </div>
      </section>

      {/* Two Column Grid */}
      <div className={styles.contentGrid}>
        {/* Left Column: Guest Info & Assigned Kubos */}
        <div className={styles.cardSection}>
          {/* Guest Information Card */}
          <Card className={styles.infoCard} bodyStyle={{ padding: 20 }}>
            <div className={styles.sectionHeader}>
              <UserOutlined aria-hidden="true" />
              <span>Guest Information</span>
            </div>
            <div className={styles.guestGrid}>
              <div className={styles.infoRow}>
                <span className={styles.infoLabel}>Full Name</span>
                <span className={styles.infoValue}>{reservation.guest_name}</span>
              </div>
              <div className={styles.infoRow}>
                <span className={styles.infoLabel}>Profile Action</span>
                <Button
                  size="small"
                  type="link"
                  style={{ padding: 0, height: 'auto', textAlign: 'left' }}
                  onClick={() => navigate(`/guests/${reservation.guest_id}`)}
                >
                  View Full Profile & ID →
                </Button>
              </div>
              <div className={styles.infoRow}>
                <span className={styles.infoLabel}>Encoded By</span>
                <span className={styles.infoValue}>{reservation.employee_name || 'Staff'}</span>
              </div>
              <div className={styles.infoRow}>
                <span className={styles.infoLabel}>Booking Channel</span>
                <span className={styles.infoValue}>
                  {BOOKING_SOURCE_LABELS[reservation.booking_source] || reservation.booking_source}
                </span>
              </div>
            </div>
          </Card>

          {/* Assigned Kubos Table */}
          <Card className={styles.infoCard} bodyStyle={{ padding: 20 }}>
            <div className={styles.sectionHeader}>
              <HomeOutlined aria-hidden="true" />
              <span>Assigned Kubos & Rate Snapshots</span>
            </div>
            <p style={{ fontSize: '0.82rem', color: '#64748b', marginTop: -8, marginBottom: 16 }}>
              {RESERVATION_POLICIES.RATE_SNAPSHOT}
            </p>
            <Table<ReservationAssignment>
              dataSource={reservation.assignments || []}
              columns={assignmentColumns}
              rowKey={(r, i) => r.reserved_kubo_id || `${r.kubo_id}-${i}`}
              pagination={false}
              size="small"
            />
          </Card>

          {/* Cancellation Info (if applicable) */}
          {reservation.status === 'Cancelled' && (
            <Card className={styles.infoCard} bodyStyle={{ padding: 20 }}>
              <div className={styles.sectionHeader} style={{ color: '#dc2626' }}>
                <ExclamationCircleOutlined aria-hidden="true" />
                <span>Cancellation Audit Record (BR-035)</span>
              </div>
              <div className={styles.infoRow}>
                <span className={styles.infoLabel}>Reason</span>
                <span className={styles.infoValue} style={{ color: '#dc2626', fontWeight: 600 }}>
                  {reservation.cancellation_reason || 'No cancellation reason provided.'}
                </span>
              </div>
              {reservation.cancelled_at && (
                <div className={styles.infoRow} style={{ marginTop: 12 }}>
                  <span className={styles.infoLabel}>Cancelled Timestamp</span>
                  <span className={styles.infoValue}>
                    {dayjs(reservation.cancelled_at).format('MMMM D, YYYY h:mm A')}
                  </span>
                </div>
              )}
            </Card>
          )}
        </div>

        {/* Right Column: Financial Summary & Transaction Breakdown */}
        <div className={styles.cardSection}>
          {/* Financial Summary Card (BR-040, BR-047) */}
          <Card className={styles.infoCard} bodyStyle={{ padding: 20 }}>
            <div className={styles.sectionHeader}>
              <DollarOutlined aria-hidden="true" />
              <span>Financial Overview & Settlement</span>
            </div>
            <p style={{ fontSize: '0.82rem', color: '#64748b', marginTop: -8, marginBottom: 16 }}>
              {RESERVATION_POLICIES.BALANCE_DERIVED}
            </p>

            <div className={styles.financialBox}>
              <div className={styles.financialRow}>
                <span style={{ color: '#475569' }}>Accommodation Charges:</span>
                <span style={{ fontWeight: 600 }}>{formatCurrency(accommodationTotal)}</span>
              </div>
              <div className={styles.financialRow}>
                <span style={{ color: '#475569' }}>Additional Charges:</span>
                <span style={{ fontWeight: 600 }}>{formatCurrency(chargesTotal)}</span>
              </div>
              <div className={styles.financialRow}>
                <span style={{ color: '#475569' }}>Total Billed:</span>
                <span style={{ fontWeight: 700, color: '#0c4a6e' }}>{formatCurrency(totalBilled)}</span>
              </div>
              <div className={styles.financialRow}>
                <span style={{ color: '#16a34a' }}>Net Payments Received:</span>
                <span style={{ fontWeight: 700, color: '#16a34a' }}>- {formatCurrency(netPaid)}</span>
              </div>

              <div className={styles.balanceRow}>
                <span>Outstanding Balance:</span>
                <span
                  className={`${styles.balanceAmount} ${isSettled ? styles.balanceSettled : styles.balanceUnsettled}`}
                >
                  {formatCurrency(outstandingBalance)}
                </span>
              </div>
            </div>

            <div style={{ marginTop: 16, display: 'flex', gap: 8 }}>
              <Button
                type="primary"
                icon={<CreditCardOutlined aria-hidden="true" />}
                style={{ flex: 1, background: '#0284c7', borderColor: '#0284c7' }}
                onClick={() => navigate('/payments')}
              >
                Record Payment
              </Button>
            </div>
          </Card>

          {/* Payments Breakdown */}
          <Card className={styles.infoCard} bodyStyle={{ padding: 20 }}>
            <div className={styles.sectionHeader}>
              <CreditCardOutlined aria-hidden="true" />
              <span>Payment Records ({payments.length})</span>
            </div>
            {payments.length === 0 ? (
              <p style={{ color: '#94a3b8', fontSize: '0.85rem', margin: 0 }}>
                No payments have been recorded for this reservation.
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {payments.map((p: PaymentItem) => (
                  <div
                    key={p.payment_id}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '8px 12px',
                      background: '#f8fafc',
                      borderRadius: 6,
                      fontSize: '0.85rem',
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 600, color: '#1e293b' }}>
                        {p.transaction_type}: {formatCurrency(p.amount)}
                      </div>
                      <div style={{ color: '#64748b', fontSize: '0.78rem' }}>
                        {p.payment_method} • {dayjs(p.payment_date).format('MMM D, YYYY')}
                      </div>
                    </div>
                    {p.reference_number && (
                      <Tag style={{ margin: 0, fontSize: '0.75rem', fontFamily: 'monospace' }}>
                        Ref: {p.reference_number}
                      </Tag>
                    )}
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Additional Charges Breakdown */}
          <Card className={styles.infoCard} bodyStyle={{ padding: 20 }}>
            <div className={styles.sectionHeader}>
              <FileTextOutlined aria-hidden="true" />
              <span>Additional Charges ({charges.length})</span>
            </div>
            {charges.length === 0 ? (
              <p style={{ color: '#94a3b8', fontSize: '0.85rem', margin: 0 }}>
                No additional incidentals or service charges applied.
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {charges.map((c: AdditionalChargeItem) => (
                  <div
                    key={c.charge_id}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '8px 12px',
                      background: '#f8fafc',
                      borderRadius: 6,
                      fontSize: '0.85rem',
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 600, color: '#1e293b' }}>
                        {c.charge_type}: {formatCurrency(c.amount)}
                      </div>
                      <div style={{ color: '#64748b', fontSize: '0.78rem' }}>
                        {c.description || 'Standard incidental'}
                      </div>
                    </div>
                    <span style={{ fontSize: '0.78rem', color: '#94a3b8' }}>
                      {dayjs(c.charged_at).format('MMM D')}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>

      {/* Cancellation Reason Modal with Strict Danger Token by Intent */}
      <Modal
        open={isCancelModalOpen}
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#dc2626' }}>
            <ExclamationCircleOutlined aria-hidden="true" />
            <span>Cancel Reservation {reservation.reference_code}</span>
          </div>
        }
        onCancel={() => {
          setIsCancelModalOpen(false);
          setCancelReason('');
        }}
        onOk={handleCancelSubmit}
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
          Cancelling this reservation will release assigned kubos back to available inventory. This action cannot be undone (BR-035).
        </p>
        <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: 6 }}>
          Cancellation Reason <span style={{ color: '#ef4444' }}>*</span>
        </label>
        <TextArea
          rows={3}
          value={cancelReason}
          onChange={(e) => setCancelReason(e.target.value)}
          placeholder="State the cancellation rationale (e.g., Guest requested cancellation, travel emergency)..."
          maxLength={RESERVATION_LIMITS.MAX_CANCELLATION_REASON}
          showCount
          autoFocus
        />
      </Modal>
    </main>
  );
};
