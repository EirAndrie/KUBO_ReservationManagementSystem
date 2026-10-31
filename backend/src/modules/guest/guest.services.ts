import {
      createGuest,
      getGuests,
      getGuestById,
      getGuestByEmail,
      getGuestByIdNumber,
      updateGuest,
      deleteGuest,
      searchGuests,
} from "./repository/guest.repository";
import { AppError } from "../../utils/http";
import type { CreateGuestDTO, UpdateGuestDTO } from "./repository/guest.schema";
import type { Pagination } from "../../utils/pagination";

/**
 * Creates a guest or reuses an existing record.
 *
 * Duplicate prevention is keyed by email first, then by the ID type/number
 * pair. Reusing the existing guest keeps reservations linked to one history.
 * 
 * STATUS: CHECKED
 */
export const createGuestService = async (data: CreateGuestDTO) => {
      const existingByEmail = await getGuestByEmail(data.email);
      if (existingByEmail) {
            return { guest: existingByEmail, reused: true };
      }

      const existingById = await getGuestByIdNumber(
            data.validIdType,
            data.idNumber,
      );

      if (existingById) {
            return { guest: existingById, reused: true };
      }

      const guest = await createGuest(data);
      return { guest, reused: false };
};

// Checked
export const getAllGuestsService = async (pagination: Pagination) => {
      return getGuests({
            pagination: {
                  limit: pagination.limit,
                  offset: pagination.offset,
            },
      });
};

// Checked
export const getGuestByIdService = async (guestId: string) => {
      const guest = await getGuestById(guestId);
      if (!guest) {
            throw new AppError(404, "Guest not found");
      }
      return guest;
};

// Checked
export const updateGuestService = async (
      guestId: string,
      data: UpdateGuestDTO,
) => {
      const existing = await getGuestById(guestId);
      if (!existing) {
            throw new AppError(404, "Guest not found");
      }

      return updateGuest(guestId, data);
};

// Checked
export const deleteGuestService = async (guestId: string) => {
      const existing = await getGuestById(guestId);
      if (!existing) {
            throw new AppError(404, "Guest not found");
      }

      const deleted = await deleteGuest(guestId);
      if (!deleted) {
            throw new AppError(404, "Guest not found");
      }
};

// Checked
export const searchGuestsService = async (params: {
      search?: string;
      validIdType?: string;
      pagination: Pagination;
}) => {
      return searchGuests({
            search: params.search,
            validIdType: params.validIdType,
            pagination: {
                  limit: params.pagination.limit,
                  offset: params.pagination.offset,
            },
      });
};
