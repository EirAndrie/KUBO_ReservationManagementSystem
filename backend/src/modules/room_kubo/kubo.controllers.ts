import type { Request, Response } from "express";
import type { CreateKuboDTO, UpdateKuboDTO } from "./repository/kubo.schema";
import { handleControllerError } from "../../utils/http";
import logger from "../../utils/logger";
import { getPagination } from "../../utils/http";
import {
      createRoomService,
      getAllRoomsService,
      getRoomByIdService,
      updateRoomService,
      deleteRoomService,
      searchRoomsService,
      getRoomsByTypeService,
} from "./kubo.services";

export const createRoomController = async (req: Request, res: Response) => {
      try {
            const data = req.body as CreateKuboDTO;
            const kubos = await createRoomService(data);

            res.status(201).json({
                  success: true,
                  message: "Successfully created Kubo",
                  kubos,
            });
      } catch (error: any) {
            logger.error("Failed to create Room", {
                  error: error.message,
                  stack: error.stack,
            });
            handleControllerError(res, error, error.message);
      }
};

export const getAllRoomsController = async (req: Request, res: Response) => {
      try {
            const pagination = getPagination(req.query);

            const roomTypeId =
                  typeof req.query.roomTypeId === "string"
                        ? req.query.roomTypeId
                        : undefined;
            const status =
                  typeof req.query.status === "string"
                        ? req.query.status
                        : undefined;
            const search =
                  typeof req.query.search === "string"
                        ? req.query.search
                        : undefined;

            let kubos;
            if (roomTypeId || status || search) {
                  kubos = await searchRoomsService({
                        roomTypeId,
                        status,
                        search,
                        pagination,
                  });
            } else {
                  kubos = await getAllRoomsService();
            }

            res.status(200).json({
                  success: true,
                  message: "Successfully listed all kubos",
                  kubos,
            });
      } catch (error: any) {
            logger.error("Failed to list Rooms", {
                  message: error.message,
                  stack: error.stack,
            });
            handleControllerError(res, error, error.message);
      }
};

export const getRoomByIdController = async (req: Request, res: Response) => {
      try {
            const kubos = await getRoomByIdService(req.params.roomId as string);

            res.status(200).json({
                  success: true,
                  message: "Successfully fetched kubo by its ID",
                  kubos,
            });
      } catch (error: any) {
            logger.error("Failed to get Room by ID", {
                  message: error.message,
                  stack: error.stack,
            });
            handleControllerError(res, error, error.message);
      }
};

export const updateRoomController = async (req: Request, res: Response) => {
      try {
            const data = req.body as UpdateKuboDTO;
            const kubos = await updateRoomService({
                  ...data,
                  kuboId: req.params.roomId as string,
            });

            res.status(200).json({
                  success: true,
                  message: "Successfully updated kubo",
                  kubos,
            });
      } catch (error: any) {
            logger.error("Failed to update Room", {
                  message: error.message,
                  stack: error.stack,
            });
            handleControllerError(res, error, error.message);
      }
};

export const deleteRoomController = async (req: Request, res: Response) => {
      try {
            const kubos = await deleteRoomService(req.params.roomId as string);

            res.status(204).json({
                  sucess: true,
                  message: "Succesfully deleted kubo",
                  kubos,
            });
      } catch (error: any) {
            logger.error("Failed to delete Room", {
                  message: error.message,
                  stack: error.stack,
            });
            handleControllerError(res, error, error.message);
      }
};

export const getRoomsByTypeController = async (req: Request, res: Response) => {
      try {
            const kubos = await getRoomsByTypeService(
                  req.params.roomTypeId as string,
            );

            res.status(200).json({
                  success: true,
                  message: "Successfully fetched kubo by its type",
                  kubos,
            });
      } catch (error: any) {
            logger.error("Failed to get rooms by type", {
                  message: error.message,
                  stack: error.stack,
            });
            handleControllerError(res, error, error.message);
      }
};
