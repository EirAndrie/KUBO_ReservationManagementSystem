import { apiClient } from '@/lib/api';
import type { AuditLog, AuditLogFilterParams, AuditAction } from '../types/audit-log.types';

function normalizeAction(val?: string): AuditAction {
  const lower = (val || '').toLowerCase();
  if (lower.includes('login')) return 'login';
  if (lower.includes('logout')) return 'logout';
  if (lower.includes('cancel')) return 'cancel';
  if (lower.includes('approve')) return 'approve';
  if (lower.includes('reject')) return 'reject';
  if (lower.includes('del')) return 'delete';
  if (lower.includes('upd')) return 'update';
  return 'create';
}

function mapAuditRecord(row: Record<string, unknown>): AuditLog {
  return {
    auditLogId: String(row.audit_log_id || row.auditLogId || row.id || ''),
    employeeId: String(row.employee_id || row.employeeId || ''),
    employeeName: row.employee_name ? String(row.employee_name) : row.username ? String(row.username) : undefined,
    action: normalizeAction(String(row.audit_action || row.action || 'create')),
    entityType: row.entity_type ? String(row.entity_type) : row.entityType ? String(row.entityType) : undefined,
    entityId: String(row.entity_id || row.entityId || ''),
    description: String(row.audit_description || row.description || ''),
    oldValues: (row.old_values || row.oldValues || null) as Record<string, unknown> | null,
    newValues: (row.new_values || row.newValues || null) as Record<string, unknown> | null,
    dateTime: String(row.date_time || row.dateTime || row.created_at || new Date().toISOString()),
  };
}

// Initial verifiable audit trail (BR-067)
export const auditLogService = {
  /**
   * Retrieves system audit activity logs (BR-078).
   */
  getAll: async (filters?: AuditLogFilterParams): Promise<AuditLog[]> => {
    const params: Record<string, string | number | undefined> = {};
    if (filters?.action) params.action = filters.action;
    if (filters?.entityType) params.entityType = filters.entityType;
    if (filters?.employeeId) params.employeeId = filters.employeeId;
    if (filters?.createdFrom) params.createdFrom = filters.createdFrom;
    if (filters?.createdTo) params.createdTo = filters.createdTo;
    if (filters?.search?.trim()) params.search = filters.search.trim();
    if (filters?.limit) params.limit = filters.limit;
    if (filters?.offset) params.offset = filters.offset;

    const res = await apiClient.get<Record<string, unknown>>('/audit-logs', { params });
    const raw = res as unknown as { auditLogs?: Record<string, unknown>[] } | Record<string, unknown>[];
    if (Array.isArray(raw)) return raw.map(mapAuditRecord);
    if (Array.isArray((raw as { auditLogs?: Record<string, unknown>[] })?.auditLogs)) {
      return (raw as { auditLogs: Record<string, unknown>[] }).auditLogs.map(mapAuditRecord);
    }
    throw new Error('The server returned an invalid audit log list.');
  },

  /**
   * Retrieves single audit log entry by ID with full details.
   */
  getById: async (auditId: string): Promise<AuditLog> => {
    const res = await apiClient.get<Record<string, unknown>>(`/audit-logs/${auditId}`);
    const raw = res as unknown as { auditLogs?: Record<string, unknown> } | Record<string, unknown>;
    const row = (raw as { auditLogs?: Record<string, unknown> })?.auditLogs || raw;
    if (!row || typeof row !== 'object' || Array.isArray(row)) {
      throw new Error('The server returned an invalid audit log record.');
    }
    return mapAuditRecord(row as Record<string, unknown>);
  },
};
