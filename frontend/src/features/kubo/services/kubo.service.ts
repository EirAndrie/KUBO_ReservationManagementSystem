import { apiClient } from '@/lib/api';
import type {
  Kubo,
  CreateKuboPayload,
  UpdateKuboPayload,
  KuboFilterParams,
  KuboStatus,
} from '../types/kubo.types';

function normalizeKuboStatus(val?: string): KuboStatus {
  const clean = (val || '').trim();
  if (clean === 'Occupied') return 'Occupied';
  if (clean === 'Reserved') return 'Reserved';
  if (clean === 'Cleaning') return 'Cleaning';
  if (clean === 'Maintenance') return 'Maintenance';
  if (clean === 'UnderInspection') return 'UnderInspection';
  if (clean === 'OutOfService') return 'OutOfService';
  return 'Available';
}

function mapKuboRecord(row: Record<string, unknown>): Kubo {
  return {
    kuboId: String(row.kuboId || row.kubo_id || row.id || ''),
    kuboNumber: String(row.kuboNumber || row.kubo_number || row.kuboRoomNumber || ''),
    kuboTypeId: String(row.kuboTypeId || row.kubo_type_id || ''),
    typeName: String(row.typeName || row.type_name || row.kubo_type_name || 'Standard'),
    capacity: Number(row.capacity || row.kubo_type_capacity || 2),
    pricePerNight: Number(row.pricePerNight ?? row.price_per_night ?? 0),
    status: normalizeKuboStatus(String(row.status || row.kubo_status || 'Available')),
  };
}

export const kuboService = {
  /**
   * Fetches all registered kubo cottages with optional status and search filters.
   */
  getAll: async (filters?: KuboFilterParams): Promise<Kubo[]> => {
    const params: Record<string, string | undefined> = {};
    if (filters?.status && filters.status !== 'All') {
      params.status = filters.status;
    }
    if (filters?.kuboTypeId) {
      params.kuboTypeId = filters.kuboTypeId;
    }
    if (filters?.search?.trim()) {
      params.search = filters.search.trim();
    }

    const res = await apiClient.get<Record<string, unknown>>('/kubos', { params });
    const raw = res as unknown as { kubos?: Record<string, unknown>[] } | Record<string, unknown>[];
    if (Array.isArray(raw)) return raw.map(mapKuboRecord);
    if (Array.isArray((raw as { kubos?: Record<string, unknown>[] })?.kubos)) {
      return (raw as { kubos: Record<string, unknown>[] }).kubos.map(mapKuboRecord);
    }
    throw new Error('The server returned an invalid Kubo list.');
  },

  /**
   * Retrieves single kubo cottage by ID.
   */
  getById: async (kuboId: string): Promise<Kubo> => {
    const res = await apiClient.get<Record<string, unknown>>(`/kubos/${kuboId}`);
    const raw = res as unknown as { kubos?: Record<string, unknown> } | Record<string, unknown>;
    const row = (raw as { kubos?: Record<string, unknown> })?.kubos || raw;
    if (!row || typeof row !== 'object' || Array.isArray(row)) {
      throw new Error('The server returned an invalid Kubo record.');
    }
    return mapKuboRecord(row as Record<string, unknown>);
  },

  /**
   * Registers a new physical kubo unit (BR-017).
   */
  create: async (payload: CreateKuboPayload): Promise<Kubo> => {
    const backendData = {
      kuboNumber: payload.kuboNumber.trim(),
      kuboTypeId: payload.kuboTypeId,
      status: payload.status || 'Available',
    };

    const res = await apiClient.post<Record<string, unknown>>('/kubos', backendData);
    const raw = res as unknown as { kubos?: Record<string, unknown> } | Record<string, unknown>;
    const row = (raw as { kubos?: Record<string, unknown> })?.kubos || raw;
    return mapKuboRecord(row as Record<string, unknown>);
  },

  /**
   * Updates cottage number or assigned type category.
   */
  update: async (kuboId: string, payload: UpdateKuboPayload): Promise<Kubo> => {
    const backendData = {
      kuboNumber: payload.kuboNumber?.trim(),
      kuboTypeId: payload.kuboTypeId,
    };

    const res = await apiClient.patch<Record<string, unknown>>(`/kubos/${kuboId}`, backendData);
    const raw = res as unknown as { kubos?: Record<string, unknown> } | Record<string, unknown>;
    const row = (raw as { kubos?: Record<string, unknown> })?.kubos || raw;
    return mapKuboRecord(row as Record<string, unknown>);
  },

  /**
   * Modifies physical cottage status (BR-021).
   */
  changeStatus: async (kuboId: string, status: KuboStatus): Promise<Kubo> => {
    const res = await apiClient.patch<Record<string, unknown>>(`/kubos/${kuboId}/status`, {
      status,
    });
    const raw = res as unknown as { kubos?: Record<string, unknown> } | Record<string, unknown>;
    const row = (raw as { kubos?: Record<string, unknown> })?.kubos || raw;
    return mapKuboRecord(row as Record<string, unknown>);
  },

  /**
   * Removes an unused kubo cottage from the database (BR-023).
   */
  delete: async (kuboId: string): Promise<void> => {
    await apiClient.delete(`/kubos/${kuboId}`);
  },
};
