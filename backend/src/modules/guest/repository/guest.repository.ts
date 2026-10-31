import type {
      CreateGuestDTO,
      UpdateGuestDTO,
      GuestResponseDTO,
} from "./guest.schema";
import { db } from "../../../config/connectDB";
import { mapDatabaseError } from "../../../utils/http";
import logger from "../../../utils/logger";

export const createGuest = async (
      data: CreateGuestDTO,
): Promise<GuestResponseDTO> => {
      try {
            const result = await db.query(
                  `
                  SELECT *
                  FROM kubo_guest_management.fn_create_guest(
                        p_first_name => $1,
                        p_last_name => $2,
                        p_email => $3,
                        p_phone => $4,
                        p_valid_id_type => $5::kubo.valid_id_type,
                        p_id_number => $6,
                        p_address_line_1 => $7,
                        p_city => $8,
                        p_state_province => $9,
                        p_zip_postal_code => $10,
                        p_country => $11
                  )
                  `,
                  [
                        data.firstName,
                        data.lastName,
                        data.email,
                        data.phone,
                        data.validIdType,
                        data.idNumber,
                        data.addressLine1 ?? null,
                        data.city ?? null,
                        data.stateProvince ?? null,
                        data.zipPostalCode ?? null,
                        data.country ?? null,
                  ],
            );
            return result.rows[0];
      } catch (error: any) {
            logger.error("Failed to insert guest to the database", {
                  message: error.message,
                  stack: error.stack,
            });
            throw mapDatabaseError(
                  error,
                  "Failed to insert guest to the database",
            );
      }
};

export const getGuests = async (params: {
      pagination: { limit: number; offset: number };
}): Promise<GuestResponseDTO[]> => {
      try {
            const result = await db.query(
                  `
                  SELECT *
                  FROM kubo_guest_management.fn_search_guests(
                        p_limit => $1,
                        p_offset => $2
                  )
                  `,
                  [params.pagination.limit, params.pagination.offset],
            );
            return result.rows;
      } catch (error: any) {
            logger.error("Failed to fetch guests from database", {
                  message: error.message,
                  stack: error.stack,
            });
            throw mapDatabaseError(error, "Failed to fetch guests from database");
      }
};

export const getGuestById = async (
      guestId: string,
): Promise<GuestResponseDTO | null> => {
      try {
            const result = await db.query(
                  `
                  SELECT *
                  FROM kubo_guest_management.fn_get_guest_by_id($1)
                  `,
                  [guestId],
            );
            return result.rows[0] ?? null;
      } catch (error: any) {
            logger.error("Failed to get guest by id from database", {
                  message: error.message,
                  stack: error.stack,
            });
            throw mapDatabaseError(
                  error,
                  "Failed to get guest by id from database",
            );
      }
};

export const getGuestByEmail = async (
      email: string,
): Promise<GuestResponseDTO | null> => {
      try {
            const result = await db.query(
                  `
                  SELECT *
                  FROM kubo_guest_management.fn_get_guest_by_email($1)
                  `,
                  [email],
            );
            return result.rows[0] ?? null;
      } catch (error: any) {
            logger.error("Failed to find guest by email", {
                  message: error.message,
                  stack: error.stack,
            });
            throw mapDatabaseError(error, "Failed to find guest by email");
      }
};

export const getGuestByIdNumber = async (
      validIdType: string,
      idNumber: string,
): Promise<GuestResponseDTO | null> => {
      try {
            const result = await db.query(
                  `
                  SELECT *
                  FROM kubo_guest_management.fn_get_guest_by_id_number(
                        $1::kubo.valid_id_type,
                        $2
                  )
                  `,
                  [validIdType, idNumber],
            );
            return result.rows[0] ?? null;
      } catch (error: any) {
            logger.error("Failed to find guest by ID details", {
                  message: error.message,
                  stack: error.stack,
            });
            throw mapDatabaseError(error, "Failed to find guest by ID details");
      }
};

export const updateGuest = async (
      guestId: string,
      data: UpdateGuestDTO,
): Promise<GuestResponseDTO | null> => {
      try {
            const result = await db.query(
                  `
                  SELECT *
                  FROM kubo_guest_management.fn_update_guest(
                        p_guest_id => $1,
                        p_first_name => $2,
                        p_last_name => $3,
                        p_email => $4,
                        p_phone => $5,
                        p_valid_id_type => $6::kubo.valid_id_type,
                        p_id_number => $7,
                        p_address_line_1 => $8,
                        p_city => $9,
                        p_state_province => $10,
                        p_zip_postal_code => $11,
                        p_country => $12
                  )
                  `,
                  [
                        guestId,
                        data.firstName ?? null,
                        data.lastName ?? null,
                        data.email ?? null,
                        data.phone ?? null,
                        data.validIdType ?? null,
                        data.idNumber ?? null,
                        data.addressLine1 ?? null,
                        data.city ?? null,
                        data.stateProvince ?? null,
                        data.zipPostalCode ?? null,
                        data.country ?? null,
                  ],
            );
            return result.rows[0] ?? null;
      } catch (error: any) {
            logger.error("Failed to update guest in database", {
                  message: error.message,
                  stack: error.stack,
            });
            throw mapDatabaseError(error, "Failed to update guest in database");
      }
};

export const deleteGuest = async (guestId: string): Promise<boolean> => {
      try {
            const result = await db.query(
                  `
                  SELECT kubo_guest_management.fn_delete_unused_guest($1) AS deleted
                  `,
                  [guestId],
            );
            return result.rows[0]?.deleted === true;
      } catch (error: any) {
            logger.error("Failed to delete guest from database", {
                  message: error.message,
                  stack: error.stack,
            });
            throw mapDatabaseError(error, "Failed to delete guest from database");
      }
};

export const searchGuests = async (params: {
      search?: string;
      validIdType?: string;
      pagination: { limit: number; offset: number };
}): Promise<GuestResponseDTO[]> => {
      const { search, validIdType, pagination } = params;
      try {
            const result = await db.query(
                  `
                  SELECT *
                  FROM kubo_guest_management.fn_search_guests(
                        p_search => $1,
                        p_valid_id_type => $2::kubo.valid_id_type,
                        p_limit => $3,
                        p_offset => $4
                  )
                  `,
                  [
                        search ?? null,
                        validIdType ?? null,
                        pagination.limit,
                        pagination.offset,
                  ],
            );
            return result.rows;
      } catch (error: any) {
            logger.error("Failed to search guests in database", {
                  message: error.message,
                  stack: error.stack,
            });
            throw mapDatabaseError(error, "Failed to search guests in database");
      }
};
