import { useEffect, useMemo } from 'react';
import { Modal, Form, InputNumber, Select } from 'antd';
import { useIssueRefund } from '../hooks/use-payment-mutations.hook';
import { PAYMENT_METHOD_OPTIONS } from '../constants/payment.constants';
import type { Payment, PaymentMethod } from '../types/payment.types';
import { formatDate, formatMoney, label } from '@/lib/format';
import { Callout } from '@/components/common';

export interface RefundModalProps {
  open: boolean;
  onClose: () => void;
  /** Payments of one reservation; only completed (or partly refunded) Payment rows can be refunded. */
  payments: Payment[];
  netPaid: number;
  /** Pre-selects the original payment. */
  originalPaymentId?: string;
}

interface RefundFormValues {
  originalPaymentId: string;
  paymentAmount: number;
  paymentMethod: PaymentMethod;
}

/**
 * Issues a refund against one completed payment. Refunds cannot exceed net
 * paid; the server enforces it and its message is shown verbatim. The original
 * becomes Refunded or Partially refunded.
 */
export function RefundModal({ open, onClose, payments, netPaid, originalPaymentId }: RefundModalProps) {
  const [form] = Form.useForm<RefundFormValues>();
  const refund = useIssueRefund();

  const refundable = useMemo(
    () =>
      payments.filter(
        (p) => p.transaction_type === 'Payment' && ['Completed', 'PartiallyRefunded'].includes(p.payment_status),
      ),
    [payments],
  );

  useEffect(() => {
    if (!open) return;
    form.resetFields();
    const original = refundable.find((p) => p.payment_id === originalPaymentId) ?? refundable[0];
    if (original) {
      form.setFieldsValue({ originalPaymentId: original.payment_id, paymentMethod: original.payment_method });
    }
  }, [open, form, refundable, originalPaymentId]);

  const handleSubmit = async () => {
    const values = await form.validateFields();
    const original = refundable.find((p) => p.payment_id === values.originalPaymentId);
    if (!original) return;
    try {
      await refund.mutateAsync({
        reservationId: original.reservation_id,
        originalPaymentId: original.payment_id,
        paymentAmount: values.paymentAmount,
        paymentType: original.payment_type,
        paymentMethod: values.paymentMethod,
      });
      onClose();
    } catch {
      // Server message shown by the mutation toast.
    }
  };

  return (
    <Modal
      title="Issue refund"
      open={open}
      onCancel={onClose}
      onOk={handleSubmit}
      okText="Issue refund"
      okButtonProps={{ loading: refund.isPending, disabled: refundable.length === 0, danger: true }}
      cancelButtonProps={{ disabled: refund.isPending }}
      destroyOnHidden
      width={480}
    >
      <Callout style={{ marginBottom: 16 }}>
        Refunds can't exceed what the guest has paid ({formatMoney(netPaid)}). The original payment is marked
        Refunded or Partially refunded.
      </Callout>
      {refundable.length === 0 ? (
        <p className="muted">There is no completed payment to refund on this reservation.</p>
      ) : (
        <Form form={form} layout="vertical" requiredMark={false}>
          <Form.Item name="originalPaymentId" label="Original payment" rules={[{ required: true }]}>
            <Select
              options={refundable.map((p) => ({
                value: p.payment_id,
                label: `${formatMoney(p.payment_amount)} · ${label(p.payment_method)} · ${formatDate(p.payment_date)}`,
              }))}
            />
          </Form.Item>
          <Form.Item
            name="paymentAmount"
            label="Refund amount"
            rules={[
              { required: true, message: 'Enter the refund amount.' },
              { type: 'number', min: 0.01, message: 'Amount must be greater than zero.' },
            ]}
          >
            <InputNumber<number> style={{ width: '100%' }} step={0.01} precision={2} prefix="₱" />
          </Form.Item>
          <Form.Item name="paymentMethod" label="Refund method" rules={[{ required: true }]} style={{ marginBottom: 0 }}>
            <Select options={PAYMENT_METHOD_OPTIONS} />
          </Form.Item>
        </Form>
      )}
    </Modal>
  );
}
