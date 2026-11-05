import { useQuery } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { checkInOutService } from '../services/check-in-out.service';
import type { ArrivalRecord, DepartureRecord } from '../types/check-in-out.types';

export const checkInOutKeys = {
  all: ['check-in-out'] as const,
  operationalQueue: () => [...checkInOutKeys.all, 'queue'] as const,
};

/**
 * Hook to retrieve operational reservations and structure them into
 * Arrivals and Departures queues based on the chosen target date.
 */
export function useCheckInOutQueue(targetDate: string = dayjs().format('YYYY-MM-DD')) {
  const query = useQuery({
    queryKey: checkInOutKeys.operationalQueue(),
    queryFn: () => checkInOutService.getActiveReservations(),
    staleTime: 1000 * 30, // 30 seconds for live operational queue
    refetchInterval: 1000 * 60, // auto-refresh every minute
  });

  const reservations = query.data ?? [];
  const target = dayjs(targetDate).startOf('day');

  // Derive Arrivals:
  // Eligible reservations: 'Confirmed' (or 'CheckedIn' if partial kubos remaining)
  // Assignments: status is 'Reserved'
  const arrivals: ArrivalRecord[] = [];
  reservations.forEach((res) => {
    if (['Confirmed', 'CheckedIn'].includes(res.status)) {
      (res.assignments || []).forEach((assignment) => {
        if (assignment.status === 'Reserved') {
          const checkInDate = dayjs(assignment.check_in_date).startOf('day');
          const isEarly = target.isBefore(checkInDate);
          const canCheckIn = !isEarly || Boolean(assignment.early_check_in_approved);

          arrivals.push({
            reservation: res,
            assignment,
            isEarly,
            canCheckIn,
          });
        }
      });
    }
  });

  // Derive Departures:
  // Eligible reservations: 'CheckedIn'
  // Assignments: status is 'CheckedIn'
  const departures: DepartureRecord[] = [];
  reservations.forEach((res) => {
    if (res.status === 'CheckedIn') {
      const balance = Number(res.outstanding_balance) || 0;
      const isSettled = balance <= 0;

      (res.assignments || []).forEach((assignment) => {
        const checkOutDate = dayjs(assignment.check_out_date).startOf('day');
        const isDueToCheckOut = checkOutDate.isSame(target) || checkOutDate.isBefore(target);
        if (assignment.status === 'CheckedIn' && isDueToCheckOut) {
          departures.push({
            reservation: res,
            assignment,
            outstandingBalance: balance,
            isSettled,
            canCheckOut: isSettled,
          });
        }
      });
    }
  });

  return {
    ...query,
    arrivals,
    departures,
  };
}
