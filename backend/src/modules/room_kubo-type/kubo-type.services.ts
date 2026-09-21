import {
      createKuboType,
      getKuboTypes,
      getKuboTypeById,
      updateKuboType,
      deleteKuboType,
      searchKuboTypes,
} from "./repository/kubo-type.repository";
import { AppError } from "../../utils/http";
import logger from "../../utils/logger";
import type {
      CreateKuboTypeDTO,
      UpdateKuboTypeDTO,
} from "./repository/kubo-type.schema";
import type { Pagination } from "../../utils/pagination";

export const createKuboTypeService = async (data: CreateKuboTypeDTO) => {
      // No uniqueness constraints defined
      return createKuboType(data);
};

export const getAllKuboTypesService = async () => {
      return getKuboTypes();
};

export const getKuboTypeByIdService = async (kuboTypeId: string) => {
      const type = await getKuboTypeById(kuboTypeId);
      if (!type) {
            throw new AppError(404, "Kubo type not found");
      }
      return type;
};

export const updateKuboTypeService = async (data: UpdateKuboTypeDTO) => {
      const existing = await getKuboTypeById(data.kuboTypeId);
      if (!existing) {
            throw new AppError(404, "Kubo type not found");
      }
      return updateKuboType(data);
};

export const deleteKuboTypeService = async (kuboTypeId: string) => {
      const existing = await getKuboTypeById(kuboTypeId);
      if (!existing) {
            throw new AppError(404, "Kubo type not found");
      }
      await deleteKuboType(kuboTypeId);
};

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
