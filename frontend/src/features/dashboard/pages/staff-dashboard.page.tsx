import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import {
  CreditCardOutlined,
  FileAddOutlined,
  HomeOutlined,
  LoginOutlined,
  LogoutOutlined,
  RightOutlined,
  UserAddOutlined,
} from '@ant-design/icons';
import { useAuth } from '@/features/auth';
import { FrontDeskQueue, useCheckInOutQueue, type QueueTab } from '@/features/check-in-out';
import { useKubos } from '@/features/kubo';
import type { Kubo } from '@/features/kubo';
import { GuestForm, useCreateGuest } from '@/features/guest';
import type { CreateGuestDTO } from '@/features/guest';
import { AddChargeModal, RecordPaymentModal } from '@/features/payment';
import { ReservationPickerModal, useReservationCount } from '@/features/reservation';
import type { Reservation } from '@/features/reservation';
import { KpiStrip, ResortBanner, Section, StatusBadge } from '@/components/common';
import { formatMoney, pluralize, toAmount } from '@/lib/format';
import { resortTime, resortToday } from '@/lib/time';
import styles from './staff-dashboard.module.css';

type QuickAction = 'payment' | 'guest' | 'charge';

const KUBO_TILE_TONE: Record<string, string> = {
  Available: styles.tileGreen,
  Reserved: styles.tileBlue,
  Occupied: styles.tileViolet,
  Cleaning: styles.tileAmber,
  UnderInspection: styles.tileAmber,
  Maintenance: styles.tileRed,
  OutOfService: styles.tileGray,
};

function greeting(): string {
  const h = resortTime(new Date()).hour();
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
}

/** True when a key press comes from a field where the user is typing. */
function isTypingTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el) return false;
  return el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName);
}

/**
 * Staff "Today": the front desk lands on today's arrivals, departures and
 * in-house guests, with Check in in the row, kubo readiness next to each
 * arrival, a kubo status mini-board, and quick actions (P, G, C).
 */
