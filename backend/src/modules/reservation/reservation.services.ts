import {
      createReservation,
      getReservations,
      getReservationById,
      updateReservation,
      confirmReservation,
      cancelReservation,
      markReservationNoShow,
      deleteReservation,
} from "./repository/reservation.repository";
import { AppError } from "../../utils/http";
import type {
      CreateReservationDTO,
      UpdateReservationDTO,
      WithActor,
} from "./repository/reservation.schema";
import type { Pagination } from "../../utils/pagination";

// Checked
export const createReservationService = async (
      data: WithActor<CreateReservationDTO>,
) => {
      return createReservation(data);
};

// Checked
export const getAllReservationsService = async (pagination: Pagination) => {
      return getReservations({
            pagination: {
                  limit: pagination.limit,
                  offset: pagination.offset,
            },
      });
};

// Checked
export const getReservationByIdService = async (reservationId: string) => {
      const reservation = await getReservationById(reservationId);
      if (!reservation) {
            throw new AppError(404, "Reservation not found");
      }
      return reservation;
};

// Checked
export const updateReservationService = async (
      reservationId: string,
      data: UpdateReservationDTO,
) => {
      const existing = await getReservationById(reservationId);
      if (!existing) {
            throw new AppError(404, "Reservation not found");
      }
      return updateReservation(reservationId, data);
};

// Checked
export const confirmReservationService = async (reservationId: string) => {
      const existing = await getReservationById(reservationId);
      if (!existing) {
            throw new AppError(404, "Reservation not found");
      }
      return confirmReservation(reservationId);
};

// Checked
export const cancelReservationService = async (
      reservationId: string,
      reason: string,
) => {
      const existing = await getReservationById(reservationId);
      if (!existing) {
            throw new AppError(404, "Reservation not found");
      }
      return cancelReservation(reservationId, reason);
};

// Checked
export const markReservationNoShowService = async (reservationId: string) => {
      const existing = await getReservationById(reservationId);
      if (!existing) {
            throw new AppError(404, "Reservation not found");
      }
      return markReservationNoShow(reservationId);
};

// Checked
export const deleteReservationService = async (reservationId: string) => {
      const existing = await getReservationById(reservationId);
      if (!existing) {
            throw new AppError(404, "Reservation not found");
      }

      const deleted = await deleteReservation(reservationId);
      if (!deleted) {
            throw new AppError(404, "Reservation not found");
      }
};

// Checked
export const searchReservationsService = async (params: {
      status?: string;
      bookingSource?: string;
      search?: string;
      guestId?: string;
      employeeId?: string;
      checkInDate?: string;
      checkOutDate?: string;
      pagination: Pagination;
}) => {
      return getReservations({
            status: params.status,
            bookingSource: params.bookingSource,
            search: params.search,
            guestId: params.guestId,
            employeeId: params.employeeId,
            checkInDate: params.checkInDate,
            checkOutDate: params.checkOutDate,
            pagination: {
                  limit: params.pagination.limit,
                  offset: params.pagination.offset,
            },
      });
};
