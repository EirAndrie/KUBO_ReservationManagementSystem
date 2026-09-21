import type { Request, Response } from "express";
import type { CreateGuestDTO, UpdateGuestDTO } from "./repository/guest.schema";
import { handleControllerError } from "../../utils/http";
import logger from "../../utils/logger";
import { getPagination } from "../../utils/http";
import {
      createGuestService,
      getAllGuestsService,
      getGuestByIdService,
      updateGuestService,
      deleteGuestService,
      searchGuestsService,
} from "./guest.services";

export const createGuestController = async (req: Request, res: Response) => {
      try {
            const data = req.body as CreateGuestDTO;
            const guests = await createGuestService(data);

            res.status(201).json({
                  success: true,
                  message: "Guest created successfully",
                  guests,
            });
      } catch (error: any) {
            logger.error("Failed to create Guest", {
                  error: error.message,
                  stack: error.stack,
            });
            handleControllerError(res, error, error.message);
      }
};

export const getAllGuestsController = async (req: Request, res: Response) => {
      try {
            const pagination = getPagination(req.query);

            const search =
                  typeof req.query.search === "string"
                        ? req.query.search
                        : undefined;
            const validIdType =
                  typeof req.query.validIdType === "string"
                        ? req.query.validIdType
                        : undefined;

            let guests;
            if (search || validIdType) {
                  guests = await searchGuestsService({
                        search,
                        validIdType,
                        pagination,
                  });
            } else {
                  guests = await getAllGuestsService();
            }

            res.status(200).json({
                  success: true,
                  count: guests.length,
                  message: "Guests listed successfully",
                  guests,
            });
      } catch (error: any) {
            logger.error("Failed to list Guests", {
                  message: error.message,
                  stack: error.stack,
            });
            handleControllerError(res, error, error.message);
      }
};

export const getGuestByIdController = async (req: Request, res: Response) => {
      try {
            const guests = await getGuestByIdService(
                  req.params.guestId as string,
            );

            res.status(200).json({
                  success: true,
                  message: "Guest fetched successfully by its ID",
                  guests,
            });
      } catch (error: any) {
            logger.error("Failed to get Guest by ID", {
                  message: error.message,
                  stack: error.stack,
            });
            handleControllerError(res, error, error.message);
      }
};

export const updateGuestController = async (req: Request, res: Response) => {
      try {
            const data = req.body as UpdateGuestDTO;
            const guests = await updateGuestService({
                  ...data,
                  guestId: req.params.guestId as string,
            });

            res.status(200).json({
                  success: true,
                  message: "Guest updated successfully",
                  guests,
            });
      } catch (error: any) {
            logger.error("Failed to update Guest", {
                  message: error.message,
                  stack: error.stack,
            });
            handleControllerError(res, error, error.message);
      }
};

export const deleteGuestController = async (req: Request, res: Response) => {
      try {
            const guests = await deleteGuestService(
                  req.params.guestId as string,
            );

            res.status(204).json({
                  success: true,
                  message: "Guest deleted successfully",
                  guests,
            });
      } catch (error: any) {
            logger.error("Failed to delete Guest", {
                  message: error.message,
                  stack: error.stack,
            });
            handleControllerError(res, error, error.message);
      }
};
