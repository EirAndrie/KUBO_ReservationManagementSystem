import React from 'react';
import { useSearchParams } from 'react-router-dom';
import { Button } from 'antd';
import { LeftOutlined, RightOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { PageHeader, Section } from '@/components/common';
import { FrontDeskQueue, type QueueTab } from '../components/front-desk-queue.component';
import styles from './check-in-out.module.css';

/**
 * Arrivals & departures for a chosen date (‹ Today ›). Tab and date live in
 * the URL; changing the date refetches the queue.
 */
export const CheckInOutPage: React.FC = () => {
  const [params, setParams] = useSearchParams();
  const today = dayjs().format('YYYY-MM-DD');
  const date = params.get('date') || today;
  const tab = (params.get('tab') as QueueTab) || 'arrivals';
  const isToday = date === today;

  const set = (patch: Record<string, string | undefined>) => {
    const next = new URLSearchParams(params);
    Object.entries(patch).forEach(([k, v]) => (v ? next.set(k, v) : next.delete(k)));
    setParams(next, { replace: true });
  };
  const shift = (days: number) => {
    const next = dayjs(date).add(days, 'day').format('YYYY-MM-DD');
    set({ date: next === today ? undefined : next });
  };

  return (
    <div>
      <PageHeader
        title="Arrivals & departures"
        description={isToday ? dayjs(date).format('dddd, MMMM D') : `Viewing ${dayjs(date).format('dddd, MMMM D')}`}
        action={
          <div className={styles.stepper} role="group" aria-label="Choose date">
            <Button icon={<LeftOutlined />} aria-label="Previous day" onClick={() => shift(-1)} />
            <Button onClick={() => set({ date: undefined })} disabled={isToday}>
              Today
            </Button>
            <Button icon={<RightOutlined />} aria-label="Next day" onClick={() => shift(1)} />
          </div>
        }
      />
      <Section flush>
        <FrontDeskQueue date={date} tab={tab} onTabChange={(t) => set({ tab: t === 'arrivals' ? undefined : t })} />
      </Section>
    </div>
  );
};
