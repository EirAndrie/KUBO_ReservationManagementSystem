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
import { ReservationPickerModal } from '@/features/reservation';
import type { Reservation } from '@/features/reservation';
import { KpiStrip, PageHeader, Section, StatusBadge } from '@/components/common';
import { formatMoney, pluralize, toAmount } from '@/lib/format';
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
  const h = dayjs().hour();
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
  const today = dayjs().format('YYYY-MM-DD');
  const [tab, setTab] = useState<QueueTab>('arrivals');
  const queue = useCheckInOutQueue(today);
  const kubos = useKubos();
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
  const checkedInToday = queue.inHouse.filter((h) => dayjs(h.assignment.actual_check_in_datetime).isSame(dayjs(), 'day')).length;
  const departureBalance = queue.departures.reduce((sum, d) => sum + d.outstandingBalance, 0);
  const inHouseGuests = new Set(queue.inHouse.map((h) => h.reservation.reservation_id)).size;

  const legend = ['Available', 'Occupied', 'Reserved', 'Cleaning'];

  const closeAction = () => {
    setAction(null);
    setTarget(null);
  };

  return (
    <div>
      <PageHeader
        title={`Today, ${dayjs().format('MMMM D')}`}
        description={`${greeting()}, ${user?.firstName ?? 'there'}. ${pluralize(queue.arrivals.length, 'guest')} arriving, ${queue.departures.length} departing.`}
      />

      <KpiStrip
        loading={queue.isLoading}
        items={[
          {
            icon: <LoginOutlined />,
            label: 'Arrivals',
            value: queue.arrivals.length,
            hint: `${checkedInToday} checked in · ${queue.arrivals.length} expected`,
          },
          {
            icon: <LogoutOutlined />,
            label: 'Departures',
            value: queue.departures.length,
            hint: `${formatMoney(departureBalance)} balance left to settle`,
          },
          { icon: <HomeOutlined />, label: 'In-house', value: inHouseGuests, hint: 'Guests staying tonight' },
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
