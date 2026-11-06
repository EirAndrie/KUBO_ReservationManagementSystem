import React, { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Button, Input, Segmented } from 'antd';
import { CloseOutlined, DownloadOutlined, HistoryOutlined, SearchOutlined } from '@ant-design/icons';
import { useEmployees } from '@/features/employee';
import {
  Avatar,
  EmptyState,
  ErrorState,
  FilterChip,
  ListSkeleton,
  PageHeader,
  Section,
  StatusBadge,
} from '@/components/common';
import { humanize } from '@/lib/format';
import { resortTime } from '@/lib/time';
import { useAuditHistory, useAuditLogs } from '../hooks/use-audit-logs.hook';
import type { AuditAction, AuditLog } from '../types/audit-log.types';
import { AUDIT_ACTIONS } from '../types/audit-log.types';
import {
  ACTION_BADGE,
  describe,
  diffValues,
  entityLabel,
  formatValue,
  recordName,
  refundOriginal,
} from '../utils/audit-log.utils';
import styles from './audit-log-list.module.css';

type Range = 'today' | '7d' | '30d' | 'all';

const ENTITY_TYPES = [
  'reservation',
  'reserved_kubo',
  'payment',
  'additional_charge',
  'additional_charge_request',
  'additional_charge_catalog',
  'guest',
  'kubo',
  'kubo_type',
  'employee',
  'role',
];

function rangeStart(range: Range): string | undefined {
  const now = resortTime(new Date());
  if (range === 'today') return now.startOf('day').toISOString();
  if (range === '7d') return now.subtract(7, 'day').startOf('day').toISOString();
  if (range === '30d') return now.subtract(30, 'day').startOf('day').toISOString();
  return undefined;
}

