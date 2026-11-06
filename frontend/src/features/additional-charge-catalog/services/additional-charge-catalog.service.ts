import { apiClient } from '@/lib/api';
import type {
  AdditionalChargeCatalogItem,
  AdditionalChargeCatalogPayload,
} from '../types/additional-charge-catalog.types';

interface CatalogListResponse {
  additionalChargeCatalog: AdditionalChargeCatalogItem[];
}

interface CatalogItemResponse {
  additionalChargeCatalog: AdditionalChargeCatalogItem;
}

/** Read and mutate the Administrator-managed additional-charge catalog. */
export const additionalChargeCatalogService = {
  async getAll(): Promise<AdditionalChargeCatalogItem[]> {
    const response = (await apiClient.get('/additional-charge-catalog', {
      params: { page: 1, limit: 100, activeOnly: false },
    })) as unknown as CatalogListResponse;
    return response.additionalChargeCatalog;
  },

  async create(
    payload: Required<Pick<AdditionalChargeCatalogPayload, 'chargeType' | 'name' | 'unitPrice' | 'isActive'>> &
      Pick<AdditionalChargeCatalogPayload, 'description'>,
  ): Promise<AdditionalChargeCatalogItem> {
    const response = (await apiClient.post('/additional-charge-catalog', payload)) as unknown as CatalogItemResponse;
    return response.additionalChargeCatalog;
  },

  async update(
    catalogId: string,
    payload: AdditionalChargeCatalogPayload,
  ): Promise<AdditionalChargeCatalogItem> {
    const response = (await apiClient.patch(
      `/additional-charge-catalog/${catalogId}`,
      payload,
    )) as unknown as CatalogItemResponse;
    return response.additionalChargeCatalog;
  },

  async delete(catalogId: string): Promise<void> {
    await apiClient.delete(`/additional-charge-catalog/${catalogId}`);
  },
};
