import { useMemo, useCallback, useEffect } from 'react';
import {
  Modal,
  Form,
  InputNumber,
  Select,
  Input,
  Alert,
  Divider,
} from 'antd';
import {
  DollarOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import { useRecordPayment } from '../hooks/use-payment-mutations.hook';
import {
  PAYMENT_METHOD_OPTIONS,
  PAYMENT_TYPE_OPTIONS,
  PAYMENT_POLICIES,
} from '../constants/payment.constants';
import type { PaymentMethod, PaymentType } from '../types/payment.types';
import styles from './record-payment-modal.module.css';

/** Philippine Peso currency formatter (BR-048) */
const formatCurrency = (value: number): string =>
  new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(value);

export interface RecordPaymentModalProps {
  open: boolean;
  onClose: () => void;
  reservationId: string;
  outstandingBalance: number;
  netPaid: number;
  employeeId?: string;
}

interface PaymentFormValues {
  paymentAmount: number;
  paymentType: PaymentType;
  paymentMethod: PaymentMethod;
  notes?: string;
}

/**
 * Modal form to record an incoming payment against a reservation.
 *
 * Validates:
 * - Amount is positive with at most 2 decimal places (BR-048).
 * - Amount does not exceed outstanding balance unless admin-approved (BR-053).
 * - Required fields (amount, type, method) are all populated (BR-049).
 */
export function RecordPaymentModal({
  open,
  onClose,
  reservationId,
  outstandingBalance,
  netPaid,
  employeeId,
}: RecordPaymentModalProps) {
  const [form] = Form.useForm<PaymentFormValues>();
  const recordPayment = useRecordPayment();
  const currentAmount = Form.useWatch('paymentAmount', form);

  const isOverpaying = useMemo(
    () => typeof currentAmount === 'number' && currentAmount > outstandingBalance && outstandingBalance > 0,
    [currentAmount, outstandingBalance]
  );

  // Reset form state when modal opens
  useEffect(() => {
    if (open) {
      form.resetFields();
    }
  }, [open, form]);

  const handleSubmit = useCallback(async () => {
    try {
      const values = await form.validateFields();

      await recordPayment.mutateAsync({
        reservationId,
        employeeId: employeeId || '',
        paymentAmount: values.paymentAmount,
        paymentType: values.paymentType,
        paymentMethod: values.paymentMethod,
        notes: values.notes,
        transactionType: 'Payment',
        paymentStatus: 'Completed',
      });

      form.resetFields();
      onClose();
    } catch {
      // Form validation or mutation error handled by useAppMutation
    }
  }, [form, recordPayment, reservationId, employeeId, onClose]);

  return (
    <Modal
      title={
        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <DollarOutlined aria-hidden="true" />
          Record Payment
        </span>
      }
      open={open}
      onCancel={onClose}
      onOk={handleSubmit}
      okText="Record Payment"
      okButtonProps={{
        loading: recordPayment.isPending,
        style: { background: '#16a34a', borderColor: '#16a34a' },
      }}
      cancelButtonProps={{ disabled: recordPayment.isPending }}
      destroyOnClose
      width={520}
    >
      <div className={styles.modalContent}>
        {/* Financial Context */}
        <div className={styles.balanceCard}>
          <div className={styles.balanceGrid}>
            <div className={styles.balanceStat}>
              <span className={styles.balanceLabel}>Net Paid</span>
              <span className={styles.balanceValue}>{formatCurrency(netPaid)}</span>
            </div>
            <div className={styles.balanceStat}>
              <span className={styles.balanceLabel}>Outstanding Balance</span>
              <span className={outstandingBalance > 0 ? styles.balanceOutstanding : styles.balanceSettled}>
                {formatCurrency(outstandingBalance)}
              </span>
            </div>
          </div>
        </div>

        {isOverpaying && (
          <Alert
            className={styles.overpaymentAlert}
            type="warning"
            showIcon
            icon={<WarningOutlined aria-hidden="true" />}
            message="Amount exceeds the outstanding balance"
            description={`The entered amount exceeds the outstanding balance of ${formatCurrency(outstandingBalance)}. Administrator approval is required to proceed with an overpayment.`}
          />
        )}

        <Form
          form={form}
          layout="vertical"
          requiredMark="optional"
          initialValues={{
            paymentType: 'FullPayment' as PaymentType,
            paymentMethod: 'Cash' as PaymentMethod,
          }}
        >
          <Form.Item
            name="paymentAmount"
            label="Payment Amount (PHP)"
            rules={[
              { required: true, message: 'Enter the payment amount.' },
              {
                type: 'number',
                min: 0.01,
                message: 'Amount must be greater than zero.',
              },
              {
                validator: (_, value) => {
                  if (value && Number(Number(value).toFixed(2)) !== Number(value)) {
                    return Promise.reject(new Error('Amount cannot exceed two decimal places.'));
                  }
                  return Promise.resolve();
                },
              },
            ]}
          >
            <InputNumber<number>
              style={{ width: '100%' }}
              min={0.01}
              step={0.01}
              precision={2}
              placeholder="0.00"
              prefix={<span style={{ color: '#94a3b8' }}>PHP</span>}
              size="large"
            />
          </Form.Item>

          <Form.Item
            name="paymentType"
            label="Payment Type"
            rules={[{ required: true, message: 'Select a payment type.' }]}
          >
            <Select
              options={PAYMENT_TYPE_OPTIONS}
              placeholder="Select payment type"
            />
          </Form.Item>

          <Form.Item
            name="paymentMethod"
            label="Payment Method"
            rules={[{ required: true, message: 'Select a payment method.' }]}
          >
            <Select
              options={PAYMENT_METHOD_OPTIONS}
              placeholder="Select payment method"
            />
          </Form.Item>

          <Divider style={{ margin: '12px 0' }} />

          <Form.Item name="notes" label="Notes (Optional)">
            <Input.TextArea
              rows={2}
              placeholder="Optional reference number, receipt ID, or transaction remarks"
              maxLength={500}
              showCount
            />
          </Form.Item>
        </Form>

        <p className={styles.policyNote}>
          {PAYMENT_POLICIES.NO_HARD_DELETION}
        </p>
      </div>
    </Modal>
  );
}
