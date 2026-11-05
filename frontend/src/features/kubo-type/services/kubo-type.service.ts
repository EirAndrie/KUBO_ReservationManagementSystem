import { apiClient } from '@/lib/api';
import type {
  KuboType,
  KuboTypeFilterParams,
  CreateKuboTypeDTO,
  UpdateKuboTypeDTO,
  KuboTypesApiResponse,
  SingleKuboTypeApiResponse,
} from '../types/kubo-type.types';

/**
 * Service handling HTTP requests for the Kubo Type and Rate management domain.
 * Strictly decoupled from React components; pure asynchronous functions.
 */
export const kuboTypeService = {
  /**
   * Fetches all kubo types with optional search and capacity filters.
   */
  getAll: async (params?: KuboTypeFilterParams): Promise<KuboType[]> => {
    const response = await apiClient.get<KuboTypesApiResponse>('/kubo-types', { params });
    const raw = response as unknown as KuboTypesApiResponse | KuboType[];
    if (Array.isArray(raw)) return raw;
    if (Array.isArray((raw as KuboTypesApiResponse)?.kuboTypes)) {
      return (raw as KuboTypesApiResponse).kuboTypes;
    }
    throw new Error('The server returned an invalid Kubo type list.');
  },

  /**
   * Fetches a single kubo type by its unique UUID.
   */
  getById: async (kuboTypeId: string): Promise<KuboType> => {
    const response = await apiClient.get<SingleKuboTypeApiResponse>(`/kubo-types/${kuboTypeId}`);
    const raw = response as unknown as SingleKuboTypeApiResponse | KuboType;
    if ((raw as SingleKuboTypeApiResponse)?.kuboTypes) {
      return (raw as SingleKuboTypeApiResponse).kuboTypes;
    }
    if (raw && typeof raw === 'object' && 'kubo_type_id' in raw) return raw as KuboType;
    throw new Error('The server returned an invalid Kubo type record.');
  },

  /**
   * Creates a new kubo type with initial capacity and nightly rate.
   */
  create: async (data: CreateKuboTypeDTO): Promise<KuboType> => {
    const response = await apiClient.post<SingleKuboTypeApiResponse>('/kubo-types', data);
    const raw = response as unknown as SingleKuboTypeApiResponse | KuboType;
    if ((raw as SingleKuboTypeApiResponse)?.kuboTypes) {
      return (raw as SingleKuboTypeApiResponse).kuboTypes;
    }
    return raw as KuboType;
  },

  /**
   * Updates an existing kubo type's name, capacity, rate, or description.
   */
  update: async (kuboTypeId: string, data: UpdateKuboTypeDTO): Promise<KuboType> => {
    const response = await apiClient.patch<SingleKuboTypeApiResponse>(`/kubo-types/${kuboTypeId}`, data);
    const raw = response as unknown as SingleKuboTypeApiResponse | KuboType;
    if ((raw as SingleKuboTypeApiResponse)?.kuboTypes) {
      return (raw as SingleKuboTypeApiResponse).kuboTypes;
    }
    return raw as KuboType;
  },

  /**
   * Deletes an unused kubo type. Will fail at database level if referenced by existing kubos.
   */
  delete: async (kuboTypeId: string): Promise<void> => {
    await apiClient.delete(`/kubo-types/${kuboTypeId}`);
  },
};
