import { useEffect } from 'react';
import { Modal, Form, InputNumber, Select, Checkbox } from 'antd';
import { useRecordPayment } from '../hooks/use-payment-mutations.hook';
import { PAYMENT_METHOD_OPTIONS, PAYMENT_TYPE_OPTIONS } from '../constants/payment.constants';
import type { PaymentMethod, PaymentType } from '../types/payment.types';
import { formatMoney } from '@/lib/format';
import { Callout } from '@/components/common';
import styles from './record-payment-modal.module.css';

export interface RecordPaymentModalProps {
  open: boolean;
  onClose: () => void;
  reservationId: string;
  /** Reference code shown in the title. */
  referenceCode?: string;
  outstandingBalance: number;
  netPaid: number;
  /** Pre-fills the amount (e.g. "Collect ₱X" passes the balance). */
  defaultAmount?: number;
}

interface PaymentFormValues {
  paymentAmount: number;
  paymentType: PaymentType;
  paymentMethod: PaymentMethod;
  complete: boolean;
}

/**
 * Records a payment against a reservation. The server creates it as Pending
 * and rejects amounts above the outstanding balance; its message is shown
 * verbatim. "Mark as completed" completes it right away so it counts toward
 * the balance.
 */
export function RecordPaymentModal({
  open,
  onClose,
  reservationId,
  referenceCode,
  outstandingBalance,
  netPaid,
  defaultAmount,
}: RecordPaymentModalProps) {
  const [form] = Form.useForm<PaymentFormValues>();
  const recordPayment = useRecordPayment();
  const amount = Form.useWatch('paymentAmount', form);
  const isOver = typeof amount === 'number' && amount > outstandingBalance;

  useEffect(() => {
    if (open) {
      form.resetFields();
      form.setFieldsValue({
        paymentAmount: defaultAmount && defaultAmount > 0 ? Number(defaultAmount.toFixed(2)) : undefined,
        paymentType: defaultAmount && defaultAmount >= outstandingBalance ? 'BalancePayment' : 'PartialPayment',
        paymentMethod: 'Cash',
        complete: true,
      });
    }
  }, [open, form, defaultAmount, outstandingBalance]);

  const handleSubmit = async () => {
    const values = await form.validateFields();
    try {
      await recordPayment.mutateAsync({
        reservationId,
        paymentAmount: values.paymentAmount,
        paymentType: values.paymentType,
        paymentMethod: values.paymentMethod,
        complete: values.complete,
      });
      onClose();
    } catch {
      // The server message is shown by the mutation toast; keep the form open.
    }
  };

  return (
    <Modal
      title={referenceCode ? `Record payment · ${referenceCode}` : 'Record payment'}
      open={open}
      onCancel={onClose}
      onOk={handleSubmit}
      okText="Record payment"
      okButtonProps={{ loading: recordPayment.isPending }}
      cancelButtonProps={{ disabled: recordPayment.isPending }}
      destroyOnHidden
      width={480}
    >
      <div className={styles.summary}>
        <div>
          <div className={styles.summaryLabel}>Paid so far</div>
          <div className={styles.summaryValue}>{formatMoney(netPaid)}</div>
        </div>
        <div>
          <div className={styles.summaryLabel}>Balance due</div>
          <div className={styles.summaryValue}>{formatMoney(outstandingBalance)}</div>
        </div>
      </div>

      <Form form={form} layout="vertical" requiredMark={false}>
        <Form.Item
          name="paymentAmount"
          label="Amount"
          rules={[
            { required: true, message: 'Enter the amount.' },
            { type: 'number', min: 0.01, message: 'Amount must be greater than zero.' },
          ]}
        >
          <InputNumber<number> style={{ width: '100%' }} step={0.01} precision={2} prefix="₱" />
        </Form.Item>
        {isOver && (
          <Callout tone="warn" style={{ marginTop: -8, marginBottom: 16 }}>
            This is more than the balance due ({formatMoney(outstandingBalance)}). The server will reject overpayments.
          </Callout>
        )}
        <div className={styles.row}>
          <Form.Item name="paymentType" label="Type" rules={[{ required: true }]} style={{ flex: 1 }}>
            <Select options={PAYMENT_TYPE_OPTIONS} />
          </Form.Item>
          <Form.Item name="paymentMethod" label="Method" rules={[{ required: true }]} style={{ flex: 1 }}>
            <Select options={PAYMENT_METHOD_OPTIONS} />
          </Form.Item>
        </div>
        <Form.Item name="complete" valuePropName="checked" style={{ marginBottom: 0 }}>
          <Checkbox>Mark as completed now (money received)</Checkbox>
        </Form.Item>
      </Form>
    </Modal>
  );
}
