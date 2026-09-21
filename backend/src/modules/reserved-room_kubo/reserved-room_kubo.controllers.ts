import type { Request, Response } from "express";
import type {
      CreateReservedKuboDTO,
      UpdateReservedKuboDTO,
} from "./repository/reserved-kubo.schema";
import { handleControllerError } from "../../utils/http";
import logger from "../../utils/logger";
import { getPagination } from "../../utils/http";
import {
      assignRoomService,
      getRoomsByReservationService,
      getReservedRoomService,
      updateReservedRoomService,
      deleteReservedRoomService,
      checkInRoomService,
      checkOutRoomService,
      approveEarlyCheckInService,
      searchReservedRoomsService,
      getReservationsByRoomService,
} from "./reserved-room_kubo.services";

// POST /reservations/:reservationId/rooms – assign a room
export const assignRoomController = async (req: Request, res: Response) => {
      try {
            // reservationId comes from URL, ensure it matches payload if provided
            const data = {
                  ...(req.body as Omit<CreateReservedKuboDTO, "reservationId">),
                  reservationId: req.params.reservationId as string,
            } as CreateReservedKuboDTO;
            const reservedRooms = await assignRoomService(data);

            res.status(201).json({
                  success: true,
                  message: "Successfully assigned a Room to Reservation",
                  reservedRooms,
            });
      } catch (error: any) {
            logger.error("Failed to assign room to reservation", {
                  error: error.message,
                  stack: error.stack,
            });
            handleControllerError(res, error, error.message);
      }
};

// GET /reservations/:reservationId/rooms – list rooms for a reservation
export const getRoomsByReservationController = async (
      req: Request,
      res: Response,
) => {
      try {
            const reservedRooms = await getRoomsByReservationService(
                  req.params.reservationId as string,
            );

            res.status(200).json({
                  success: true,
                  message: "Successfully fetched rooms by reservation",
                  reservedRooms,
            });
      } catch (error: any) {
            logger.error("Failed to list rooms for reservation", {
                  message: error.message,
                  stack: error.stack,
            });
            handleControllerError(res, error, error.message);
      }
};

// GET /reservations/:reservationId/rooms/:roomId – single assignment
export const getReservedRoomController = async (
      req: Request,
      res: Response,
) => {
      try {
            const reservedRooms = await getReservedRoomService(
                  req.params.reservationId as string,
                  req.params.roomId as string,
            );

            res.status(200).json({
                  success: true,
                  message: "Successfully fetched reserved room",
                  reservedRooms,
            });
      } catch (error: any) {
            logger.error("Failed to get reserved room", {
                  message: error.message,
                  stack: error.stack,
            });
            handleControllerError(res, error, error.message);
      }
};

// PATCH /reservations/:reservationId/rooms/:roomId – update assignment
export const updateReservedRoomController = async (
      req: Request,
      res: Response,
) => {
      try {
            const data = {
                  ...(req.body as Omit<
                        UpdateReservedKuboDTO,
                        "reservationId" | "kuboId"
                  >),
                  reservationId: req.params.reservationId as string,
                  kuboId: req.params.roomId as string,
            } as UpdateReservedKuboDTO;
            const reservedRooms = await updateReservedRoomService(data);

            res.status(200).json({
                  success: true,
                  message: "Successfully updated reserved room",
                  reservedRooms,
            });
      } catch (error: any) {
            logger.error("Failed to update reserved room", {
                  message: error.message,
                  stack: error.stack,
            });
            handleControllerError(res, error, error.message);
      }
};

// DELETE /reservations/:reservationId/rooms/:roomId – remove assignment
export const deleteReservedRoomController = async (
      req: Request,
      res: Response,
) => {
      try {
            const reservedRooms = await deleteReservedRoomService(
                  req.params.reservationId as string,
                  req.params.roomId as string,
            );

            res.status(204).json({
                  success: true,
                  message: "Successfully deleted reserved room",
                  reservedRooms,
            });
      } catch (error: any) {
            logger.error("Failed to delete reserved room", {
                  message: error.message,
                  stack: error.stack,
            });
            handleControllerError(res, error, error.message);
      }
};

