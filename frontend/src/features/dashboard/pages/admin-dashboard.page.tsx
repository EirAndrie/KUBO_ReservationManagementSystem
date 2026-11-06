import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button, Progress, Segmented } from 'antd';
import { FileTextOutlined, RightOutlined, ToolOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { useAuth } from '@/features/auth';
import { useKubos } from '@/features/kubo';
import { useKuboTypes } from '@/features/kubo-type';
import { useReservations } from '@/features/reservation';
import { useChargeRequests, usePayments } from '@/features/payment';
import type { ChargeRequest } from '@/features/payment';
import { useAuditLogs, describeAuditLog } from '@/features/audit-logs';
import { useEmployees } from '@/features/employee';
import { Avatar, EmptyState, ErrorState, KpiStrip, ListSkeleton, PageHeader, Section, TwoLine } from '@/components/common';
import { formatMoney, formatMoneyWhole, label, pluralize, toAmount } from '@/lib/format';
import { resortTime } from '@/lib/time';
import { ApproveRequestModal, RejectRequestModal } from '../components/review-request-modals.component';
import styles from './admin-dashboard.module.css';

type Period = 'today' | '7d' | '30d';

const PERIOD_LABEL: Record<Period, string> = { today: 'today', '7d': 'last 7 days', '30d': 'last 30 days' };

function periodStart(p: Period): string {
  const now = resortTime(new Date());
  return (p === 'today' ? now.startOf('day') : now.subtract(p === '7d' ? 7 : 30, 'day').startOf('day')).toISOString();
}

function greeting(): string {
  const h = dayjs().hour();
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
}

function relativeTime(iso: string): string {
  const mins = dayjs().diff(dayjs(iso), 'minute');
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return dayjs().diff(dayjs(iso), 'day') === 1 ? 'Yesterday' : resortTime(iso).format('MMM D');
}

/**
 * Administrator overview: business KPIs, a "needs your approval" queue
 * (pending charge requests and kubos in maintenance), occupancy by kubo type
 * derived from `/kubos`, and recent activity from the audit log.
 */
export const AdminDashboardPage: React.FC = () => {
  const { user } = useAuth();
  const [period, setPeriod] = useState<Period>('30d');
  const from = useMemo(() => periodStart(period), [period]);

  const kubos = useKubos();
  const kuboTypes = useKuboTypes();
  const requests = useChargeRequests({ status: 'Pending' });
  const confirmed = useReservations({ status: 'Confirmed', limit: 100 });
  const checkedIn = useReservations({ status: 'CheckedIn', limit: 100 });
  const pending = useReservations({ status: 'Pending', limit: 100 });
  const payments = usePayments({ createdFrom: from, limit: 100 });
  const activity = useAuditLogs({ limit: 50 });
  const employees = useEmployees();

  const [reviewing, setReviewing] = useState<ChargeRequest | null>(null);
  const [rejecting, setRejecting] = useState<ChargeRequest | null>(null);

  const kuboList = useMemo(() => kubos.data ?? [], [kubos.data]);
  const occupied = kuboList.filter((k) => k.status === 'Occupied').length;
  const occupancy = kuboList.length ? Math.round((occupied / kuboList.length) * 100) : 0;
  const maintenance = kuboList.filter((k) => ['Maintenance', 'OutOfService', 'UnderInspection'].includes(k.status));

  const active = [...(pending.data ?? []), ...(confirmed.data ?? []), ...(checkedIn.data ?? [])];
  const outstanding = active.reduce((sum, r) => sum + Math.max(0, toAmount(r.outstanding_balance)), 0);
  const withBalance = active.filter((r) => toAmount(r.outstanding_balance) > 0).length;

  // Revenue = completed payments minus completed refunds in the period.
  const revenue = (payments.data ?? []).reduce((sum, p) => {
    if (p.transaction_type === 'Payment' && ['Completed', 'PartiallyRefunded', 'Refunded'].includes(p.payment_status)) return sum + p.payment_amount;
    if (p.transaction_type === 'Refund' && p.payment_status === 'Completed') return sum - p.payment_amount;
    return sum;
  }, 0);

  const types = kuboTypes.data ?? [];
  const avgRate = types.length ? types.reduce((s, t) => s + toAmount(t.price_per_night), 0) / types.length : 0;

  const byType = useMemo(() => {
    const map = new Map<string, { name: string; total: number; occupied: number }>();
    kuboList.forEach((k) => {
      const row = map.get(k.kuboTypeId) ?? { name: k.typeName, total: 0, occupied: 0 };
      row.total += 1;
      if (k.status === 'Occupied') row.occupied += 1;
      map.set(k.kuboTypeId, row);
    });
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [kuboList]);

  const nameOf = useMemo(() => {
    const map = new Map((employees.data ?? []).map((e) => [e.employeeId, e.fullName]));
    return (id: string) => map.get(id) ?? 'Someone';
  }, [employees.data]);

  const approvalCount = (requests.data?.length ?? 0) + maintenance.length;
  // Sign-ins are noise on an overview; the full log keeps them.
  const recent = (activity.data ?? []).filter((l) => l.action !== 'Login' && l.action !== 'Logout').slice(0, 8);

  return (
    <div>
      <PageHeader
        title={`${greeting()}, ${user?.firstName ?? 'there'}`}
        description={`${dayjs().format('dddd, MMMM D')} · Here's what needs your attention.`}
        action={
          <Segmented<Period>
            value={period}
            onChange={setPeriod}
            options={[
              { label: 'Today', value: 'today' },
              { label: '7 days', value: '7d' },
              { label: '30 days', value: '30d' },
            ]}
          />
        }
      />

      <KpiStrip
        items={[
          {
            label: 'Occupancy tonight',
            value: kubos.isLoading ? '—' : `${occupancy}%`,
            hint: `${occupied} of ${kuboList.length} kubos`,
          },
          {
            label: `Revenue, ${PERIOD_LABEL[period]}`,
            value: payments.isLoading ? '—' : formatMoneyWhole(revenue),
            hint: 'Completed payments, less refunds',
          },
          {
            label: 'Outstanding balances',
            value: formatMoneyWhole(outstanding),
            hint: `Across ${pluralize(withBalance, 'active reservation')}`,
          },
          {
            label: 'Average nightly rate',
            value: formatMoneyWhole(avgRate),
            hint: pluralize(types.length, 'kubo type'),
          },
        ]}
      />

      <div className={styles.grid}>
        <div className={styles.mainCol}>
          <Section
            title="Needs your approval"
            flush
            extra={<span className={styles.countPill}>{pluralize(approvalCount, 'item')}</span>}
          >
            {requests.isLoading || kubos.isLoading ? (
              <ListSkeleton rows={3} />
            ) : requests.isError ? (
              <ErrorState error={requests.error} onRetry={() => requests.refetch()} />
            ) : approvalCount === 0 ? (
              <EmptyState title="Nothing needs your approval." description="New charge requests and blocked kubos show up here." />
            ) : (
              <ul className={styles.queue}>
                {(requests.data ?? []).map((r) => (
                  <li key={r.request_id} className={styles.queueRow}>
                    <span className={`${styles.queueIcon} ${styles.iconViolet}`} aria-hidden="true">
                      <FileTextOutlined />
                    </span>
                    <TwoLine
                      primary={
                        <>
                          Custom charge · {r.description} {formatMoney(r.quantity * r.proposed_unit_amount)}
                        </>
                      }
                      secondary={
                        <>
                          Requested by {r.requested_by_name} · <span className="mono">{r.reference_code}</span> · {relativeTime(r.created_at)}
                        </>
                      }
                    />
                    <span className={styles.queueActions}>
                      <Button size="small" onClick={() => setRejecting(r)}>
                        Reject
                      </Button>
                      <Button size="small" type="primary" onClick={() => setReviewing(r)}>
                        Review
                      </Button>
                    </span>
                  </li>
                ))}
                {maintenance.map((k) => (
                  <li key={k.kuboId} className={styles.queueRow}>
                    <span className={`${styles.queueIcon} ${styles.iconRed}`} aria-hidden="true">
                      <ToolOutlined />
                    </span>
                    <TwoLine primary={`${k.kuboNumber} is ${label(k.status).toLowerCase()}`} secondary={`${k.typeName} · not bookable`} />
                    <span className={styles.queueActions}>
                      <Link to={`/kubos?search=${encodeURIComponent(k.kuboNumber)}`}>
                        <Button size="small">Open kubo</Button>
                      </Link>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <Section title="Occupancy by kubo type" extra={<span className="muted">Tonight</span>}>
            {kubos.isLoading ? (
              <ListSkeleton rows={4} />
            ) : kubos.isError ? (
              <ErrorState error={kubos.error} onRetry={() => kubos.refetch()} />
            ) : byType.length === 0 ? (
              <EmptyState title="No kubos yet" />
            ) : (
              <div className={styles.bars}>
                {byType.map((t) => (
                  <div key={t.name}>
                    <div className={styles.barHead}>
                      <span>{t.name}</span>
                      <span className="muted tabular">
                        {t.occupied} / {t.total} occupied
                      </span>
                    </div>
                    <Progress
                      percent={t.total ? Math.round((t.occupied / t.total) * 100) : 0}
                      showInfo={false}
                      size="small"
                      aria-label={`${t.name}: ${t.occupied} of ${t.total} occupied`}
                    />
                  </div>
                ))}
              </div>
            )}
          </Section>
        </div>

        <Section
          title="Recent activity"
          flush
          extra={
            <Link to="/audit-logs" className={styles.linkMuted}>
              View audit log <RightOutlined />
            </Link>
          }
        >
          {activity.isLoading ? (
            <ListSkeleton rows={6} />
          ) : activity.isError ? (
            <ErrorState error={activity.error} onRetry={() => activity.refetch()} />
          ) : recent.length === 0 ? (
            <EmptyState title="No activity yet" />
          ) : (
            <ul className={styles.feed}>
              {recent.map((l) => {
                const s = describeAuditLog(l, nameOf(l.employeeId));
                return (
                  <li key={l.auditLogId} className={styles.feedRow}>
                    <Avatar name={s.actor} size={26} />
                    <div className={styles.feedText}>
                      <div>
                        <strong>{s.actor}</strong> {s.verb} {s.object}
                        {s.detail && <strong> {s.detail}</strong>}
                      </div>
                      <div className="muted">{relativeTime(l.dateTime)}</div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Section>
      </div>

      <ApproveRequestModal request={reviewing} onClose={() => setReviewing(null)} />
      <RejectRequestModal request={rejecting} onClose={() => setRejecting(null)} />
    </div>
  );
};
