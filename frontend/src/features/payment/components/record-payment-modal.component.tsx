import { useEffect } from 'react';
import { Modal, Form, InputNumber, Select, Checkbox } from 'antd';
import { useRecordPayment } from '../hooks/use-payment-mutations.hook';
import { PAYMENT_METHOD_OPTIONS, PAYMENT_TYPE_OPTIONS } from '../constants/payment.constants';
import type { OverpaymentApproval, PaymentMethod, PaymentType } from '../types/payment.types';
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
  /** BR-053 approvals for this reservation; only `Available` ones are offered. */
  overpaymentApprovals?: OverpaymentApproval[];
}

interface PaymentFormValues {
  paymentAmount: number;
  paymentType: PaymentType;
  paymentMethod: PaymentMethod;
  complete: boolean;
  overpaymentApprovalId?: string;
}

/**
 * Records a payment against a reservation. The server creates it as Pending
 * and rejects amounts above the outstanding balance unless an Administrator
 * overpayment approval covering the excess is chosen (BR-053); its message is
 * shown verbatim. "Mark as completed" completes it right away so it counts toward
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
  overpaymentApprovals = [],
}: RecordPaymentModalProps) {
  const [form] = Form.useForm<PaymentFormValues>();
  const recordPayment = useRecordPayment();
  const amount = Form.useWatch('paymentAmount', form);
  const isOver = typeof amount === 'number' && amount > outstandingBalance;
  const excess = isOver ? Number((amount - outstandingBalance).toFixed(2)) : 0;
  const available = overpaymentApprovals.filter((a) => a.status === 'Available');

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
        overpaymentApprovalId: isOver ? values.overpaymentApprovalId : undefined,
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
        {isOver && available.length === 0 && (
          <Callout tone="warn" style={{ marginTop: -8, marginBottom: 16 }}>
            This is {formatMoney(excess)} more than the balance due ({formatMoney(outstandingBalance)}). Ask an
            Administrator to approve an overpayment on this reservation first.
          </Callout>
        )}
        {isOver && available.length > 0 && (
          <Form.Item
            name="overpaymentApprovalId"
            label={`Overpayment approval (${formatMoney(excess)} over the balance)`}
            dependencies={['paymentAmount']}
            rules={[
              { required: true, message: 'Choose the approval that covers this overpayment.' },
              ({ getFieldValue }) => ({
                validator: (_, id?: string) => {
                  const chosen = available.find((a) => a.approval_id === id);
                  const current = Number(getFieldValue('paymentAmount')) || 0;
                  const over = Number((current - outstandingBalance).toFixed(2));
                  return !chosen || over <= chosen.max_overpayment_amount
                    ? Promise.resolve()
                    : Promise.reject(new Error(`This approval covers up to ${formatMoney(chosen.max_overpayment_amount)} over.`));
                },
              }),
            ]}
            extra="The extra becomes a guest credit, which must be refunded before check-out."
          >
            <Select
              placeholder="Choose an approval"
              options={available.map((a) => ({
                value: a.approval_id,
                label: `Up to ${formatMoney(a.max_overpayment_amount)} · ${a.reason}`,
              }))}
            />
          </Form.Item>
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
