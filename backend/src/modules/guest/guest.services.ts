import {
      createGuest,
      getGuests,
      getGuestById,
      updateGuest,
      deleteGuest,
      searchGuests,
} from "./repository/guest.repository";
import { AppError } from "../../utils/http";
import logger from "../../utils/logger";
import type { CreateGuestDTO, UpdateGuestDTO } from "./repository/guest.schema";
import type { Pagination } from "../../utils/pagination";

export const createGuestService = async (data: CreateGuestDTO) => {
      // No uniqueness checks defined in spec
      return createGuest(data);
};

export const getAllGuestsService = async () => {
      return getGuests();
};

export const getGuestByIdService = async (guestId: string) => {
      const guest = await getGuestById(guestId);
      if (!guest) {
            throw new AppError(404, "Guest not found");
      }
      return guest;
};

export const updateGuestService = async (data: UpdateGuestDTO) => {
      const existing = await getGuestById(data.guestId);
      if (!existing) {
            throw new AppError(404, "Guest not found");
      }
      return updateGuest(data);
};

export const deleteGuestService = async (guestId: string) => {
      const existing = await getGuestById(guestId);
      if (!existing) {
            throw new AppError(404, "Guest not found");
      }
      await deleteGuest(guestId);
};

export const searchGuestsService = async (
      params: { search?: string; validIdType?: string; pagination: Pagination }
) => {
      // Pass pagination limit and offset to repository
      return searchGuests({
            search: params.search,
            validIdType: params.validIdType,
            pagination: { limit: params.pagination.limit, offset: params.pagination.offset },
      });
};
