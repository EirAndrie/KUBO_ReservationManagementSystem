import { useQuery } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { checkInOutService } from '../services/check-in-out.service';
import type { ArrivalRecord, DepartureRecord, InHouseRecord } from '../types/check-in-out.types';

export const checkInOutKeys = {
  all: ['check-in-out'] as const,
  operationalQueue: () => [...checkInOutKeys.all, 'queue'] as const,
  queueForDate: (date: string) => [...checkInOutKeys.operationalQueue(), date] as const,
};

/**
 * Front-desk queues for one operational date, derived from Confirmed and
 * CheckedIn reservations:
 * - Arrivals: assignments still `Reserved` whose check-in date is on or before
 *   the target date. Checking in before the assignment's check-in date (i.e.
 *   when it is later than today) is an early check-in and needs approval.
 * - Departures: `CheckedIn` assignments due out on or before the target date.
 * - In-house: every `CheckedIn` assignment.
 *
 * The date is part of the query key, so changing it refetches.
 */
export function useCheckInOutQueue(
  targetDate: string = dayjs().format('YYYY-MM-DD'),
  options: { enabled?: boolean } = {},
) {
  const query = useQuery({
    queryKey: checkInOutKeys.queueForDate(targetDate),
    queryFn: () => checkInOutService.getActiveReservations(),
    staleTime: 1000 * 30,
    refetchInterval: 1000 * 60,
    enabled: options.enabled ?? true,
  });

  const reservations = query.data ?? [];
  const target = dayjs(targetDate).startOf('day');
  const today = dayjs().startOf('day');

  const arrivals: ArrivalRecord[] = [];
  const departures: DepartureRecord[] = [];
  const inHouse: InHouseRecord[] = [];

  reservations.forEach((res) => {
    const balance = Number(res.outstanding_balance) || 0;
    (res.assignments || []).forEach((assignment) => {
      const checkIn = dayjs(assignment.check_in_date).startOf('day');
      const checkOut = dayjs(assignment.check_out_date).startOf('day');

      if (
        ['Confirmed', 'CheckedIn'].includes(res.status) &&
        assignment.status === 'Reserved' &&
        !checkIn.isAfter(target)
      ) {
        const isEarly = checkIn.isAfter(today);
        arrivals.push({
          reservation: res,
          assignment,
          isEarly,
          canCheckIn: res.status !== 'Pending' && (!isEarly || Boolean(assignment.early_check_in_approved)),
        });
      }

      if (res.status === 'CheckedIn' && assignment.status === 'CheckedIn') {
        inHouse.push({ reservation: res, assignment, outstandingBalance: balance });
        if (!checkOut.isAfter(target)) {
          departures.push({
            reservation: res,
            assignment,
            outstandingBalance: balance,
            isSettled: balance <= 0,
            canCheckOut: balance <= 0,
          });
        }
      }
    });
  });

  return {
    ...query,
    arrivals,
    departures,
    inHouse,
  };
}
