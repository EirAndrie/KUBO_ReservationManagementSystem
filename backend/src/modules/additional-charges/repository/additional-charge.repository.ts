import type {
      CreateAdditionalChargeDTO,
      UpdateAdditionalChargeDTO,
      AdditionalChargeResponseDTO,
} from "./additional-charge.schema";
import { db } from "../../../config/connectDB";
import { AppError } from "../../../utils/http";
import logger from "../../../utils/logger";

// Record a new additional charge for a reservation
export const createAdditionalCharge = async (
      data: CreateAdditionalChargeDTO,
): Promise<AdditionalChargeResponseDTO> => {
      try {
            const result = await db.query(
                  `
                        -- TODO: replace with actual stored procedure call
                        SELECT * FROM kubo.create_additional_charge(
                              $1, $2, $3, $4, $5, $6
                        )
                  `,
                  [
                        data.resrvationId,
                        data.employeeId,
                        data.additionalChargeType,
                        data.additionalChargeAmount,
                        data.additionalChargeDescription,
                        data.chargeDate,
                  ],
            );
            return result.rows[0];
      } catch (error: any) {
            logger.error("Failed to insert additional charge into database", {
                  message: error.message,
                  stack: error.stack,
            });
            if (error instanceof AppError) throw error;
            throw new AppError(
                  500,
                  "Failed to insert additional charge into database",
            );
      }
};

export const getChargesByReservation = async (
      reservationId: string,
): Promise<AdditionalChargeResponseDTO[]> => {
      try {
            const result = await db.query(
                  `
                        -- TODO: replace with actual stored procedure call
                        SELECT * FROM kubo.get_additional_charges_by_reservation($1)
                  `,
                  [reservationId],
            );
            return result.rows;
      } catch (error: any) {
            logger.error("Failed to fetch additional charges for reservation", {
                  message: error.message,
                  stack: error.stack,
            });
            if (error instanceof AppError) throw error;
            throw new AppError(
                  500,
                  "Failed to fetch additional charges for reservation",
            );
      }
};

export const getAdditionalChargeById = async (
      chargeId: string,
): Promise<AdditionalChargeResponseDTO | null> => {
      try {
            const result = await db.query(
                  `
                        -- TODO: replace with actual stored procedure call
                        SELECT * FROM kubo.get_additional_charge_by_id($1)
                  `,
                  [chargeId],
            );
            return result.rows[0] ?? null;
      } catch (error: any) {
            logger.error(
                  "Failed to get additional charge by id from database",
                  {
                        message: error.message,
                        stack: error.stack,
                  },
            );
            if (error instanceof AppError) throw error;
            throw new AppError(
                  500,
                  "Failed to get additional charge by id from database",
            );
      }
};

export const updateAdditionalCharge = async (
      data: UpdateAdditionalChargeDTO,
): Promise<AdditionalChargeResponseDTO | null> => {
      try {
            const result = await db.query(
                  `
                        -- TODO: replace with actual stored procedure call
                        SELECT * FROM kubo.update_additional_charge(
                              $1, $2, $3, $4, $5, $6, $7
                        )
                  `,
                  [
                        data.additionalChargeId,
                        data.resrvationId ?? null,
                        data.employeeId ?? null,
                        data.additionalChargeType ?? null,
                        data.additionalChargeAmount ?? null,
                        data.additionalChargeDescription ?? null,
                        data.chargeDate ?? null,
                  ],
            );
            return result.rows[0] ?? null;
      } catch (error: any) {
            logger.error("Failed to update additional charge in database", {
                  message: error.message,
                  stack: error.stack,
            });
            if (error instanceof AppError) throw error;
            throw new AppError(
                  500,
                  "Failed to update additional charge in database",
            );
      }
};

export const deleteAdditionalCharge = async (
      chargeId: string,
): Promise<boolean> => {
      try {
            const result = await db.query(
                  `
                        -- TODO: replace with actual stored procedure call
                        SELECT kubo.delete_additional_charge($1) AS deleted
                  `,
                  [chargeId],
            );
            return result.rows[0]?.deleted != null;
      } catch (error: any) {
            logger.error("Failed to delete additional charge from database", {
                  message: error.message,
                  stack: error.stack,
            });
            if (error instanceof AppError) throw error;
            throw new AppError(
                  500,
                  "Failed to delete additional charge from database",
            );
      }
};

export const searchAdditionalCharges = async (params: {
      reservationId?: string;
      employeeId?: string;
      chargeType?: string;
      pagination: { limit: number; offset: number };
}): Promise<AdditionalChargeResponseDTO[]> => {
      const { reservationId, employeeId, chargeType, pagination } = params;
      try {
            const result = await db.query(
                  `
                        -- TODO: replace with actual stored procedure call
                        SELECT * FROM kubo.search_additional_charges(
                              $1, $2, $3, $4, $5
                        )
                  `,
                  [
                        reservationId ?? null,
                        employeeId ?? null,
                        chargeType ?? null,
                        pagination.limit,
                        pagination.offset,
                  ],
            );
            return result.rows;
      } catch (error: any) {
            logger.error("Failed to search additional charges in database", {
                  message: error.message,
                  stack: error.stack,
            });
            if (error instanceof AppError) throw error;
            throw new AppError(
                  500,
                  "Failed to search additional charges in database",
            );
      }
};
