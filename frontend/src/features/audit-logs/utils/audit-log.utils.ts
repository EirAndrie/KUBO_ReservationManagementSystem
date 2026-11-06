import { formatMoney, humanize } from '@/lib/format';
import type { AuditAction, AuditLog } from '../types/audit-log.types';

const VERBS: Record<AuditAction, string> = {
  Create: 'created',
  Update: 'updated',
  Delete: 'deleted',
  Login: 'signed in',
  Logout: 'signed out',
  Cancel: 'cancelled',
  Approve: 'approved',
  Reject: 'rejected',
};

/** Badge text per action ("Signed in", "Created", …). */
export const ACTION_BADGE: Record<AuditAction, { text: string; tone: 'green' | 'blue' | 'red' | 'violet' | 'gray' | 'amber' }> = {
  Create: { text: 'Created', tone: 'green' },
  Update: { text: 'Updated', tone: 'blue' },
  Delete: { text: 'Deleted', tone: 'red' },
  Login: { text: 'Signed in', tone: 'gray' },
  Logout: { text: 'Signed out', tone: 'gray' },
  Cancel: { text: 'Cancelled', tone: 'red' },
  Approve: { text: 'Approved', tone: 'violet' },
  Reject: { text: 'Rejected', tone: 'amber' },
};

/** `additional_charge_request` → `charge request`. */
export function entityLabel(entityType: string): string {
  const map: Record<string, string> = {
    employee: 'employee',
    additional_charge: 'additional charge',
    additional_charge_request: 'charge request',
    additional_charge_catalog: 'price list item',
    reserved_kubo: 'kubo assignment',
    kubo_type: 'kubo type',
  };
  return map[entityType] ?? humanize(entityType).toLowerCase();
}

const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

/** A short human name for the record, taken from its values when available. */
export function recordName(log: AuditLog): string | null {
  const v = log.newValues ?? log.oldValues ?? {};
  const pick = (k: string) => (typeof v[k] === 'string' || typeof v[k] === 'number' ? String(v[k]) : null);
  if (v.payment_amount != null) return formatMoney(v.payment_amount);
  if (v.reference_code) return pick('reference_code');
  if (v.kubo_number) return pick('kubo_number');
  if (v.type_name) return pick('type_name');
  if (v.first_name || v.last_name) return `${pick('first_name') ?? ''} ${pick('last_name') ?? ''}`.trim();
  if (v.name) return pick('name');
  if (v.description && log.entityType.includes('charge')) return pick('description');
  if (v.role_name) return pick('role_name');
  return null;
}

/** "Maria Santos approved charge request · Bonfire setup". */
export function describe(log: AuditLog, actor: string): { actor: string; verb: string; object: string; detail: string | null } {
  if (log.action === 'Login' || log.action === 'Logout') {
    return { actor, verb: VERBS[log.action], object: '', detail: null };
  }
  const name = recordName(log);
  const status = statusChange(log);
  const detail = [name, status].filter(Boolean).join(' · ') || (UUID_RE.test(log.description) ? null : log.description) || null;
  return { actor, verb: VERBS[log.action] ?? log.action.toLowerCase(), object: entityLabel(log.entityType), detail };
}

/** `Pending → Completed` when the status field changed. */
export function statusChange(log: AuditLog): string | null {
  const before = log.oldValues?.status ?? log.oldValues?.payment_status;
  const after = log.newValues?.status ?? log.newValues?.payment_status;
  if (before && after && before !== after) return `${humanize(String(before))} → ${humanize(String(after))}`;
  return null;
}

/** The original payment a refund was recorded against (from the description). */
export function refundOriginal(log: AuditLog): string | null {
  if (!/refund/i.test(log.description)) return null;
  const m = log.description.match(/against payment ([0-9a-f-]{36})/i);
  return m ? m[1] : null;
}

export interface DiffRow {
  field: string;
  before: unknown;
  after: unknown;
}

const HIDDEN_FIELDS = new Set(['password_hash', 'passwordHash']);

/**
 * Field-level before/after. Handles create (no old values), delete (no new
 * values) and nested objects, which are compared and shown as JSON.
 */
export function diffValues(oldValues: Record<string, unknown> | null, newValues: Record<string, unknown> | null): DiffRow[] {
  const keys = new Set([...Object.keys(oldValues ?? {}), ...Object.keys(newValues ?? {})]);
  const rows: DiffRow[] = [];
  keys.forEach((field) => {
    if (HIDDEN_FIELDS.has(field)) return;
    const before = oldValues ? oldValues[field] : undefined;
    const after = newValues ? newValues[field] : undefined;
    if (oldValues && newValues && JSON.stringify(before) === JSON.stringify(after)) return;
    rows.push({ field, before, after });
  });
  return rows;
}

export function formatValue(value: unknown): string {
  if (value === undefined) return '';
  if (value === null) return 'null';
  if (typeof value === 'object') return JSON.stringify(value, null, 1);
  return String(value);
}
