import {
      createKubo,
      getKubos,
      getKuboById,
      updateKubo,
      changeKuboStatus,
      markKuboReady,
      deleteKubo,
      searchKubos,
      getAvailableKubos,
} from "./repository/kubo.repository";
import { AppError } from "../../utils/http";
import type {
      CreateKuboDTO,
      UpdateKuboDTO,
} from "./repository/kubo.schema";
import type { Pagination } from "../../utils/pagination";

// Checked
export const createKuboService = async (
      data: CreateKuboDTO,
      actorEmployeeId: string,
) => {
      return createKubo(data, actorEmployeeId);
};

// Checked
export const getAllKubosService = async (pagination: Pagination) => {
      return getKubos({
            pagination: {
                  limit: pagination.limit,
                  offset: pagination.offset,
            },
      });
};

// Checked
export const getKuboByIdService = async (kuboId: string) => {
      const kubo = await getKuboById(kuboId);
      if (!kubo) {
            throw new AppError(404, "Kubo not found");
      }
      return kubo;
};

// Checked
export const updateKuboService = async (
      kuboId: string,
      data: UpdateKuboDTO,
      actorEmployeeId: string,
) => {
      const existing = await getKuboById(kuboId);
      if (!existing) {
            throw new AppError(404, "Kubo not found");
      }
      return updateKubo(kuboId, data, actorEmployeeId);
};

// Checked
export const changeKuboStatusService = async (
      kuboId: string,
      status: string,
      actorEmployeeId: string,
) => {
      const existing = await getKuboById(kuboId);
      if (!existing) {
            throw new AppError(404, "Kubo not found");
      }
      return changeKuboStatus(kuboId, status, actorEmployeeId);
};

/**
 * Staff housekeeping: marks a `Cleaning` kubo `Available` (BR-021, BR-063).
 * The stored function enforces the transition and writes the audit row.
 */
export const markKuboReadyService = async (
      kuboId: string,
      actorEmployeeId: string,
) => {
      const kubo = await markKuboReady(kuboId, actorEmployeeId);
      // The function raises P0002 ("Kubo does not exist.") for an unknown id;
      // this guard only covers an unexpected empty result, with the same text.
      if (!kubo) {
            throw new AppError(404, "Kubo does not exist.");
      }
      return kubo;
};

// To be checked: Prevent deletion of kubo if it is currently 
// reserved or occupied or has history of reservations. 
// This can be done by checking the status of the kubo before deletion.

// Checked:
export const deleteKuboService = async (
      kuboId: string,
      actorEmployeeId: string,
) => {
      const existing = await getKuboById(kuboId);
      if (!existing) {
            throw new AppError(404, "Kubo not found");
      }

      const deleted = await deleteKubo(kuboId, actorEmployeeId);
      if (!deleted) {
            throw new AppError(404, "Kubo not found");
      }
};

// Checked
export const searchKubosService = async (params: {
      search?: string;
      kuboTypeId?: string;
      status?: string;
      pagination: Pagination;
}) => {
      return searchKubos({
            search: params.search,
            kuboTypeId: params.kuboTypeId,
            status: params.status,
            pagination: {
                  limit: params.pagination.limit,
                  offset: params.pagination.offset,
            },
      });
};

export const getAvailableKubosService = async (params: {
      checkIn: string;
      checkOut: string;
      kuboTypeId?: string;
}) => {
      return getAvailableKubos({
            checkIn: params.checkIn,
            checkOut: params.checkOut,
            kuboTypeId: params.kuboTypeId,
      });
};