export const StaffDashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  // The resort's date (Asia/Manila), whatever the browser's time zone.
  const today = resortToday();
  const [tab, setTab] = useState<QueueTab>('arrivals');
  const queue = useCheckInOutQueue(today);
  const kubos = useKubos();
  // The list's `total`, so the count is not capped at one 100-row page.
  const inHouseReservations = useReservationCount({ status: 'CheckedIn' });
  const createGuest = useCreateGuest();

  const [action, setAction] = useState<QuickAction | null>(null);
  const [target, setTarget] = useState<Reservation | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || isTypingTarget(e.target)) return;
      if (document.querySelector('.ant-modal-wrap:not([style*="display: none"]), .ant-drawer-open')) return;
      const key = e.key.toLowerCase();
      if (key === 'p') setAction('payment');
      else if (key === 'g') setAction('guest');
      else if (key === 'c') setAction('charge');
      else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const activeReservations = useMemo(() => {
    const seen = new Map<string, Reservation>();
    (queue.data ?? []).forEach((r) => seen.set(r.reservation_id, r));
    return [...seen.values()];
  }, [queue.data]);

  const kuboList = useMemo(
    () => [...(kubos.data ?? [])].sort((a, b) => a.kuboNumber.localeCompare(b.kuboNumber, undefined, { numeric: true })),
    [kubos.data],
  );
  const readyCount = kuboList.filter((k) => k.status === 'Available').length;
  const cleaningCount = kuboList.filter((k) => k.status === 'Cleaning').length;
  const checkedInToday = queue.inHouse.filter(
    (h) => h.assignment.actual_check_in_datetime && resortTime(h.assignment.actual_check_in_datetime).format('YYYY-MM-DD') === today,
  ).length;
  const departureBalance = queue.departures.reduce((sum, d) => sum + d.outstandingBalance, 0);
  const inHouseCount = inHouseReservations.data ?? 0;

  const legend = ['Available', 'Occupied', 'Reserved', 'Cleaning'];

  const closeAction = () => {
    setAction(null);
    setTarget(null);
  };

  return (
    <div>
      <ResortBanner
        title={`Today, ${dayjs(today).format('MMMM D')}`}
        description={`${greeting()}, ${user?.firstName ?? 'there'}. ${pluralize(queue.arrivals.length, 'guest')} arriving, ${queue.departures.length} departing.`}
      />

      <KpiStrip
        loading={queue.isLoading || inHouseReservations.isLoading}
        items={[
          {
            icon: <LoginOutlined />,
            label: 'Arrivals',
            value: queue.arrivals.length,
            hint: `${checkedInToday} checked in · ${queue.arrivals.length} expected`,
            to: '/check-in-out',
          },
          {
            icon: <LogoutOutlined />,
            label: 'Departures',
            value: queue.departures.length,
            hint: `${formatMoney(departureBalance)} balance left to settle`,
            to: '/check-in-out',
          },
          {
            icon: <HomeOutlined />,
            label: 'In-house',
            value: inHouseCount,
            hint: `${pluralize(inHouseCount, 'reservation')} staying tonight`,
            to: '/reservations?tab=inhouse',
          },
          {
            icon: <HomeOutlined />,
            label: 'Ready kubos',
            value: (
              <>
                {readyCount}
                <span className={styles.ofTotal}> / {kuboList.length}</span>
              </>
            ),
            hint: `${cleaningCount} being cleaned`,
            to: '/kubos?status=Available',
          },
        ]}
      />

      <div className={styles.grid}>
        <Section flush className={styles.queueCard}>
          <FrontDeskQueue
            date={today}
            tab={tab}
            onTabChange={setTab}
            tabBarExtra={
              <Link to="/check-in-out" className={styles.linkMuted}>
                Open desk <RightOutlined />
              </Link>
            }
          />
        </Section>

        <div className={styles.side}>
          <Section
            title="Kubo status"
            extra={
              <Link to="/kubos" className={styles.linkMuted}>
                All kubos <RightOutlined />
              </Link>
            }
          >
            <div className={styles.board}>
              {kuboList.map((k: Kubo) => (
                <button
                  type="button"
                  key={k.kuboId}
                  className={`${styles.tile} ${KUBO_TILE_TONE[k.status] ?? styles.tileGray}`}
                  title={`${k.kuboNumber} · ${k.typeName} · ${k.status}`}
                  aria-label={`${k.kuboNumber}, ${k.status}. Open in kubos`}
                  onClick={() => navigate(`/kubos?search=${encodeURIComponent(k.kuboNumber)}`)}
                >
                  {k.kuboNumber.replace(/^K-?/i, '')}
                </button>
              ))}
            </div>
            <div className={styles.legend}>
              {legend.map((s) => (
                <StatusBadge key={s} status={s} />
              ))}
            </div>
          </Section>

          <Section title="Quick actions">
            <div className={styles.quick}>
              <button type="button" className={styles.quickItem} onClick={() => setAction('payment')}>
                <CreditCardOutlined /> Record a payment <kbd>P</kbd>
              </button>
              <button type="button" className={styles.quickItem} onClick={() => setAction('guest')}>
                <UserAddOutlined /> Register a guest <kbd>G</kbd>
              </button>
              <button type="button" className={styles.quickItem} onClick={() => setAction('charge')}>
                <FileAddOutlined /> Add a charge <kbd>C</kbd>
              </button>
            </div>
          </Section>
        </div>
      </div>

      <ReservationPickerModal
        open={(action === 'payment' || action === 'charge') && !target}
        title={action === 'payment' ? 'Record a payment' : 'Add a charge'}
        reservations={activeReservations}
        onCancel={closeAction}
        onPick={setTarget}
      />
      {target && action === 'payment' && (
        <RecordPaymentModal
          open
          onClose={closeAction}
          reservationId={target.reservation_id}
          referenceCode={target.reference_code}
          outstandingBalance={toAmount(target.outstanding_balance)}
          netPaid={toAmount(target.net_paid)}
          defaultAmount={toAmount(target.outstanding_balance)}
        />
      )}
      {target && action === 'charge' && <AddChargeModal open onClose={closeAction} reservationId={target.reservation_id} />}
      <GuestForm
        open={action === 'guest'}
        isLoading={createGuest.isPending}
        onCancel={closeAction}
        onSubmit={async (values) => {
          await createGuest.mutateAsync(values as CreateGuestDTO);
          closeAction();
        }}
      />
    </div>
  );
};
