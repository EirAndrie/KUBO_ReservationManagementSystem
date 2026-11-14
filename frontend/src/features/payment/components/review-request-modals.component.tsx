import React, { useState } from 'react';
import { Input, InputNumber, Modal } from 'antd';
import { useApproveChargeRequest, useRejectChargeRequest } from '../hooks/use-payment-mutations.hook';
import type { ChargeRequest } from '../types/payment.types';
import { Callout } from '@/components/common';
import { formatMoney } from '@/lib/format';

/**
 * Approve a custom charge request, optionally adjusting the unit amount.
 * An adjustment needs a reason (backend rule). Approval creates the applied charge.
 */
export const ApproveRequestModal: React.FC<{ request: ChargeRequest | null; onClose: () => void }> = ({ request, onClose }) => {
  const approve = useApproveChargeRequest();
  const [amount, setAmount] = useState<number | null>(null);
  const [reason, setReason] = useState('');
  const proposed = request?.proposed_unit_amount ?? 0;
  const unit = amount ?? proposed;
  const adjusted = request ? unit !== proposed : false;

  const submit = async () => {
    if (!request) return;
    try {
      await approve.mutateAsync({
        requestId: request.request_id,
        approvedUnitAmount: adjusted ? unit : undefined,
        reason: reason.trim() || undefined,
      });
      onClose();
    } catch {
      // Server message shown by the mutation toast.
    }
  };

  return (
    <Modal
      open={Boolean(request)}
      title="Review charge request"
      okText="Approve and bill"
      okButtonProps={{ loading: approve.isPending, disabled: adjusted && !reason.trim() }}
      cancelButtonProps={{ disabled: approve.isPending }}
      onOk={submit}
      onCancel={onClose}
      afterOpenChange={(open) => {
        if (!open) {
          setAmount(null);
          setReason('');
        }
      }}
      destroyOnHidden
    >
      {request && (
        <>
          <p style={{ marginTop: 0 }}>
            <strong>{request.description}</strong> for <span className="mono">{request.reference_code}</span> ({request.guest_name}),
            requested by {request.requested_by_name}.
          </p>
          <label htmlFor="approve-amount" style={{ display: 'block', fontWeight: 500, marginBottom: 6 }}>
            Unit price (quantity {request.quantity})
          </label>
          <InputNumber<number>
            id="approve-amount"
            style={{ width: '100%' }}
            prefix="₱"
            min={0}
            precision={2}
            value={unit}
            onChange={(v) => setAmount(v ?? 0)}
          />
          <p className="muted" style={{ margin: '6px 0 12px' }}>
            Total {formatMoney(unit * request.quantity)}
            {adjusted ? ` (proposed ${formatMoney(proposed * request.quantity)})` : ''}
          </p>
          <label htmlFor="approve-reason" style={{ display: 'block', fontWeight: 500, marginBottom: 6 }}>
            Reason {adjusted ? '' : <span className="muted">(optional)</span>}
          </label>
          <Input.TextArea id="approve-reason" rows={2} maxLength={255} value={reason} onChange={(e) => setReason(e.target.value)} />
          {adjusted && (
            <Callout tone="warn" style={{ marginTop: 12 }}>
              You changed the price, so a reason is required.
            </Callout>
          )}
        </>
      )}
    </Modal>
  );
};

/** Reject a custom charge request with a required reason. It is never billed. */
export const RejectRequestModal: React.FC<{ request: ChargeRequest | null; onClose: () => void }> = ({ request, onClose }) => {
  const reject = useRejectChargeRequest();
  const [reason, setReason] = useState('');

  const submit = async () => {
    if (!request || !reason.trim()) return;
    try {
      await reject.mutateAsync({ requestId: request.request_id, reason: reason.trim() });
      onClose();
    } catch {
      // Server message shown by the mutation toast.
    }
  };

  return (
    <Modal
      open={Boolean(request)}
      title="Reject charge request?"
      okText="Reject request"
      okButtonProps={{ danger: true, loading: reject.isPending, disabled: !reason.trim() }}
      cancelButtonProps={{ disabled: reject.isPending }}
      onOk={submit}
      onCancel={onClose}
      afterOpenChange={(open) => !open && setReason('')}
      destroyOnHidden
    >
      {request && (
        <p style={{ marginTop: 0 }}>
          {request.description} ({formatMoney(request.quantity * request.proposed_unit_amount)}) won't be billed to{' '}
          {request.guest_name}.
        </p>
      )}
      <label htmlFor="reject-reason" style={{ display: 'block', fontWeight: 500, marginBottom: 6 }}>
        Reason
      </label>
      <Input.TextArea id="reject-reason" rows={3} maxLength={255} value={reason} onChange={(e) => setReason(e.target.value)} />
    </Modal>
  );
};
