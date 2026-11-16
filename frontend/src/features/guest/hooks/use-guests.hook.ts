import { useQuery } from '@tanstack/react-query';
import { guestService } from '../services/guest.service';
import type { GuestFilterParams } from '../types/guest.types';

/**
 * Standardized Query Key Factory for Guests.
 */
export const guestKeys = {
  all: ['guests'] as const,
  lists: () => [...guestKeys.all, 'list'] as const,
  list: (params?: GuestFilterParams) => [...guestKeys.lists(), params] as const,
  details: () => [...guestKeys.all, 'detail'] as const,
  detail: (id: string) => [...guestKeys.details(), id] as const,
  reservations: (id: string) => [...guestKeys.detail(id), 'reservations'] as const,
  stayStatsAll: () => [...guestKeys.all, 'stay-stats'] as const,
  stayStats: (ids: string[]) => [...guestKeys.stayStatsAll(), ids] as const,
};

/**
 * Server-computed stays, last stay, upcoming flag, Returning flag, and
 * reservation count for the guests on one list page. Always refetched when the
 * list mounts; reservation mutations also invalidate it (stays and delete
 * eligibility change with every booking).
 */
export function useGuestStayStats(guestIds: string[]) {
  return useQuery({
    queryKey: guestKeys.stayStats(guestIds),
    queryFn: () => guestService.getStayStats(guestIds),
    enabled: guestIds.length > 0,
    placeholderData: (previousData) => previousData,
    staleTime: 0,
  });
}

/**
 * Hook to retrieve a list of guests matching search and ID-type filters.
 */
export function useGuests(params?: GuestFilterParams) {
  return useQuery({
    queryKey: guestKeys.list(params),
    queryFn: () => guestService.getAll(params),
    placeholderData: (previousData) => previousData,
    staleTime: 1000 * 60 * 3, // 3 minutes
  });
}

/**
 * Hook to retrieve a single guest's comprehensive details by UUID.
 */
export function useGuest(guestId?: string) {
  return useQuery({
    queryKey: guestKeys.detail(guestId ?? ''),
    queryFn: () => guestService.getById(guestId!),
    enabled: Boolean(guestId),
  });
}

/**
 * Hook to retrieve the historical and active reservations for a given guest.
 */
export function useGuestReservations(guestId?: string) {
  return useQuery({
    queryKey: guestKeys.reservations(guestId ?? ''),
    queryFn: () => guestService.getReservations(guestId!),
    enabled: Boolean(guestId),
  });
}
