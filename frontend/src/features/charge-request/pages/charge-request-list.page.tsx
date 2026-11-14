import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button, Table } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { EmptyState, ErrorState, FilterChip, ListSkeleton, PageHeader, Section, StatusBadge, TwoLine } from '@/components/common';
import { formatDateTime, formatMoney, pluralize } from '@/lib/format';
import {
  ApproveRequestModal,
  CHARGE_REQUEST_STATUSES,
  RejectRequestModal,
  useChargeRequests,
} from '@/features/payment';
import type { ChargeRequest, ChargeRequestStatus } from '@/features/payment';
import styles from './charge-request-list.module.css';

const STATUS_OPTIONS = CHARGE_REQUEST_STATUSES.map((value) => ({ value, label: value }));

/** Unit price the guest is (or would be) billed: approved if reviewed, else proposed. */
function unitPrice(request: ChargeRequest): number {
  return request.approved_unit_amount ?? request.proposed_unit_amount;
}

/**
 * Administrator review queue for custom ("Other") charge requests submitted by
 * Staff. Pending requests can be approved (optionally at an adjusted price,
 * which needs a reason) or rejected with a reason; approval bills the charge.
 * Reviewed, rejected, and withdrawn requests stay visible as history.
 */
export const ChargeRequestListPage: React.FC = () => {
  const [status, setStatus] = useState<ChargeRequestStatus | undefined>('Pending');
  const requests = useChargeRequests(status ? { status } : undefined);
  const [reviewing, setReviewing] = useState<ChargeRequest | null>(null);
  const [rejecting, setRejecting] = useState<ChargeRequest | null>(null);
  const rows = requests.data ?? [];

  const columns: ColumnsType<ChargeRequest> = [
    {
      title: 'Requested',
      width: 170,
      render: (_, r) => <TwoLine primary={formatDateTime(r.created_at)} secondary={`by ${r.requested_by_name}`} />,
    },
    {
      title: 'Reservation',
      width: 180,
      render: (_, r) => (
        <TwoLine
          primary={
            <Link to={`/reservations/${r.reservation_id}`} className="mono">
              {r.reference_code}
            </Link>
          }
          secondary={r.guest_name}
        />
      ),
    },
    {
      title: 'Charge',
      width: 260,
      render: (_, r) => (
        <TwoLine
          primary={r.description}
          secondary={
            r.approved_unit_amount != null && r.approved_unit_amount !== r.proposed_unit_amount
              ? `${r.quantity} × ${formatMoney(r.approved_unit_amount)} (proposed ${formatMoney(r.proposed_unit_amount)})`
              : `${r.quantity} × ${formatMoney(r.proposed_unit_amount)}`
          }
        />
      ),
    },
    {
      title: 'Total',
      align: 'right',
      width: 120,
      render: (_, r) => <span className="tabular">{formatMoney(r.quantity * unitPrice(r))}</span>,
    },
    {
      title: 'Status',
      width: 220,
      render: (_, r) =>
        r.status === 'Pending' ? (
          <StatusBadge status="Pending" />
        ) : (
          <div className={styles.reviewed}>
            <StatusBadge status={r.status} />
            {(r.reviewed_by_name || r.review_reason) && (
              <span className="muted">
                {r.reviewed_by_name ? `${r.reviewed_by_name}` : ''}
                {r.reviewed_by_name && r.review_reason ? ' · ' : ''}
                {r.review_reason ?? ''}
              </span>
            )}
          </div>
        ),
    },
  ];

  // The review actions column only appears while a pending request is listed.
  if (rows.some((r) => r.status === 'Pending')) {
    columns.push({
      key: 'actions',
      width: 170,
      align: 'right',
      render: (_, r) =>
        r.status === 'Pending' ? (
          <span className={styles.actions}>
            <Button size="small" onClick={() => setRejecting(r)}>
              Reject
            </Button>
            <Button size="small" type="primary" onClick={() => setReviewing(r)}>
              Review
            </Button>
          </span>
        ) : null,
    });
  }

  return (
    <div>
      <PageHeader
        title="Charge requests"
        description="Custom charges Staff asked to bill. Approve to add the charge to the guest's bill, or reject with a reason."
      />
      <div className={styles.toolbar}>
        <FilterChip<ChargeRequestStatus> name="Status" value={status} options={STATUS_OPTIONS} onChange={setStatus} />
        {requests.isSuccess && <span className="muted">{pluralize(rows.length, 'request')}</span>}
      </div>
      <Section flush>
        {requests.isLoading ? (
          <ListSkeleton rows={5} />
        ) : requests.isError ? (
          <ErrorState error={requests.error} onRetry={() => requests.refetch()} />
        ) : rows.length === 0 ? (
          <EmptyState
            title={status === 'Pending' ? 'No requests waiting for review.' : 'No charge requests match this filter.'}
            description="Staff submit custom charges from a reservation's Add charge dialog."
          />
        ) : (
          <Table<ChargeRequest>
            rowKey="request_id"
            columns={columns}
            dataSource={rows}
            pagination={rows.length > 20 ? { pageSize: 20, showSizeChanger: false } : false}
            size="middle"
            scroll={{ x: 'max-content' }}
          />
        )}
      </Section>
      <ApproveRequestModal request={reviewing} onClose={() => setReviewing(null)} />
      <RejectRequestModal request={rejecting} onClose={() => setRejecting(null)} />
    </div>
  );
};
