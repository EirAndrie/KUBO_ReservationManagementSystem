import {
      createAdditionalCharge,
      getChargesByReservation,
      getAdditionalChargeById,
      updateAdditionalCharge,
      deleteAdditionalCharge,
      searchAdditionalCharges,
} from "./repository/additional-charge.repository";
import { AppError } from "../../utils/http";
import logger from "../../utils/logger";
import type {
      CreateAdditionalChargeDTO,
      UpdateAdditionalChargeDTO,
} from "./repository/additional-charge.schema";
import type { Pagination } from "../../utils/pagination";

export const createAdditionalChargeService = async (
      data: CreateAdditionalChargeDTO,
) => {
      // No duplicate checks defined
      return createAdditionalCharge(data);
};

export const getChargesByReservationService = async (reservationId: string) => {
      return getChargesByReservation(reservationId);
};

export const getAdditionalChargeByIdService = async (chargeId: string) => {
      const charge = await getAdditionalChargeById(chargeId);
      if (!charge) {
            throw new AppError(404, "Additional charge not found");
      }
      return charge;
};

export const updateAdditionalChargeService = async (
      data: UpdateAdditionalChargeDTO,
) => {
      const existing = await getAdditionalChargeById(data.additionalChargeId);
      if (!existing) {
            throw new AppError(404, "Additional charge not found");
      }
      return updateAdditionalCharge(data);
};

export const deleteAdditionalChargeService = async (chargeId: string) => {
      const existing = await getAdditionalChargeById(chargeId);
      if (!existing) {
            throw new AppError(404, "Additional charge not found");
      }
      await deleteAdditionalCharge(chargeId);
};

export const searchAdditionalChargesService = async (params: {
      reservationId?: string;
      employeeId?: string;
      chargeType?: string;
      pagination: Pagination;
}) => {
      return searchAdditionalCharges({
            reservationId: params.reservationId,
            employeeId: params.employeeId,
            chargeType: params.chargeType,
            pagination: {
                  limit: params.pagination.limit,
                  offset: params.pagination.offset,
            },
      });
};
