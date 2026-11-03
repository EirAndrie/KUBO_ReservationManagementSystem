import {
      createKuboType,
      getKuboTypes,
      getKuboTypeById,
      updateKuboType,
      deleteKuboType,
      searchKuboTypes,
} from "./repository/kubo-type.repository";
import { AppError } from "../../utils/http";
import type {
      CreateKuboTypeDTO,
      UpdateKuboTypeDTO,
} from "./repository/kubo-type.schema";
import type { Pagination } from "../../utils/pagination";

// Checked
export const createKuboTypeService = async (
      data: CreateKuboTypeDTO,
      actorEmployeeId: string,
) => {
      return createKuboType(data, actorEmployeeId);
};

// Checked
export const getAllKuboTypesService = async (pagination: Pagination) => {
      return getKuboTypes({
            pagination: {
                  limit: pagination.limit,
                  offset: pagination.offset,
            },
      });
};

// Checked
export const getKuboTypeByIdService = async (kuboTypeId: string) => {
      const type = await getKuboTypeById(kuboTypeId);
      if (!type) {
            throw new AppError(404, "Kubo type not found");
      }
      return type;
};

// Checked
export const updateKuboTypeService = async (
      kuboTypeId: string,
      data: UpdateKuboTypeDTO,
      actorEmployeeId: string,
) => {
      const existing = await getKuboTypeById(kuboTypeId);
      if (!existing) {
            throw new AppError(404, "Kubo type not found");
      }
      return updateKuboType(kuboTypeId, data, actorEmployeeId);
};

// Checked
export const deleteKuboTypeService = async (
      kuboTypeId: string,
      actorEmployeeId: string,
) => {
      const existing = await getKuboTypeById(kuboTypeId);
      if (!existing) {
            throw new AppError(404, "Kubo type not found");
      }

      const deleted = await deleteKuboType(kuboTypeId, actorEmployeeId);
      if (!deleted) {
            throw new AppError(404, "Kubo type not found");
      }
};

// Checked
export const searchKuboTypesService = async (params: {
      search?: string;
      minCapacity?: number;
      maxCapacity?: number;
      pagination: Pagination;
}) => {
      return searchKuboTypes({
            search: params.search,
            minCapacity: params.minCapacity,
            maxCapacity: params.maxCapacity,
            pagination: {
                  limit: params.pagination.limit,
                  offset: params.pagination.offset,
            },
      });
};
