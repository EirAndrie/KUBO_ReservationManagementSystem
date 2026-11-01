import {
      createKubo,
      getKubos,
      getKuboById,
      updateKubo,
      changeKuboStatus,
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
export const createKuboService = async (data: CreateKuboDTO) => {
      return createKubo(data);
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
) => {
      const existing = await getKuboById(kuboId);
      if (!existing) {
            throw new AppError(404, "Kubo not found");
      }
      return updateKubo(kuboId, data);
};

// Checked
export const changeKuboStatusService = async (
      kuboId: string,
      status: string,
) => {
      const existing = await getKuboById(kuboId);
      if (!existing) {
            throw new AppError(404, "Kubo not found");
      }
      return changeKuboStatus(kuboId, status);
};

// To be checked: Prevent deletion of kubo if it is currently 
// reserved or occupied or has history of reservations. 
// This can be done by checking the status of the kubo before deletion.

// Checked:
export const deleteKuboService = async (kuboId: string) => {
      const existing = await getKuboById(kuboId);
      if (!existing) {
            throw new AppError(404, "Kubo not found");
      }

      const deleted = await deleteKubo(kuboId);
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