function exportCsv(rows: AuditLog[], nameOf: (id: string) => string) {
  const header = ['Time (Asia/Manila)', 'Employee', 'Action', 'Record type', 'Record ID', 'Description'];
  const lines = rows.map((r) =>
    [resortTime(r.dateTime).format('YYYY-MM-DD HH:mm:ss'), nameOf(r.employeeId), r.action, r.entityType, r.entityId, r.description]
      .map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`)
      .join(','),
  );
  const blob = new Blob([[header.join(','), ...lines].join('\n')], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `audit-log-${resortTime(new Date()).format('YYYYMMDD')}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

/** Before/after table for one entry; handles create/delete (null side) and nested JSON. */
const DiffTable: React.FC<{ log: AuditLog }> = ({ log }) => {
  const rows = diffValues(log.oldValues, log.newValues);
  if (rows.length === 0) return <p className="muted">No field values were recorded for this event.</p>;
  return (
    <table className={styles.diff}>
      <thead>
        <tr>
          <th>Field</th>
          <th>Before</th>
          <th>After</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.field}>
            <td className="mono">{r.field}</td>
            <td>{log.oldValues ? <span className={styles.before}>{formatValue(r.before)}</span> : <span className="muted">—</span>}</td>
            <td>{log.newValues ? <span className={styles.after}>{formatValue(r.after)}</span> : <span className="muted">—</span>}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
};

/**
 * Audit log (Administrator, read-only). Events are readable sentences grouped
 * by resort-local day. Selecting one opens a panel with a field-level diff and
 * the record's full history. There are no edit or delete controls (R-10).
 */
export const AuditLogListPage: React.FC = () => {
  const [params, setParams] = useSearchParams();
  const action = (params.get('action') as AuditAction) || undefined;
  const entityType = params.get('type') || undefined;
  const employeeId = params.get('employee') || undefined;
  const range = (params.get('range') as Range) || '7d';
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<AuditLog | null>(null);
  const [showHistory, setShowHistory] = useState(false);

  const set = (patch: Record<string, string | undefined>) => {
    const next = new URLSearchParams(params);
    Object.entries(patch).forEach(([k, v]) => (v ? next.set(k, v) : next.delete(k)));
    setParams(next, { replace: true });
  };

  const createdFrom = useMemo(() => rangeStart(range), [range]);
  const logs = useAuditLogs({ action, entityType, employeeId, createdFrom, limit: 100 });
  const employees = useEmployees();
  const history = useAuditHistory(showHistory ? selected?.entityType : undefined, showHistory ? selected?.entityId : undefined);

  const nameOf = useMemo(() => {
    const map = new Map((employees.data ?? []).map((e) => [e.employeeId, e.fullName]));
    return (id: string) => map.get(id) ?? 'Unknown employee';
  }, [employees.data]);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    const data = logs.data ?? [];
    if (!q) return data;
    return data.filter((l) =>
      [l.description, nameOf(l.employeeId), l.entityType, recordName(l) ?? '', l.action].some((v) => v.toLowerCase().includes(q)),
    );
  }, [logs.data, search, nameOf]);

  const groups = useMemo(() => {
    const today = resortTime(new Date()).format('YYYY-MM-DD');
    const yesterday = resortTime(new Date()).subtract(1, 'day').format('YYYY-MM-DD');
    const map = new Map<string, AuditLog[]>();
    rows.forEach((l) => {
      const key = resortTime(l.dateTime).format('YYYY-MM-DD');
      map.set(key, [...(map.get(key) ?? []), l]);
    });
    return [...map.entries()].map(([key, items]) => {
      const d = resortTime(items[0].dateTime);
      const prefix = key === today ? 'Today · ' : key === yesterday ? 'Yesterday · ' : '';
      return { key, label: `${prefix}${d.format('dddd, MMM D')}`, items };
    });
  }, [rows]);

  const select = (l: AuditLog) => {
    setSelected(l);
    setShowHistory(false);
  };

  const renderSentence = (l: AuditLog) => {
    const s = describe(l, nameOf(l.employeeId));
    return (
      <>
        <strong>{s.actor}</strong> {s.verb} {s.object && <strong>{s.object}</strong>}
        {s.detail && <span className="muted"> · {s.detail}</span>}
      </>
    );
  };

  const original = selected ? refundOriginal(selected) : null;

  return (
    <div>
      <PageHeader
        title="Audit log"
        description="A permanent, read-only record of every change. Entries can't be edited or deleted."
        action={
          <Button icon={<DownloadOutlined />} disabled={rows.length === 0} onClick={() => exportCsv(rows, nameOf)}>
            Export CSV
          </Button>
        }
      />

      <div className={styles.toolbar}>
        <Input
          allowClear
          prefix={<SearchOutlined className="muted" />}
          placeholder="Search activity"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ width: 240 }}
          aria-label="Search activity"
        />
        <FilterChip<string>
          name="Employee"
          value={employeeId}
          options={(employees.data ?? []).map((e) => ({ value: e.employeeId, label: e.fullName }))}
          onChange={(v) => set({ employee: v })}
        />
        <FilterChip<AuditAction>
          name="Action"
          value={action}
          options={AUDIT_ACTIONS.map((a) => ({ value: a, label: ACTION_BADGE[a].text }))}
          onChange={(v) => set({ action: v })}
        />
        <FilterChip<string>
          name="Record type"
          value={entityType}
          options={ENTITY_TYPES.map((t) => ({ value: t, label: humanize(entityLabel(t)) }))}
          onChange={(v) => set({ type: v })}
        />
        <Segmented<Range>
          size="small"
          value={range}
          onChange={(v) => set({ range: v === '7d' ? undefined : v })}
          options={[
            { label: 'Today', value: 'today' },
            { label: 'Last 7 days', value: '7d' },
            { label: 'Last 30 days', value: '30d' },
            { label: 'All', value: 'all' },
          ]}
        />
      </div>

      <div className={`${styles.layout} ${selected ? styles.withPanel : ''}`}>
        <Section flush>
          {logs.isLoading ? (
            <ListSkeleton rows={10} />
          ) : logs.isError ? (
            <ErrorState error={logs.error} onRetry={() => logs.refetch()} />
          ) : groups.length === 0 ? (
            <EmptyState title="No activity matches" description="Try a wider date range or clear the filters." />
          ) : (
            groups.map((g) => (
              <div key={g.key}>
                <div className={styles.dayHeader}>{g.label}</div>
                <ul className={styles.list}>
                  {g.items.map((l) => {
                    const badge = ACTION_BADGE[l.action] ?? { text: l.action, tone: 'gray' as const };
                    return (
                      <li key={l.auditLogId}>
                        <button
                          type="button"
                          className={`${styles.row} ${selected?.auditLogId === l.auditLogId ? styles.rowActive : ''}`}
                          onClick={() => select(l)}
                          aria-pressed={selected?.auditLogId === l.auditLogId}
                        >
                          <span className={`${styles.time} tabular`}>{resortTime(l.dateTime).format('h:mm A')}</span>
                          <Avatar name={nameOf(l.employeeId)} size={24} />
                          <span className={styles.sentence}>{renderSentence(l)}</span>
                          <StatusBadge status={l.action} text={badge.text} tone={badge.tone} />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))
          )}
          {logs.data && logs.data.length >= 100 && (
            <div className={styles.more}>Showing the latest 100 events. Narrow the filters to see older ones.</div>
          )}
        </Section>

        {selected && (
          <Section className={styles.panel}>
            <div className={styles.panelHead}>
              <div>
                <div className={styles.panelTitle}>
                  {ACTION_BADGE[selected.action]?.text ?? selected.action} {entityLabel(selected.entityType)}
                </div>
                <div className="muted">
                  {resortTime(selected.dateTime).format('MMM D, YYYY · h:mm A')} · {nameOf(selected.employeeId)}
                </div>
              </div>
              <Button type="text" size="small" icon={<CloseOutlined />} aria-label="Close details" onClick={() => setSelected(null)} />
            </div>

            <dl className={styles.dl}>
              <dt>Record</dt>
              <dd>
                {humanize(entityLabel(selected.entityType))}
                {recordName(selected) ? ` · ${recordName(selected)}` : ''}
              </dd>
              <dt>Record ID</dt>
              <dd className="mono">{selected.entityId}</dd>
              {original && (
                <>
                  <dt>Original payment</dt>
                  <dd className="mono">{original}</dd>
                </>
              )}
              <dt>Description</dt>
              <dd>{selected.description || '—'}</dd>
            </dl>

            {!showHistory ? (
              <>
                <div className={styles.panelSection}>Changes</div>
                <DiffTable log={selected} />
                <Button size="small" icon={<HistoryOutlined />} style={{ marginTop: 12 }} onClick={() => setShowHistory(true)}>
                  Full history of this {entityLabel(selected.entityType)}
                </Button>
              </>
            ) : (
              <>
                <div className={styles.panelSection}>
                  Full history <Button type="link" size="small" onClick={() => setShowHistory(false)}>Back to changes</Button>
                </div>
                {history.isLoading ? (
                  <ListSkeleton rows={4} />
                ) : history.isError ? (
                  <ErrorState error={history.error} onRetry={() => history.refetch()} />
                ) : (
                  <ul className={styles.historyList}>
                    {(history.data ?? []).map((h) => (
                      <li key={h.auditLogId}>
                        <span className="tabular muted">{resortTime(h.dateTime).format('MMM D, h:mm A')}</span>
                        <span>{renderSentence(h)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
          </Section>
        )}
      </div>
    </div>
  );
};
