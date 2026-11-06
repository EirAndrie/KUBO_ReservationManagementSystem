import { apiClient } from '@/lib/api';
import type { AuditAction, AuditLog, AuditLogFilterParams } from '../types/audit-log.types';
import { AUDIT_ACTIONS } from '../types/audit-log.types';

type Row = Record<string, unknown>;

function toObject(value: unknown): Record<string, unknown> | null {
  if (value == null) return null;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : null;
    } catch {
      return null;
    }
  }
  return typeof value === 'object' ? (value as Record<string, unknown>) : null;
}

function mapAuditRecord(row: Row): AuditLog {
  const rawAction = String(row.action ?? row.audit_action ?? '');
  const action = (AUDIT_ACTIONS.find((a) => a.toLowerCase() === rawAction.toLowerCase()) ?? rawAction) as AuditAction;
  return {
    auditLogId: String(row.audit_id ?? row.audit_log_id ?? row.id ?? ''),
    employeeId: String(row.employee_id ?? ''),
    action,
    entityType: String(row.entity_type ?? ''),
    entityId: String(row.entity_id ?? ''),
    description: String(row.description ?? row.audit_description ?? ''),
    oldValues: toObject(row.old_values),
    newValues: toObject(row.new_values),
    dateTime: String(row.created_at ?? row.date_time ?? ''),
  };
}

function listOf(res: unknown): Row[] {
  if (Array.isArray(res)) return res as Row[];
  const rows = (res as { auditLogs?: unknown } | null)?.auditLogs;
  if (Array.isArray(rows)) return rows as Row[];
  throw new Error('The server returned an invalid audit log list.');
}

/** Read-only access to the append-only audit log (Administrator only). */
export const auditLogService = {
  getAll: async (filters?: AuditLogFilterParams): Promise<AuditLog[]> => {
    const params: Record<string, string | number> = {};
    if (filters?.action) params.action = filters.action;
    if (filters?.entityType) params.entityType = filters.entityType;
    if (filters?.employeeId) params.employeeId = filters.employeeId;
    if (filters?.createdFrom) params.createdFrom = filters.createdFrom;
    if (filters?.createdTo) params.createdTo = filters.createdTo;
    params.limit = filters?.limit ?? 100;
    if (filters?.offset) params.offset = filters.offset;
    const res = await apiClient.get('/audit-logs', { params });
    return listOf(res).map(mapAuditRecord);
  },

  getById: async (auditId: string): Promise<AuditLog> => {
    const res = await apiClient.get(`/audit-logs/${auditId}`);
    const row = ((res as { auditLogs?: Row } | null)?.auditLogs ?? res) as Row;
    return mapAuditRecord(row);
  },

  /** Every entry for one record, newest first (`get_audit_history`). */
  getHistory: async (entityType: string, entityId: string): Promise<AuditLog[]> => {
    const res = await apiClient.get(`/audit-logs/history/${entityType}/${entityId}`, { params: { limit: 100 } });
    return listOf(res).map(mapAuditRecord);
  },
};
