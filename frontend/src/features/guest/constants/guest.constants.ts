import type { ValidIdType } from '../types/guest.types';

/**
 * Philippine contact number regex:
 * Accepts local format: 09XXXXXXXXX (11 digits)
 * Accepts international format: +639XXXXXXXXX (13 characters)
 */
export const PHILIPPINE_PHONE_REGEX = /^(09\d{9}|\+639\d{9})$/;

export const EMAIL_REGEX = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;

export const GUEST_LIMITS = {
  MAX_FIRST_NAME: 100,
  MAX_LAST_NAME: 100,
  MAX_EMAIL: 100,
  MAX_ID_NUMBER: 50,
  MAX_ADDRESS: 200,
  MAX_CITY: 100,
  MAX_STATE: 100,
  MAX_ZIP: 20,
  MAX_COUNTRY: 100,
} as const;

export const ID_TYPE_OPTIONS: Array<{ label: string; value: ValidIdType }> = [
  { label: 'Philippine Passport', value: 'Passport' },
  { label: "Driver's License (LTO)", value: 'DriverLicense' },
  { label: 'Philippine National ID (PhilSys)', value: 'NationalID' },
  { label: 'PhilHealth ID', value: 'PhilHealthID' },
  { label: 'SSS ID (Social Security System)', value: 'SSSID' },
  { label: 'UMID (Unified Multi-Purpose ID)', value: 'UMID' },
  { label: 'Postal ID', value: 'PostalID' },
  { label: 'PRC ID (Professional Regulation)', value: 'PRCID' },
  { label: "Voter's ID (COMELEC)", value: 'VotersID' },
  { label: 'Senior Citizen ID', value: 'SeniorCitizenID' },
  { label: 'Student ID (DepEd / CHED)', value: 'StudentID' },
  { label: 'Other Government / Company ID', value: 'Other' },
];

export const ID_TYPE_LABEL_MAP: Record<ValidIdType, string> = {
  Passport: 'Philippine Passport',
  DriverLicense: "Driver's License",
  NationalID: 'National ID (PhilSys)',
  PhilHealthID: 'PhilHealth ID',
  SSSID: 'SSS ID',
  UMID: 'UMID',
  PostalID: 'Postal ID',
  PRCID: 'PRC ID',
  VotersID: "Voter's ID",
  SeniorCitizenID: 'Senior Citizen ID',
  StudentID: 'Student ID',
  Other: 'Other Valid ID',
};

export const GUEST_POLICIES = {
  REUSE_NOTICE:
    'If a guest with this email or ID already exists, that profile is reused instead of creating a duplicate.',
  CANNOT_DELETE_WITH_RESERVATIONS:
    'Guests with reservations can’t be deleted, so booking and payment records stay complete.',
} as const;
