import React, { useState } from 'react';
import { App, Button, Form, Input, InputNumber, Modal } from 'antd';
import { SafetyCertificateOutlined } from '@ant-design/icons';
import { Section, StatusBadge, TwoLine } from '@/components/common';
import { formatDateTime, formatMoney } from '@/lib/format';
import { useOverpaymentApprovals } from '../hooks/use-payments.hook';
import { useCreateOverpaymentApproval, useRevokeOverpaymentApproval } from '../hooks/use-payment-mutations.hook';
import type { OverpaymentApproval } from '../types/payment.types';

export interface OverpaymentApprovalsSectionProps {
  reservationId: string;
  /** Administrator on an open reservation: may approve and revoke. */
  canManage: boolean;
}

interface ApprovalFormValues {
  maxOverpaymentAmount: number;
  reason: string;
}

const STATUS_TEXT: Record<OverpaymentApproval['status'], string> = {
  Available: 'Available',
  Used: 'Used',
  Revoked: 'Revoked',
};

function describe(approval: OverpaymentApproval): string {
  const by = `Approved by ${approval.approved_by_name} · ${formatDateTime(approval.created_at)}`;
  if (approval.status === 'Revoked' && approval.revoked_by_name) {
    return `${by} · revoked by ${approval.revoked_by_name}`;
  }
  return by;
}

/**
 * BR-053 overpayment approvals for one reservation. An Administrator records
 * an approval (maximum excess + reason); Staff then pick it when recording a
 * payment above the balance (BR-005: the Administrator never records the
 * payment). Unused approvals can be revoked. Hidden for Staff when there are
 * no approvals.
 */
export const OverpaymentApprovalsSection: React.FC<OverpaymentApprovalsSectionProps> = ({ reservationId, canManage }) => {
  const { modal } = App.useApp();
  const approvals = useOverpaymentApprovals(reservationId);
  const create = useCreateOverpaymentApproval();
  const revoke = useRevokeOverpaymentApproval();
  const [open, setOpen] = useState(false);
  const [form] = Form.useForm<ApprovalFormValues>();

  const list = approvals.data ?? [];
  if (!canManage && list.length === 0) return null;

  const submit = async () => {
    const values = await form.validateFields();
    try {
      await create.mutateAsync({
        reservationId,
        maxOverpaymentAmount: values.maxOverpaymentAmount,
        reason: values.reason.trim(),
      });
      setOpen(false);
    } catch {
      // Server message shown by the mutation toast; keep the form open.
    }
  };

  const confirmRevoke = (approval: OverpaymentApproval) => {
    modal.confirm({
      title: 'Revoke this overpayment approval?',
      content: `Staff will no longer be able to record a payment up to ${formatMoney(approval.max_overpayment_amount)} over the balance with it.`,
      okText: 'Revoke approval',
      okButtonProps: { danger: true },
      onOk: () => revoke.mutateAsync(approval.approval_id),
    });
  };

  return (
    <Section
      title="Overpayment approvals"
      flush
      extra={
        canManage ? (
          <Button size="small" icon={<SafetyCertificateOutlined />} onClick={() => setOpen(true)}>
            Approve overpayment
          </Button>
        ) : null
      }
    >
      {list.length === 0 ? (
        <p className="muted" style={{ margin: 0, padding: '12px 16px' }}>
          {approvals.isLoading
            ? 'Loading…'
            : 'No approvals. Payments above the balance due are blocked until you approve one.'}
        </p>
      ) : (
        <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          {list.map((approval) => (
            <li
              key={approval.approval_id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '10px 16px',
                borderTop: '1px solid var(--color-border)',
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <TwoLine primary={`Up to ${formatMoney(approval.max_overpayment_amount)} over · ${approval.reason}`} secondary={describe(approval)} />
              </div>
              <StatusBadge status={approval.status === 'Available' ? 'Available' : 'Inactive'} text={STATUS_TEXT[approval.status]} />
              {canManage && approval.status === 'Available' && (
                <Button size="small" onClick={() => confirmRevoke(approval)}>
                  Revoke
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}

      <Modal
        open={open}
        title="Approve an overpayment"
        okText="Approve overpayment"
        onOk={submit}
        onCancel={() => setOpen(false)}
        okButtonProps={{ loading: create.isPending }}
        cancelButtonProps={{ disabled: create.isPending }}
        afterOpenChange={(visible) => !visible && form.resetFields()}
        destroyOnHidden
      >
        <p className="muted" style={{ marginTop: 0 }}>
          Lets Staff record one payment that exceeds the balance due by up to this amount. The extra becomes a guest
          credit, which must be refunded before check-out. Staff record the payment; this only authorizes it.
        </p>
        <Form form={form} layout="vertical" requiredMark={false}>
          <Form.Item
            name="maxOverpaymentAmount"
            label="Maximum amount over the balance"
            rules={[
              { required: true, message: 'Enter the maximum overpayment.' },
              { type: 'number', min: 0.01, message: 'Amount must be greater than zero.' },
            ]}
          >
            <InputNumber<number> style={{ width: '100%' }} step={0.01} precision={2} prefix="₱" />
          </Form.Item>
          <Form.Item
            name="reason"
            label="Reason"
            rules={[{ required: true, whitespace: true, message: 'A reason is required.' }]}
            style={{ marginBottom: 0 }}
          >
            <Input.TextArea rows={2} maxLength={255} placeholder="e.g. Guest paid by bank transfer before the final bill" />
          </Form.Item>
        </Form>
      </Modal>
    </Section>
  );
};
