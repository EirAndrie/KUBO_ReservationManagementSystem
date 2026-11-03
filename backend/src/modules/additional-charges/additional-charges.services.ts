import {
      createCatalogItem,
      getCatalogItems,
      getCatalogItemById,
      updateCatalogItem,
      deleteCatalogItem,
      applyCatalogCharge,
      getChargesByReservation,
      getChargeById,
      getCharges,
      deleteCharge,
      addChargeCorrection,
      createChargeRequest,
      getChargeRequests,
      getChargeRequestById,
      approveChargeRequest,
      rejectChargeRequest,
      withdrawChargeRequest,
} from "./repository/additional-charge.repository";
import { AppError } from "../../utils/http";
import type {
      CreateCatalogItemDTO,
      UpdateCatalogItemDTO,
      ApplyCatalogChargeDTO,
      CustomChargeRequestDTO,
      ApproveChargeRequestDTO,
      RejectChargeRequestDTO,
      AddChargeCorrectionDTO,
      WithActor,
} from "./repository/additional-charge.schema";
import type { Pagination } from "../../utils/pagination";

// ADDITIONAL CHARGE CATALOG SERVICES

// Checked
export const createCatalogItemService = async (
      data: WithActor<CreateCatalogItemDTO>,
) => {
      return createCatalogItem(data);
};

// Checked
export const getCatalogItemsService = async (params: {
      search?: string;
      activeOnly: boolean;
      pagination: Pagination;
}) => {
      return getCatalogItems({
            search: params.search,
            activeOnly: params.activeOnly,
            pagination: {
                  limit: params.pagination.limit,
                  offset: params.pagination.offset,
            },
      });
};

// Checked
export const getCatalogItemByIdService = async (catalogId: string) => {
      const item = await getCatalogItemById(catalogId);
      if (!item) {
            throw new AppError(404, "Catalog item not found");
      }
      return item;
};

// Checked
export const updateCatalogItemService = async (
      catalogId: string,
      data: WithActor<UpdateCatalogItemDTO>,
) => {
      const item = await getCatalogItemById(catalogId);
      if (!item) {
            throw new AppError(404, "Catalog item not found");
      }
      return updateCatalogItem(catalogId, data);
};


export const deleteCatalogItemService = async (
      catalogId: string,
      employeeId: string,
) => {
      const item = await getCatalogItemById(catalogId);
      if (!item) {
            throw new AppError(404, "Catalog item not found");
      }

      const deleted = await deleteCatalogItem(catalogId, employeeId);
      if (!deleted) {
            throw new AppError(404, "Catalog item not found");
      }
};

export const applyCatalogChargeService = async (
      reservationId: string,
      data: WithActor<ApplyCatalogChargeDTO>,
) => {
      return applyCatalogCharge(reservationId, data);
};

export const getChargesByReservationService = async (reservationId: string) => {
      return getChargesByReservation(reservationId);
};

export const getChargeByIdService = async (chargeId: string) => {
      const charge = await getChargeById(chargeId);
      if (!charge) {
            throw new AppError(404, "Additional charge not found");
      }
      return charge;
};

export const getChargesService = async (params: {
      reservationId?: string;
      employeeId?: string;
      chargeType?: string;
      createdFrom?: Date;
      createdTo?: Date;
      pagination: Pagination;
}) => {
      return getCharges({
            reservationId: params.reservationId,
            employeeId: params.employeeId,
            chargeType: params.chargeType,
            createdFrom: params.createdFrom,
            createdTo: params.createdTo,
            pagination: {
                  limit: params.pagination.limit,
                  offset: params.pagination.offset,
            },
      });
};

export const deleteChargeService = async (
      chargeId: string,
      employeeId: string,
) => {
      const charge = await getChargeById(chargeId);
      if (!charge) {
            throw new AppError(404, "Additional charge not found");
      }

      const deleted = await deleteCharge(chargeId, employeeId);
      if (!deleted) {
            throw new AppError(404, "Additional charge not found");
      }
};

export const addChargeCorrectionService = async (
      chargeId: string,
      data: WithActor<AddChargeCorrectionDTO>,
) => {
      const charge = await getChargeById(chargeId);
      if (!charge) {
            throw new AppError(404, "Additional charge not found");
      }
      return addChargeCorrection(chargeId, data);
};

export const createChargeRequestService = async (
      reservationId: string,
      data: WithActor<CustomChargeRequestDTO>,
) => {
      return createChargeRequest(reservationId, data);
};

export const getChargeRequestsService = async (params: {
      status?: string;
      reservationId?: string;
      requestedBy?: string;
      pagination: Pagination;
}) => {
      return getChargeRequests({
            status: params.status,
            reservationId: params.reservationId,
            requestedBy: params.requestedBy,
            pagination: {
                  limit: params.pagination.limit,
                  offset: params.pagination.offset,
            },
      });
};

export const getChargeRequestByIdService = async (requestId: string) => {
      const request = await getChargeRequestById(requestId);
      if (!request) {
            throw new AppError(404, "Charge request not found");
      }
      return request;
};

export const approveChargeRequestService = async (
      requestId: string,
      data: WithActor<ApproveChargeRequestDTO>,
) => {
      const request = await getChargeRequestById(requestId);
      if (!request) {
            throw new AppError(404, "Charge request not found");
      }
      return approveChargeRequest(requestId, data);
};

export const rejectChargeRequestService = async (
      requestId: string,
      data: WithActor<RejectChargeRequestDTO>,
) => {
      const request = await getChargeRequestById(requestId);
      if (!request) {
            throw new AppError(404, "Charge request not found");
      }
      return rejectChargeRequest(requestId, data);
};

export const withdrawChargeRequestService = async (
      requestId: string,
      employeeId: string,
) => {
      const request = await getChargeRequestById(requestId);
      if (!request) {
            throw new AppError(404, "Charge request not found");
      }
      return withdrawChargeRequest(requestId, employeeId);
};
