import React, { useEffect } from 'react';
import { Modal, Form, InputNumber, Select, Alert, Button } from 'antd';
import { CreditCardOutlined, DollarOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { useAuth } from '@/features/auth';
import type { Reservation } from '@/features/reservation';
import { useRecordFinalPayment } from '../hooks/use-check-in-out-mutations.hook';
import { PAYMENT_METHOD_OPTIONS } from '../constants/check-in-out.constants';
import type { RecordPaymentPayload } from '../types/check-in-out.types';
import styles from './record-payment-modal.module.css';

export interface RecordPaymentModalProps {
  reservation: Reservation | null;
  open: boolean;
  onCancel: () => void;
  onSuccess?: () => void;
}

interface FormValues {
  amount: number;
  paymentMethod: RecordPaymentPayload['paymentMethod'];
}

export const RecordPaymentModal: React.FC<RecordPaymentModalProps> = ({
  reservation,
  open,
  onCancel,
  onSuccess,
}) => {
  const [form] = Form.useForm<FormValues>();
  const recordPaymentMutation = useRecordFinalPayment();
  const { user } = useAuth();

  useEffect(() => {
    if (open && reservation) {
      const bal = Number(reservation.outstanding_balance) || 0;
      form.setFieldsValue({
        amount: bal > 0 ? bal : 0,
        paymentMethod: 'cash',
      });
    }
  }, [open, reservation, form]);

  if (!reservation) return null;

  const currentBalance = Number(reservation.outstanding_balance) || 0;

  const handleFinish = async (values: FormValues) => {
    if (!user?.employeeId) return;

    const payload: RecordPaymentPayload = {
      reservationId: reservation.reservation_id,
      employeeId: user.employeeId,
      paymentAmount: Number(values.amount),
      transactionType: 'payment',
      paymentType: 'balance',
      paymentMethod: values.paymentMethod,
      paymentStatus: 'completed',
      paymentDate: dayjs().toISOString(),
    };

    await recordPaymentMutation.mutateAsync(payload);
    form.resetFields();
    onCancel();
    onSuccess?.();
  };

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP',
      minimumFractionDigits: 2,
    }).format(val);

  return (
    <Modal
      open={open}
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#0c4a6e', fontSize: '1.15rem' }}>
          <CreditCardOutlined style={{ color: '#0284c7' }} aria-hidden="true" />
          <span>Record Final Payment — {reservation.reference_code}</span>
        </div>
      }
      onCancel={onCancel}
      footer={null}
      destroyOnClose
    >
      <Alert
        className={styles.amountAlert}
        type="warning"
        showIcon
        message={`Outstanding Balance: ${formatCurrency(currentBalance)}`}
        description="Settle the outstanding balance before completing check-out."
      />

      <Form form={form} layout="vertical" onFinish={handleFinish}>
        <Form.Item
          name="amount"
          label="Payment Settlement Amount"
          rules={[
            { required: true, message: 'Payment amount is required.' },
            {
              type: 'number',
              min: 0.01,
              message: 'Amount must be greater than zero.',
            },
          ]}
        >
          <InputNumber<number>
            className={styles.currencyInput}
            prefix={<DollarOutlined style={{ color: '#94a3b8' }} aria-hidden="true" />}
            min={0.01}
            precision={2}
            formatter={(val) => (val ? `₱ ${val}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',') : '₱ ')}
            parser={(val) => (val ? Number(val.replace(/₱\s?|(,*)/g, '')) : 0)}
          />
        </Form.Item>

        <div className={styles.formGrid}>
          <Form.Item
            name="paymentMethod"
            label="Payment Method"
            rules={[{ required: true, message: 'Please select a payment method.' }]}
          >
            <Select options={PAYMENT_METHOD_OPTIONS.map((option) => ({ ...option }))} />
          </Form.Item>

          <Form.Item label="Received By">
            <span>{user?.fullName ?? 'Signed-in employee'}</span>
          </Form.Item>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 16 }}>
          <Button onClick={onCancel} disabled={recordPaymentMutation.isPending}>
            Cancel
          </Button>
          <Button
            type="primary"
            htmlType="submit"
            loading={recordPaymentMutation.isPending}
            disabled={!user?.employeeId}
            style={{ background: '#16a34a', borderColor: '#16a34a', fontWeight: 600 }}
          >
            Record Final Payment
          </Button>
        </div>
      </Form>
    </Modal>
  );
};
