/**
 * Domain types and Data Transfer Objects for the Kubo Type feature module.
 * Strictly aligned with backend schemas (kubo-type.schema.ts).
 */

export interface KuboType {
  kubo_type_id: string;
  type_name: string;
  capacity: number;
  price_per_night: number | string;
  description: string | null;
}

export interface KuboTypeFilterParams {
  search?: string;
  minCapacity?: number;
  maxCapacity?: number;
  limit?: number;
  offset?: number;
}

export interface CreateKuboTypeDTO {
  kuboTypeName: string;
  kuboTypeCapacity: number;
  pricePerNight: number;
  kuboTypeDescription?: string;
}

export interface UpdateKuboTypeDTO {
  kuboTypeName?: string;
  kuboTypeCapacity?: number;
  pricePerNight?: number;
  kuboTypeDescription?: string;
}

export interface KuboTypesApiResponse {
  success: boolean;
  count: number;
  message: string;
  kuboTypes: KuboType[];
}

export interface SingleKuboTypeApiResponse {
  success: boolean;
  message: string;
  kuboTypes: KuboType;
}
