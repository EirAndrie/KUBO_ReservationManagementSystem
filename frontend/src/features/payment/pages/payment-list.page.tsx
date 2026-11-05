import { useState, useMemo, useCallback } from 'react';
import {
  Typography,
  Button,
  Table,
  Tag,
  Select,
  Modal,
  Input,
  Empty,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  PlusCircleOutlined,
  CreditCardOutlined,
  PrinterOutlined,
  FilterOutlined,
  ClearOutlined,
  FileTextOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';

import { usePayments, useReservationPayments, useReservationCharges } from '../hooks/use-payments.hook';
import { RecordPaymentModal } from '../components/record-payment-modal.component';
import { AddChargeModal } from '../components/add-charge-modal.component';
import { PrintInvoiceModal } from '../components/print-invoice-modal.component';
import {
  PAYMENT_METHOD_OPTIONS,
  PAYMENT_STATUS_OPTIONS,
  TRANSACTION_TYPE_OPTIONS,
  TRANSACTION_TYPE_COLORS,
  PAYMENT_STATUS_TAGS,
  PAYMENT_METHOD_LABELS,
  PAYMENT_TYPE_LABELS,
  TRANSACTION_TYPE_LABELS,
} from '../constants/payment.constants';
import type {
  Payment,
  PaymentFilterParams,
  TransactionType,
  PaymentStatus,
  PaymentMethod,
  PaymentType,
  InvoiceBillingBreakdown,
} from '../types/payment.types';
import { apiClient } from '@/lib/api';
import styles from './payment-list.module.css';

const { Title } = Typography;

/** Philippine Peso currency formatter (BR-048) */
const formatCurrency = (value: number): string =>
  new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(value);

/**
 * Financial transactions ledger page.
 *
 * Displays all payment and refund records across reservations with filters
 * for Payment Method, Status, Transaction Type, and Date Range.
 *
 * Supports:
 * - Record Payment (BR-049)
 * - Add Extra Charge (BR-042)
 * - Print Invoice / Statement
 *
 * Token by Intent:
 * - Affirmative payments are tagged green.
 * - Refunds/reversals are tagged red/purple (distinct warning).
 */
export function PaymentListPage() {
  // Filter state
  const [filters, setFilters] = useState<PaymentFilterParams>({});
  const { data: payments = [], isLoading } = usePayments(filters);

  // Modals
  const [isPaymentModalOpen, setPaymentModalOpen] = useState(false);
  const [isChargeModalOpen, setChargeModalOpen] = useState(false);
  const [isInvoiceModalOpen, setInvoiceModalOpen] = useState(false);
  const [isReservationSelectorOpen, setReservationSelectorOpen] = useState(false);
  const [modalAction, setModalAction] = useState<'payment' | 'charge' | 'invoice'>('payment');

  // Selected reservation context
  const [selectedReservationId, setSelectedReservationId] = useState('');
  const [reservationSearchText, setReservationSearchText] = useState('');
  const [reservationOptions, setReservationOptions] = useState<Array<{ reservation_id: string; reference_code: string; guest_name: string; status: string; outstanding_balance: string; net_paid: string; accommodation_total: string; charges_total: string; assignments: Array<Record<string, unknown>> }>>([]);
  const [reservationLoading, setReservationLoading] = useState(false);
  const [invoiceData, setInvoiceData] = useState<InvoiceBillingBreakdown | null>(null);

  // Reservation payments/charges for the selected reservation
  const { data: reservationPayments = [] } = useReservationPayments(selectedReservationId);
  const { data: reservationCharges = [] } = useReservationCharges(selectedReservationId);

  // Derived financial data for selected reservation
  const selectedReservation = useMemo(
    () => reservationOptions.find((r) => r.reservation_id === selectedReservationId),
    [reservationOptions, selectedReservationId]
  );

  const outstandingBalance = useMemo(() => {
    if (!selectedReservation) return 0;
    return Math.max(0, Number(selectedReservation.outstanding_balance || 0));
  }, [selectedReservation]);

  const netPaid = useMemo(() => {
    if (!selectedReservation) return 0;
    return Number(selectedReservation.net_paid || 0);
  }, [selectedReservation]);

  // Summary statistics from ledger data
  const ledgerSummary = useMemo(() => {
    let totalIncoming = 0;
    let totalRefunds = 0;
    let transactionCount = 0;

    for (const p of payments) {
      transactionCount++;
      if (p.transaction_type === 'Payment' && p.payment_status === 'Completed') {
        totalIncoming += p.payment_amount;
      } else if (p.transaction_type === 'Refund' && p.payment_status === 'Completed') {
        totalRefunds += p.payment_amount;
      }
    }

    return {
      totalIncoming,
      totalRefunds,
      netRevenue: totalIncoming - totalRefunds,
      transactionCount,
    };
  }, [payments]);

  // Search reservations for selector modal
  const searchReservations = useCallback(async (search: string) => {
    setReservationLoading(true);
    try {
      const res = await apiClient.get<{ reservations: Array<Record<string, unknown>> }>('/reservations', {
        params: { search: search || undefined, limit: 20 },
      });
      const raw = res as unknown as { reservations?: Array<Record<string, unknown>> } | Array<Record<string, unknown>>;
      const list = Array.isArray(raw) ? raw : (raw as { reservations?: Array<Record<string, unknown>> })?.reservations || [];
      setReservationOptions(list as typeof reservationOptions);
    } catch {
      setReservationOptions([]);
    } finally {
      setReservationLoading(false);
    }
  }, []);

  // Open reservation selector for a specific action
  const openReservationSelector = useCallback((action: 'payment' | 'charge' | 'invoice') => {
    setModalAction(action);
    setReservationSelectorOpen(true);
    searchReservations('');
  }, [searchReservations]);

  // Handle reservation selection & open the target modal
  const handleReservationSelected = useCallback(async () => {
    setReservationSelectorOpen(false);

    if (modalAction === 'payment') {
      setPaymentModalOpen(true);
    } else if (modalAction === 'charge') {
      setChargeModalOpen(true);
    } else if (modalAction === 'invoice') {
      // Build invoice data
      if (selectedReservation) {
        const r = selectedReservation;
        const assignments = (r.assignments || []).map((a: Record<string, unknown>) => {
          const checkIn = dayjs(String(a.check_in_date || ''));
          const checkOut = dayjs(String(a.check_out_date || ''));
          const nights = Math.max(1, checkOut.diff(checkIn, 'day'));
          const pricePerNight = Number(a.price_at_booking || 0);
          return {
            kuboNumber: String(a.kubo_number || a.kubo_id || ''),
            typeName: String(a.type_name || ''),
            nights,
            pricePerNight,
            total: nights * pricePerNight,
          };
        });

        const accommodationTotal = assignments.reduce((sum: number, a: { total: number }) => sum + a.total, 0);
        const chargesSum = reservationCharges.reduce((sum, c) => sum + c.amount, 0);
        const grossBilled = accommodationTotal + chargesSum;

        let completedPayments = 0;
        let completedRefunds = 0;
        for (const p of reservationPayments) {
          if (p.payment_status === 'Completed') {
            if (p.transaction_type === 'Payment') completedPayments += p.payment_amount;
            if (p.transaction_type === 'Refund') completedRefunds += p.payment_amount;
          }
        }

        const computedNetPaid = completedPayments - completedRefunds;
        const computedBalance = Math.max(0, grossBilled - computedNetPaid);

        const firstAssignment = r.assignments?.[0] as Record<string, unknown> | undefined;
        const lastAssignment = r.assignments?.[r.assignments.length - 1] as Record<string, unknown> | undefined;

        const invoice: InvoiceBillingBreakdown = {
          reservationId: r.reservation_id,
          referenceCode: r.reference_code,
          guestName: r.guest_name,
          status: r.status,
          checkInDate: String(firstAssignment?.check_in_date || ''),
          checkOutDate: String(lastAssignment?.check_out_date || ''),
          assignments,
          additionalCharges: reservationCharges.map((c) => ({
            chargeId: c.additional_charge_id,
            chargeType: c.charge_type,
            description: c.description,
            amount: c.amount,
            date: c.charge_date,
          })),
          payments: reservationPayments.map((p) => ({
            paymentId: p.payment_id,
            date: p.payment_date,
            transactionType: p.transaction_type,
            method: p.payment_method,
            type: p.payment_type,
            amount: p.payment_amount,
            status: p.payment_status,
          })),
          accommodationTotal,
          chargesTotal: grossBilled,
          grossBilled,
          netPaid: computedNetPaid,
          outstandingBalance: computedBalance,
          isSettled: computedBalance <= 0,
        };

        setInvoiceData(invoice);
        setInvoiceModalOpen(true);
      }
    }
  }, [modalAction, selectedReservation, reservationPayments, reservationCharges]);

  // Filter handlers
  const updateFilter = useCallback((key: keyof PaymentFilterParams, value: string | undefined) => {
    setFilters((prev) => ({ ...prev, [key]: value || undefined }));
  }, []);

  const clearFilters = useCallback(() => {
    setFilters({});
  }, []);

  const hasActiveFilters = Object.values(filters).some(Boolean);

  // Table columns
  const columns: ColumnsType<Payment> = useMemo(
    () => [
      {
        title: 'Date',
        dataIndex: 'payment_date',
        key: 'payment_date',
        width: 120,
        sorter: (a, b) => dayjs(a.payment_date).unix() - dayjs(b.payment_date).unix(),
        defaultSortOrder: 'descend',
        render: (date: string) => dayjs(date).format('MMM D, YYYY'),
      },
      {
        title: 'Reservation',
        key: 'reservation',
        width: 140,
        render: (_: unknown, record: Payment) => record.reservation_reference || record.reservation_id.slice(0, 8),
      },
      {
        title: 'Guest',
        dataIndex: 'guest_name',
        key: 'guest_name',
        width: 150,
        render: (name: string | undefined) => name || '--',
      },
      {
        title: 'Transaction',
        dataIndex: 'transaction_type',
        key: 'transaction_type',
        width: 140,
        render: (type: TransactionType) => {
          const colors = TRANSACTION_TYPE_COLORS[type] || TRANSACTION_TYPE_COLORS.Payment;
          return (
            <span
              className={styles.transactionTag}
              style={{ color: colors.color, borderColor: colors.border, backgroundColor: colors.bg }}
            >
              {TRANSACTION_TYPE_LABELS[type] || type}
            </span>
          );
        },
      },
      {
        title: 'Type',
        dataIndex: 'payment_type',
        key: 'payment_type',
        width: 140,
        render: (type: PaymentType) => PAYMENT_TYPE_LABELS[type] || type,
      },
      {
        title: 'Method',
        dataIndex: 'payment_method',
        key: 'payment_method',
        width: 130,
        render: (method: PaymentMethod) => PAYMENT_METHOD_LABELS[method] || method,
      },
      {
        title: 'Status',
        dataIndex: 'payment_status',
        key: 'payment_status',
        width: 120,
        render: (status: PaymentStatus) => {
          const tagConfig = PAYMENT_STATUS_TAGS[status] || { color: 'default' };
          return <Tag color={tagConfig.color}>{status}</Tag>;
        },
      },
      {
        title: 'Amount',
        dataIndex: 'payment_amount',
        key: 'payment_amount',
        width: 140,
        align: 'right',
        sorter: (a, b) => a.payment_amount - b.payment_amount,
        render: (amount: number, record: Payment) => {
          const isOutgoing = record.transaction_type === 'Refund' || record.transaction_type === 'Reversal';
          return (
            <span className={isOutgoing ? styles.amountOutgoing : styles.amountIncoming}>
              {isOutgoing ? '-' : '+'}
              {formatCurrency(amount)}
            </span>
          );
        },
      },
    ],
    []
  );

  return (
    <main className={styles.pageContainer} aria-label="Financial Transactions Ledger">
      {/* Page Header */}
      <div className={styles.pageHeader}>
        <div>
          <Title level={2} className={styles.pageTitle}>
            Billing and Payment Ledger
          </Title>
          <p className={styles.pageDescription}>
            Record payments, post incidental charges, and generate guest billing statements.
          </p>
        </div>
        <div className={styles.headerActions}>
          <Button
            icon={<PlusCircleOutlined aria-hidden="true" />}
            onClick={() => openReservationSelector('charge')}
            style={{ borderColor: '#d97706', color: '#d97706' }}
          >
            Add Extra Charge
          </Button>
          <Button
            icon={<PrinterOutlined aria-hidden="true" />}
            onClick={() => openReservationSelector('invoice')}
          >
            Print Invoice
          </Button>
          <Button
            type="primary"
            icon={<CreditCardOutlined aria-hidden="true" />}
            onClick={() => openReservationSelector('payment')}
            style={{ background: '#16a34a', borderColor: '#16a34a' }}
          >
            Record Payment
          </Button>
        </div>
      </div>

      {/* Summary Statistics */}
      <div className={styles.summaryRow}>
        <div className={styles.summaryCard}>
          <div className={styles.summaryLabel}>Total Transactions</div>
          <div className={styles.summaryValue}>{ledgerSummary.transactionCount}</div>
        </div>
        <div className={styles.summaryCard}>
          <div className={styles.summaryLabel}>Incoming Payments</div>
          <div className={styles.summaryIncoming}>{formatCurrency(ledgerSummary.totalIncoming)}</div>
        </div>
        <div className={styles.summaryCard}>
          <div className={styles.summaryLabel}>Refunds Issued</div>
          <div className={styles.summaryOutgoing}>{formatCurrency(ledgerSummary.totalRefunds)}</div>
        </div>
        <div className={styles.summaryCard}>
          <div className={styles.summaryLabel}>Net Revenue</div>
          <div className={styles.summaryNet}>{formatCurrency(ledgerSummary.netRevenue)}</div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className={styles.filterBar}>
        <div className={styles.filterItem}>
          <label className={styles.filterLabel}>
            <FilterOutlined aria-hidden="true" /> Transaction Type
          </label>
          <Select
            allowClear
            placeholder="All Types"
            options={TRANSACTION_TYPE_OPTIONS}
            value={filters.transactionType}
            onChange={(val) => updateFilter('transactionType', val)}
            style={{ width: '100%' }}
          />
        </div>
        <div className={styles.filterItem}>
          <label className={styles.filterLabel}>Payment Method</label>
          <Select
            allowClear
            placeholder="All Methods"
            options={PAYMENT_METHOD_OPTIONS}
            value={filters.paymentMethod}
            onChange={(val) => updateFilter('paymentMethod', val)}
            style={{ width: '100%' }}
          />
        </div>
        <div className={styles.filterItem}>
          <label className={styles.filterLabel}>Status</label>
          <Select
            allowClear
            placeholder="All Statuses"
            options={PAYMENT_STATUS_OPTIONS}
            value={filters.paymentStatus}
            onChange={(val) => updateFilter('paymentStatus', val)}
            style={{ width: '100%' }}
          />
        </div>
        {hasActiveFilters && (
          <div className={styles.filterClear}>
            <Button
              icon={<ClearOutlined aria-hidden="true" />}
              onClick={clearFilters}
              size="small"
            >
              Clear Filters
            </Button>
          </div>
        )}
      </div>

      {/* Transactions Table */}
      <div className={styles.tableContainer}>
        <Table<Payment>
          dataSource={payments}
          columns={columns}
          rowKey="payment_id"
          loading={isLoading}
          pagination={{
            pageSize: 20,
            showSizeChanger: true,
            pageSizeOptions: ['10', '20', '50'],
            showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} transactions`,
          }}
          locale={{
            emptyText: (
              <div className={styles.emptyState}>
                <FileTextOutlined className={styles.emptyIcon} aria-hidden="true" />
                <div className={styles.emptyTitle}>No Financial Transactions</div>
                <div className={styles.emptySubtext}>
                  {hasActiveFilters
                    ? 'No transactions match the current filters. Try adjusting your criteria.'
                    : 'Record your first payment to start tracking the financial ledger.'}
                </div>
                {!hasActiveFilters && (
                  <Button
                    type="primary"
                    icon={<CreditCardOutlined aria-hidden="true" />}
                    onClick={() => openReservationSelector('payment')}
                    style={{ background: '#16a34a', borderColor: '#16a34a' }}
                  >
                    Record First Payment
                  </Button>
                )}
              </div>
            ),
          }}
          scroll={{ x: 960 }}
          size="middle"
        />
      </div>

      {/* Reservation Selector Modal */}
      <Modal
        title="Select Reservation"
        open={isReservationSelectorOpen}
        onCancel={() => setReservationSelectorOpen(false)}
        onOk={handleReservationSelected}
        okText="Continue"
        okButtonProps={{ disabled: !selectedReservationId }}
        destroyOnClose
        width={520}
      >
        <div className={styles.selectorContainer}>
          <p style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: 12 }}>
            Search for a reservation by reference code or guest name:
          </p>
          <Input.Search
            placeholder="Search by reference code or guest name"
            value={reservationSearchText}
            onChange={(e) => setReservationSearchText(e.target.value)}
            onSearch={(val) => searchReservations(val)}
            loading={reservationLoading}
            allowClear
            style={{ marginBottom: 12 }}
          />
          <Select
            style={{ width: '100%' }}
            placeholder="Select a reservation"
            value={selectedReservationId || undefined}
            onChange={(val) => setSelectedReservationId(val)}
            loading={reservationLoading}
            showSearch
            optionFilterProp="label"
            options={reservationOptions.map((r) => ({
              value: r.reservation_id,
              label: `${r.reference_code} - ${r.guest_name} (${r.status})`,
            }))}
            notFoundContent={
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description="No reservations found"
              />
            }
          />
        </div>
      </Modal>

      {/* Record Payment Modal */}
      <RecordPaymentModal
        open={isPaymentModalOpen}
        onClose={() => setPaymentModalOpen(false)}
        reservationId={selectedReservationId}
        outstandingBalance={outstandingBalance}
        netPaid={netPaid}
      />

      {/* Add Charge Modal */}
      <AddChargeModal
        open={isChargeModalOpen}
        onClose={() => setChargeModalOpen(false)}
        reservationId={selectedReservationId}
      />

      {/* Print Invoice Modal */}
      <PrintInvoiceModal
        open={isInvoiceModalOpen}
        onClose={() => setInvoiceModalOpen(false)}
        invoice={invoiceData}
      />
    </main>
  );
}
