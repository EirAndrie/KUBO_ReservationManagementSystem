import React from 'react';
import { Button, Typography } from 'antd';
import {
  PlusOutlined,
  AppstoreOutlined,
  TeamOutlined,
  LineChartOutlined,
  SafetyCertificateOutlined,
} from '@ant-design/icons';
import type { KuboType } from '../types/kubo-type.types';
import styles from './kubo-type-hero-summary.module.css';

const { Title, Paragraph } = Typography;

export interface KuboTypeHeroSummaryProps {
  /** Array of all available KuboType records */
  kuboTypes: KuboType[];
  /** Handler invoked when clicking the primary action button */
  onCreateClick: () => void;
}

/**
 * Visual lead hero banner for the Kubo Types & Rates management dashboard.
 *
 * Implements the "One Thing Leads" design doctrine:
 * - Dominant visual focal point with a high-contrast display heading (>= 2.5x body text).
 * - Immediate high-level metrics summarizing category capacity and rates.
 * - Prominent call-to-action button directing the primary task flow.
 * - Strict adherence to the Zero Emoji policy with official Ant Design icons.
 */
export const KuboTypeHeroSummary: React.FC<KuboTypeHeroSummaryProps> = ({
  kuboTypes,
  onCreateClick,
}) => {
  const totalCategories = kuboTypes.length;

  const maxCapacity =
    totalCategories > 0
      ? Math.max(...kuboTypes.map((k) => k.capacity))
      : 0;

  const avgPrice =
    totalCategories > 0
      ? kuboTypes.reduce((acc, k) => acc + (Number(k.price_per_night) || 0), 0) / totalCategories
      : 0;

  const minPrice =
    totalCategories > 0
      ? Math.min(...kuboTypes.map((k) => Number(k.price_per_night) || 0))
      : 0;

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(val);

  return (
    <section className={styles.heroContainer} aria-label="Kubo Categories Overview">
      <div className={styles.heroContent}>
        <div className={styles.headingGroup}>
          <span className={styles.eyebrow}>
            <SafetyCertificateOutlined aria-hidden="true" />
            <span>Resort Configuration & Rate Schedules</span>
          </span>
          <Title level={1} className={styles.title}>
            Kubo Types & Nightly Rates
          </Title>
          <Paragraph className={styles.subtitle}>
            Manage accommodation categories, guest capacity boundaries, and nightly pricing structures.
            Rate modifications establish the baseline for future reservations while honoring existing booking snapshots (BR-020).
          </Paragraph>
        </div>

        <div className={styles.actionWrapper}>
          <Button
            type="primary"
            icon={<PlusOutlined aria-hidden="true" />}
            size="large"
            className={styles.createButton}
            onClick={onCreateClick}
            aria-label="Create new kubo category"
          >
            New Kubo Type
          </Button>
        </div>
      </div>

      <div className={styles.metricsGrid}>
        <div className={styles.metricCard}>
          <span className={styles.metricLabel}>
            <AppstoreOutlined aria-hidden="true" />
            <span>Active Categories</span>
          </span>
          <span className={styles.metricValue}>{totalCategories}</span>
          <span className={styles.metricSubtext}>Defined tier classifications</span>
        </div>

        <div className={styles.metricCard}>
          <span className={styles.metricLabel}>
            <TeamOutlined aria-hidden="true" />
            <span>Peak Unit Capacity</span>
          </span>
          <span className={styles.metricValue}>
            {maxCapacity > 0 ? `${maxCapacity} Guests` : '0 Guests'}
          </span>
          <span className={styles.metricSubtext}>Largest accommodation limit</span>
        </div>

        <div className={styles.metricCard}>
          <span className={styles.metricLabel}>
            <LineChartOutlined aria-hidden="true" />
            <span>Average Nightly Rate</span>
          </span>
          <span className={styles.metricValue}>
            {totalCategories > 0 ? formatCurrency(avgPrice) : '₱0'}
          </span>
          <span className={styles.metricSubtext}>Across all active categories</span>
        </div>

        <div className={styles.metricCard}>
          <span className={styles.metricLabel}>
            <SafetyCertificateOutlined aria-hidden="true" />
            <span>Starting Rate</span>
          </span>
          <span className={styles.metricValue}>
            {totalCategories > 0 ? formatCurrency(minPrice) : '₱0'}
          </span>
          <span className={styles.metricSubtext}>Base entry pricing tier</span>
        </div>
      </div>
    </section>
  );
};
