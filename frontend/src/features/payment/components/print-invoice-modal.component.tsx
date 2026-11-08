import { useCallback, useRef } from 'react';
import { Modal, Button } from 'antd';
import { PrinterOutlined } from '@ant-design/icons';
import {
  CHARGE_TYPE_LABELS,
  PAYMENT_METHOD_LABELS,
  PAYMENT_TYPE_LABELS,
  TRANSACTION_TYPE_LABELS,
} from '../constants/payment.constants';
import type { InvoiceBillingBreakdown, AdditionalChargeType, PaymentMethod, PaymentType } from '../types/payment.types';
import styles from './print-invoice-modal.module.css';
import dayjs from 'dayjs';

/** Philippine Peso currency formatter (BR-048) */
const formatCurrency = (value: number): string =>
  new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(value);

export interface PrintInvoiceModalProps {
  open: boolean;
  onClose: () => void;
  invoice: InvoiceBillingBreakdown | null;
}

/**
 * Printable guest invoice / billing statement modal.
 *
 * Renders a clean breakdown of accommodation charges, incidentals,
 * payments, and outstanding balance. Supports browser print via
 * window.print() scoped to the invoice container.
 */
export function PrintInvoiceModal({ open, onClose, invoice }: PrintInvoiceModalProps) {
  const printRef = useRef<HTMLDivElement>(null);

  const handlePrint = useCallback(() => {
    if (!printRef.current) return;

    const printContent = printRef.current.innerHTML;
    const printWindow = window.open('', '_blank', 'width=800,height=900');
    if (!printWindow) return;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Invoice - ${invoice?.referenceCode || 'Statement'}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: 'Segoe UI', system-ui, -apple-system, sans-serif; color: #0f172a; padding: 24px; }
          table { width: 100%; border-collapse: collapse; }
          th { font-size: 11px; color: #64748b; text-transform: uppercase; font-weight: 600; text-align: left; padding: 6px 8px; border-bottom: 1px solid #e2e8f0; }
          th:last-child { text-align: right; }
          td { font-size: 12px; padding: 6px 8px; border-bottom: 1px solid #f1f5f9; color: #334155; }
          td:last-child { text-align: right; font-weight: 600; font-variant-numeric: tabular-nums; }
          @media print { body { padding: 8px; } }
        </style>
      </head>
      <body>${printContent}</body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
    printWindow.close();
  }, [invoice]);

  if (!invoice) return null;

  return (
    <Modal
      title={
        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <PrinterOutlined aria-hidden="true" />
          Guest Invoice / Billing Statement
        </span>
      }
      open={open}
      onCancel={onClose}
      width={740}
      footer={[
        <Button key="close" onClick={onClose}>
          Close
        </Button>,
        <Button
          key="print"
          type="primary"
          icon={<PrinterOutlined aria-hidden="true" />}
          onClick={handlePrint}
          style={{ background: '#0c4a6e', borderColor: '#0c4a6e' }}
        >
          Print Invoice
        </Button>,
      ]}
      destroyOnClose
    >
      <div ref={printRef} className={styles.invoiceContainer}>
        {/* Resort Branding Header */}
        <div className={styles.invoiceHeader}>
          <h1 className={styles.resortName}>KUBO Resort</h1>
          <p className={styles.invoiceSubtitle}>
            Reservation Management System
          </p>
          <h2 className={styles.invoiceTitle}>Guest Billing Statement</h2>
        </div>

        {/* Reservation & Guest Metadata */}
        <div className={styles.metaGrid}>
          <div className={styles.metaItem}>
            <span className={styles.metaLabel}>Reference Code</span>
            <span className={styles.metaValue}>{invoice.referenceCode}</span>
          </div>
          <div className={styles.metaItem}>
            <span className={styles.metaLabel}>Status</span>
            <span className={styles.metaValue}>{invoice.status}</span>
          </div>
          <div className={styles.metaItem}>
            <span className={styles.metaLabel}>Guest Name</span>
            <span className={styles.metaValue}>{invoice.guestName}</span>
          </div>
          <div className={styles.metaItem}>
            <span className={styles.metaLabel}>Stay Period</span>
            <span className={styles.metaValue}>
              {dayjs(invoice.checkInDate).format('MMM D, YYYY')} &mdash;{' '}
              {dayjs(invoice.checkOutDate).format('MMM D, YYYY')}
            </span>
          </div>
          {invoice.guestEmail && (
            <div className={styles.metaItem}>
              <span className={styles.metaLabel}>Email</span>
              <span className={styles.metaValue}>{invoice.guestEmail}</span>
            </div>
          )}
          {invoice.guestPhone && (
            <div className={styles.metaItem}>
              <span className={styles.metaLabel}>Phone</span>
              <span className={styles.metaValue}>{invoice.guestPhone}</span>
            </div>
          )}
        </div>

        {/* Accommodation Line Items */}
        <h3 className={styles.sectionTitle}>Accommodation Charges</h3>
        <table className={styles.lineTable}>
          <thead>
            <tr>
              <th>Kubo</th>
              <th>Type</th>
              <th>Nights</th>
              <th>Rate / Night</th>
              <th>Subtotal</th>
            </tr>
          </thead>
          <tbody>
            {invoice.assignments.map((a, i) => (
              <tr key={`assign-${i}`}>
                <td>{a.kuboNumber}</td>
                <td>{a.typeName}</td>
                <td style={{ textAlign: 'center' }}>{a.nights}</td>
                <td style={{ textAlign: 'right' }}>{formatCurrency(a.pricePerNight)}</td>
                <td>{formatCurrency(a.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Additional / Incidental Charges */}
        {invoice.additionalCharges.length > 0 && (
          <>
            <h3 className={styles.sectionTitle}>Incidental Charges</h3>
            <table className={styles.lineTable}>
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Description</th>
                  <th>Date</th>
                  <th>Amount</th>
                </tr>
              </thead>
              <tbody>
                {invoice.additionalCharges.map((c) => (
                  <tr key={c.chargeId}>
                    <td>{CHARGE_TYPE_LABELS[c.chargeType as AdditionalChargeType] || c.chargeType}</td>
                    <td>{c.description || '--'}</td>
                    <td>{dayjs(c.date).format('MMM D, YYYY')}</td>
                    <td>{formatCurrency(c.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}

        {/* Payment Transaction Records */}
        {invoice.payments.length > 0 && (
          <>
            <h3 className={styles.sectionTitle}>Payment Transactions</h3>
            <table className={styles.lineTable}>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Type</th>
                  <th>Details</th>
                  <th>Method</th>
                  <th>Status</th>
                  <th>Amount</th>
                </tr>
              </thead>
              <tbody>
                {invoice.payments.map((p) => (
                  <tr key={p.paymentId}>
                    <td>{dayjs(p.date).format('MMM D, YYYY')}</td>
                    <td>
                      {p.transactionType === 'Payment'
                        ? PAYMENT_TYPE_LABELS[p.type as PaymentType] || p.type
                        : TRANSACTION_TYPE_LABELS[p.transactionType]}
                      {p.description ? ` · ${p.description}` : ''}
                    </td>
                    <td>
                      {p.transactionType === 'Payment' || p.transactionType === 'Refund'
                        ? PAYMENT_METHOD_LABELS[p.method as PaymentMethod] || p.method
                        : '—'}
                    </td>
                    <td>{p.status}</td>
                    <td>
                      <span className={p.transactionType === 'Refund' || p.transactionType === 'Reversal' ? styles.refundTag : styles.paymentTag}>
                        {p.transactionType === 'Refund' || p.transactionType === 'Adjustment' ? '-' : '+'}
                        {formatCurrency(p.amount)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}

        {/* Financial Summary */}
        <div className={styles.summaryBox}>
          <div className={styles.summaryRow}>
            <span>Accommodation Total:</span>
            <span>{formatCurrency(invoice.accommodationTotal)}</span>
          </div>
          {invoice.chargesTotal > 0 && (
            <div className={styles.summaryRow}>
              <span>Incidental Charges:</span>
              <span>{formatCurrency(invoice.chargesTotal - invoice.accommodationTotal)}</span>
            </div>
          )}
          <div className={styles.summaryRow} style={{ fontWeight: 700 }}>
            <span>Gross Billed:</span>
            <span>{formatCurrency(invoice.grossBilled)}</span>
          </div>
          <div className={styles.summaryRow}>
            <span>Net Payments Received:</span>
            <span style={{ color: '#16a34a' }}>- {formatCurrency(invoice.netPaid)}</span>
          </div>
          {invoice.chargeReductions > 0 && (
            <div className={styles.summaryRow}>
              <span>Charge reductions:</span>
              <span style={{ color: '#16a34a' }}>- {formatCurrency(invoice.chargeReductions)}</span>
            </div>
          )}
          <div className={styles.balanceRow}>
            <span>Outstanding Balance:</span>
            <span className={invoice.isSettled ? styles.balanceSettled : styles.balanceOwed}>
              {formatCurrency(invoice.outstandingBalance)}
            </span>
          </div>
        </div>

        {/* Footer */}
        <div className={styles.invoiceFooter}>
          <p>
            Generated on {dayjs().format('MMMM D, YYYY h:mm A')} |
            KUBO Resort Reservation Management System
          </p>
          <p style={{ marginTop: 4 }}>
            This is a computer-generated document. Amounts are in Philippine Pesos (PHP).
          </p>
        </div>
      </div>
    </Modal>
  );
}
