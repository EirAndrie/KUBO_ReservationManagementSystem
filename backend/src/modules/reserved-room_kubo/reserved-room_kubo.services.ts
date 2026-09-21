import {
      assignRoom,
      getRoomsByReservation,
      getReservedRoom,
      updateReservedRoom,
      deleteReservedRoom,
      checkInRoom,
      checkOutRoom,
      approveEarlyCheckIn,
      searchReservedRooms,
      getReservationsByRoom,
} from "./repository/reserved-kubo.repository";
import { AppError } from "../../utils/http";
import logger from "../../utils/logger";
import type {
      CreateReservedKuboDTO,
      UpdateReservedKuboDTO,
} from "./repository/reserved-kubo.schema";
import type { Pagination } from "../../utils/pagination";

// Assign a room to a reservation
export const assignRoomService = async (data: CreateReservedKuboDTO) => {
      // No additional checks for now – could verify reservation & room existence here
      return assignRoom(data);
};

export const getRoomsByReservationService = async (reservationId: string) => {
      return getRoomsByReservation(reservationId);
};

export const getReservedRoomService = async (
      reservationId: string,
      kuboId: string,
) => {
      const rr = await getReservedRoom(reservationId, kuboId);
      if (!rr) {
            throw new AppError(404, "Reserved room not found");
      }
      return rr;
};

export const updateReservedRoomService = async (
      data: UpdateReservedKuboDTO,
) => {
      // Ensure the row exists before update
      const existing = await getReservedRoom(data.reservationId, data.kuboId);
      if (!existing) {
            throw new AppError(404, "Reserved room not found");
      }
      return updateReservedRoom(data);
};

export const deleteReservedRoomService = async (
      reservationId: string,
      kuboId: string,
) => {
      const existing = await getReservedRoom(reservationId, kuboId);
      if (!existing) {
            throw new AppError(404, "Reserved room not found");
      }
      await deleteReservedRoom(reservationId, kuboId);
};

export const checkInRoomService = async (
      reservationId: string,
      kuboId: string,
) => {
      const existing = await getReservedRoom(reservationId, kuboId);
      if (!existing) {
            throw new AppError(404, "Reserved room not found");
      }
      return checkInRoom(reservationId, kuboId);
};

export const checkOutRoomService = async (
      reservationId: string,
      kuboId: string,
) => {
      const existing = await getReservedRoom(reservationId, kuboId);
      if (!existing) {
            throw new AppError(404, "Reserved room not found");
      }
      return checkOutRoom(reservationId, kuboId);
};

export const approveEarlyCheckInService = async (
      reservationId: string,
      kuboId: string,
) => {
      const existing = await getReservedRoom(reservationId, kuboId);
      if (!existing) {
            throw new AppError(404, "Reserved room not found");
      }
      return approveEarlyCheckIn(reservationId, kuboId);
};

export const searchReservedRoomsService = async (params: {
      roomId?: string;
      status?: string;
      checkInDate?: string;
      checkOutDate?: string;
      pagination: Pagination;
}) => {
      return searchReservedRooms({
            roomId: params.roomId,
            status: params.status,
            checkInDate: params.checkInDate,
            checkOutDate: params.checkOutDate,
            pagination: {
                  limit: params.pagination.limit,
                  offset: params.pagination.offset,
            },
      });
};

export const getReservationsByRoomService = async (
      roomId: string,
      checkInDate?: string,
      checkOutDate?: string,
) => {
      return getReservationsByRoom(roomId, checkInDate, checkOutDate);
};
