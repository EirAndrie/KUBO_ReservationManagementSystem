export const CHARGE_TYPES = [
  'ExtraBed',
  'ExtraPerson',
  'LateCheckOut',
  'EarlyCheckIn',
  'RoomService',
  'FoodAndBeverage',
  'Laundry',
  'CleaningFee',
  'Damage',
  'LostKey',
  'LostItem',
  'Transportation',
  'Minibar',
  'Other',
] as const;

export type ChargeType = (typeof CHARGE_TYPES)[number];

/** The catalog row returned by the backend, including usage needed to guard deletion. */
export interface AdditionalChargeCatalogItem {
  catalog_id: string;
  charge_type: ChargeType;
  name: string;
  description: string | null;
  unit_price: string;
  is_active: boolean;
  usage_count: string | number;
  applied_total: string;
  created_at: string;
  updated_at: string;
}

/** Request fields accepted by the catalog create and update endpoints. */
export interface AdditionalChargeCatalogPayload {
  chargeType?: ChargeType;
  name?: string;
  description?: string | null;
  unitPrice?: number;
  isActive?: boolean;
}
