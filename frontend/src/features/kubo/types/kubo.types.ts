/**
 * Domain types and DTO contracts for the Kubo Cottage Inventory module.
 * Strictly adheres to Business Rules BR-017, BR-021, and BR-023.
 */

export const KUBO_STATUSES = [
  'Available',
  'Reserved',
  'Occupied',
  'Cleaning',
  'Maintenance',
  'UnderInspection',
  'OutOfService',
] as const;

export type KuboStatus = (typeof KUBO_STATUSES)[number];

export interface Kubo {
  kuboId: string;
  kuboNumber: string;
  kuboTypeId: string;
  typeName: string;
  capacity: number;
  pricePerNight: number;
  status: KuboStatus;
}

export interface CreateKuboPayload {
  kuboNumber: string;
  kuboTypeId: string;
  status?: KuboStatus;
}

export interface UpdateKuboPayload {
  kuboNumber?: string;
  kuboTypeId?: string;
}

export interface ChangeKuboStatusPayload {
  status: KuboStatus;
}

export interface KuboFilterParams {
  search?: string;
  kuboTypeId?: string;
  status?: KuboStatus | 'All';
}