// PATCH /reservations/:reservationId/rooms/:roomId/check-in
export const checkInRoomController = async (req: Request, res: Response) => {
      try {
            const reservedRooms = await checkInRoomService(
                  req.params.reservationId as string,
                  req.params.roomId as string,
            );

            res.status(200).json({
                  success: true,
                  message: "Successfully checked in guest to reserved room",
                  reservedRooms,
            });
      } catch (error: any) {
            logger.error("Failed to check‑in reserved room", {
                  message: error.message,
                  stack: error.stack,
            });
            handleControllerError(res, error, error.message);
      }
};

// PATCH /reservations/:reservationId/rooms/:roomId/check-out
export const checkOutRoomController = async (req: Request, res: Response) => {
      try {
            const reservedRooms = await checkOutRoomService(
                  req.params.reservationId as string,
                  req.params.roomId as string,
            );

            res.status(200).json({
                  success: true,
                  message: "Successfully checked out guest to reserved room",
                  reservedRooms,
            });
      } catch (error: any) {
            logger.error("Failed to check‑out reserved room", {
                  message: error.message,
                  stack: error.stack,
            });
            handleControllerError(res, error, error.message);
      }
};

// PATCH /reservations/:reservationId/rooms/:roomId/early-check-in
export const earlyCheckInController = async (req: Request, res: Response) => {
      try {
            const reservedRooms = await approveEarlyCheckInService(
                  req.params.reservationId as string,
                  req.params.roomId as string,
            );

            res.status(200).json({
                  success: true,
                  message: "Successfully approved guest for early check in",
                  reservedRooms,
            });
      } catch (error: any) {
            logger.error("Failed to approve early check‑in", {
                  message: error.message,
                  stack: error.stack,
            });
            handleControllerError(res, error, error.message);
      }
};

// GET /reserved-rooms – filtered list (public endpoint)
export const searchReservedRoomsController = async (
      req: Request,
      res: Response,
) => {
      try {
            const pagination = getPagination(req.query);

            const roomId =
                  typeof req.query.roomId === "string"
                        ? req.query.roomId
                        : undefined;
            const status =
                  typeof req.query.status === "string"
                        ? req.query.status
                        : undefined;
            const checkInDate =
                  typeof req.query.checkInDate === "string"
                        ? req.query.checkInDate
                        : undefined;
            const checkOutDate =
                  typeof req.query.checkOutDate === "string"
                        ? req.query.checkOutDate
                        : undefined;

            const reservedRooms = await searchReservedRoomsService({
                  roomId,
                  status,
                  checkInDate,
                  checkOutDate,
                  pagination,
            });

            res.status(201).json({
                  success: true,
                  message: "Successfully fetched room by filter search",
                  reservedRooms,
            });
      } catch (error: any) {
            logger.error("Failed to search reserved rooms", {
                  message: error.message,
                  stack: error.stack,
            });
            handleControllerError(res, error, error.message);
      }
};

// GET /rooms/:roomId/reservations – reservations for a room within date range
export const getReservationsByRoomController = async (
      req: Request,
      res: Response,
) => {
      try {
            const checkInDate =
                  typeof req.query.checkInDate === "string"
                        ? req.query.checkInDate
                        : undefined;
            const checkOutDate =
                  typeof req.query.checkOutDate === "string"
                        ? req.query.checkOutDate
                        : undefined;

            const reservedRooms = await getReservationsByRoomService(
                  req.params.roomId as string,
                  checkInDate,
                  checkOutDate,
            );

            res.status(200).json({
                  success: true,
                  message: "Successfully fetched reservations by room",
                  reservedRooms,
            });
      } catch (error: any) {
            logger.error("Failed to get reservations for room", {
                  message: error.message,
                  stack: error.stack,
            });
            handleControllerError(res, error, error.message);
      }
};
