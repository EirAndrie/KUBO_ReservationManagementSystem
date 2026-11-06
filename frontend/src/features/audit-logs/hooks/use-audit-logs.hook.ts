import { useQuery } from '@tanstack/react-query';
import { auditLogService } from '../services/audit-log.service';
import type { AuditLog, AuditLogFilterParams } from '../types/audit-log.types';

export const auditLogKeys = {
  all: ['audit-logs'] as const,
  lists: () => [...auditLogKeys.all, 'list'] as const,
  list: (filters?: AuditLogFilterParams) => [...auditLogKeys.lists(), filters ?? {}] as const,
  detail: (id: string) => [...auditLogKeys.all, 'detail', id] as const,
  history: (entityType: string, entityId: string) => [...auditLogKeys.all, 'history', entityType, entityId] as const,
};

/** Audit log entries, newest first. */
export function useAuditLogs(filters?: AuditLogFilterParams, enabled = true) {
  return useQuery<AuditLog[], Error>({
    queryKey: auditLogKeys.list(filters),
    queryFn: () => auditLogService.getAll(filters),
    staleTime: 1000 * 30,
    enabled,
  });
}

/** A single audit entry with its before/after values. */
export function useAuditLog(auditId: string) {
  return useQuery<AuditLog, Error>({
    queryKey: auditLogKeys.detail(auditId),
    queryFn: () => auditLogService.getById(auditId),
    enabled: Boolean(auditId),
  });
}

/** Full history of one record (`/audit-logs/history/:entityType/:entityId`). */
export function useAuditHistory(entityType?: string, entityId?: string) {
  return useQuery<AuditLog[], Error>({
    queryKey: auditLogKeys.history(entityType ?? '', entityId ?? ''),
    queryFn: () => auditLogService.getHistory(entityType!, entityId!),
    enabled: Boolean(entityType && entityId),
  });
}
