import type {
      CreateCatalogItemDTO,
      UpdateCatalogItemDTO,
      ApplyCatalogChargeDTO,
      CustomChargeRequestDTO,
      ApproveChargeRequestDTO,
      RejectChargeRequestDTO,
      WithdrawChargeRequestDTO,
      AddChargeCorrectionDTO,
      AdditionalChargeCatalogResponseDTO,
      AdditionalChargeResponseDTO,
      AdditionalChargeRequestResponseDTO,
} from "./additional-charge.schema";
import { db } from "../../../config/connectDB";
import { mapDatabaseError } from "../../../utils/http";
import logger from "../../../utils/logger";

const toDateOnly = (date: Date) => date.toISOString().slice(0, 10);

export const createCatalogItem = async (
      data: CreateCatalogItemDTO,
): Promise<AdditionalChargeCatalogResponseDTO> => {
      try {
            const result = await db.query(
                  `
                  SELECT *
                  FROM kubo_additional_charges_management.fn_create_catalog_item(
                        p_charge_type => $1::kubo.charge_type,
                        p_name => $2,
                        p_description => $3,
                        p_unit_price => $4,
                        p_is_active => $5,
                        p_employee_id => $6
                  )
                  `,
                  [
                        data.chargeType,
                        data.name,
                        data.description ?? null,
                        data.unitPrice,
                        data.isActive,
                        data.employeeId,
                  ],
            );
            return result.rows[0];
      } catch (error: any) {
            logger.error("Failed to create additional-charge catalog item", {
                  message: error.message,
                  stack: error.stack,
            });
            throw mapDatabaseError(
                  error,
                  "Failed to create additional-charge catalog item",
            );
      }
};

export const getCatalogItems = async (params: {
      search?: string;
      activeOnly: boolean;
      pagination: { limit: number; offset: number };
}): Promise<AdditionalChargeCatalogResponseDTO[]> => {
      try {
            const result = await db.query(
                  `
                  SELECT *
                  FROM kubo_additional_charges_management.fn_get_catalog(
                        p_search => $1,
                        p_active_only => $2,
                        p_limit => $3,
                        p_offset => $4
                  )
                  `,
                  [
                        params.search ?? null,
                        params.activeOnly,
                        params.pagination.limit,
                        params.pagination.offset,
                  ],
            );
            return result.rows;
      } catch (error: any) {
            logger.error("Failed to fetch additional-charge catalog", {
                  message: error.message,
                  stack: error.stack,
            });
            throw mapDatabaseError(
                  error,
                  "Failed to fetch additional-charge catalog",
            );
      }
};

export const getCatalogItemById = async (
      catalogId: string,
): Promise<AdditionalChargeCatalogResponseDTO | null> => {
      try {
            const result = await db.query(
                  `
                  SELECT *
                  FROM kubo_additional_charges_management.fn_get_catalog_item_by_id($1)
                  `,
                  [catalogId],
            );
            return result.rows[0] ?? null;
      } catch (error: any) {
            logger.error("Failed to get additional-charge catalog item", {
                  message: error.message,
                  stack: error.stack,
            });
            throw mapDatabaseError(
                  error,
                  "Failed to get additional-charge catalog item",
            );
      }
};

export const updateCatalogItem = async (
      catalogId: string,
      data: UpdateCatalogItemDTO,
): Promise<AdditionalChargeCatalogResponseDTO | null> => {
      try {
            const result = await db.query(
                  `
                  SELECT *
                  FROM kubo_additional_charges_management.fn_update_catalog_item(
                        p_catalog_id => $1,
                        p_charge_type => $2::kubo.charge_type,
                        p_name => $3,
                        p_description => $4,
                        p_unit_price => $5,
                        p_is_active => $6,
                        p_employee_id => $7
                  )
                  `,
                  [
                        catalogId,
                        data.chargeType ?? null,
                        data.name ?? null,
                        data.description === null ? "" : data.description ?? null,
                        data.unitPrice ?? null,
                        data.isActive ?? null,
                        data.employeeId,
                  ],
            );
            return result.rows[0] ?? null;
      } catch (error: any) {
            logger.error("Failed to update additional-charge catalog item", {
                  message: error.message,
                  stack: error.stack,
            });
            throw mapDatabaseError(
                  error,
                  "Failed to update additional-charge catalog item",
            );
      }
};

export const deleteCatalogItem = async (
      catalogId: string,
      employeeId: string,
): Promise<boolean> => {
      try {
            const result = await db.query(
                  `
                  SELECT kubo_additional_charges_management.fn_delete_catalog_item($1, $2) AS deleted
                  `,
                  [catalogId, employeeId],
            );
            return result.rows[0]?.deleted === true;
      } catch (error: any) {
            logger.error("Failed to delete additional-charge catalog item", {
                  message: error.message,
                  stack: error.stack,
            });
            throw mapDatabaseError(
                  error,
                  "Failed to delete additional-charge catalog item",
            );
      }
};

export const applyCatalogCharge = async (
      reservationId: string,
      data: ApplyCatalogChargeDTO,
): Promise<AdditionalChargeResponseDTO> => {
      try {
            const result = await db.query(
                  `
                  SELECT *
                  FROM kubo_additional_charges_management.fn_record_additional_charge(
                        p_reservation_id => $1,
                        p_employee_id => $2,
                        p_catalog_id => $3,
                        p_quantity => $4
                  )
                  `,
                  [reservationId, data.employeeId, data.catalogId, data.quantity],
            );
            return result.rows[0];
      } catch (error: any) {
            logger.error("Failed to apply catalog charge", {
                  message: error.message,
                  stack: error.stack,
            });
            throw mapDatabaseError(error, "Failed to apply catalog charge");
      }
};

export const getChargesByReservation = async (
      reservationId: string,
): Promise<AdditionalChargeResponseDTO[]> => {
      try {
            const result = await db.query(
                  `
                  SELECT *
                  FROM kubo_additional_charges_management.fn_get_reservation_charges($1)
                  `,
                  [reservationId],
            );
            return result.rows;
      } catch (error: any) {
            logger.error("Failed to fetch reservation charges", {
                  message: error.message,
                  stack: error.stack,
            });
            throw mapDatabaseError(error, "Failed to fetch reservation charges");
      }
};

export const getChargeById = async (
      chargeId: string,
): Promise<AdditionalChargeResponseDTO | null> => {
      try {
            const result = await db.query(
                  `
                  SELECT *
                  FROM kubo_additional_charges_management.fn_get_charge_by_id($1)
                  `,
                  [chargeId],
            );
            return result.rows[0] ?? null;
      } catch (error: any) {
            logger.error("Failed to get applied charge", {
                  message: error.message,
                  stack: error.stack,
            });
            throw mapDatabaseError(error, "Failed to get applied charge");
      }
};

export const getCharges = async (params: {
      reservationId?: string;
      employeeId?: string;
      chargeType?: string;
      createdFrom?: Date;
      createdTo?: Date;
      pagination: { limit: number; offset: number };
}): Promise<AdditionalChargeResponseDTO[]> => {
      try {
            const result = await db.query(
                  `
                  SELECT *
                  FROM kubo_additional_charges_management.fn_get_charges(
                        p_reservation_id => $1,
                        p_employee_id => $2,
                        p_charge_type => $3::kubo.charge_type,
                        p_created_from => $4::date,
                        p_created_to => $5::date,
                        p_limit => $6,
                        p_offset => $7
                  )
                  `,
                  [
                        params.reservationId ?? null,
                        params.employeeId ?? null,
                        params.chargeType ?? null,
                        params.createdFrom
                              ? toDateOnly(params.createdFrom)
                              : null,
                        params.createdTo ? toDateOnly(params.createdTo) : null,
                        params.pagination.limit,
                        params.pagination.offset,
                  ],
            );
            return result.rows;
      } catch (error: any) {
            logger.error("Failed to fetch applied charges", {
                  message: error.message,
                  stack: error.stack,
            });
            throw mapDatabaseError(error, "Failed to fetch applied charges");
      }
};

export const deleteCharge = async (
      chargeId: string,
      employeeId: string,
): Promise<boolean> => {
      try {
            const result = await db.query(
                  `
                  SELECT kubo_additional_charges_management.fn_delete_additional_charge($1, $2) AS deleted
                  `,
                  [chargeId, employeeId],
            );
            return result.rows[0]?.deleted === true;
      } catch (error: any) {
            logger.error("Failed to delete applied charge", {
                  message: error.message,
                  stack: error.stack,
            });
            throw mapDatabaseError(error, "Failed to delete applied charge");
      }
};

export const addChargeCorrection = async (
      chargeId: string,
      data: AddChargeCorrectionDTO,
): Promise<AdditionalChargeResponseDTO> => {
      try {
            const result = await db.query(
                  `
                  SELECT *
                  FROM kubo_additional_charges_management.fn_add_charge_correction(
                        p_charge_id => $1,
                        p_employee_id => $2,
                        p_charge_type => $3::kubo.charge_type,
                        p_quantity => $4,
                        p_unit_amount => $5,
                        p_reason => $6
                  )
                  `,
                  [
                        chargeId,
                        data.employeeId,
                        data.chargeType,
                        data.quantity,
                        data.unitAmount,
                        data.reason,
                  ],
            );
            return result.rows[0];
      } catch (error: any) {
            logger.error("Failed to add charge correction", {
                  message: error.message,
                  stack: error.stack,
            });
            throw mapDatabaseError(error, "Failed to add charge correction");
      }
};

export const createChargeRequest = async (
      reservationId: string,
      data: CustomChargeRequestDTO,
): Promise<AdditionalChargeRequestResponseDTO> => {
      try {
            const result = await db.query(
                  `
                  SELECT *
                  FROM kubo_additional_charges_management.fn_create_charge_request(
                        p_reservation_id => $1,
                        p_requested_by => $2,
                        p_description => $3,
                        p_quantity => $4,
                        p_proposed_unit_amount => $5
                  )
                  `,
                  [
                        reservationId,
                        data.employeeId,
                        data.description,
                        data.quantity,
                        data.proposedUnitAmount,
                  ],
            );
            return result.rows[0];
      } catch (error: any) {
            logger.error("Failed to create custom charge request", {
                  message: error.message,
                  stack: error.stack,
            });
            throw mapDatabaseError(
                  error,
                  "Failed to create custom charge request",
            );
      }
};

export const getChargeRequests = async (params: {
      status?: string;
      reservationId?: string;
      requestedBy?: string;
      pagination: { limit: number; offset: number };
}): Promise<AdditionalChargeRequestResponseDTO[]> => {
      try {
            const result = await db.query(
                  `
                  SELECT *
                  FROM kubo_additional_charges_management.fn_get_charge_requests(
                        p_status => $1::kubo.charge_request_status,
                        p_reservation_id => $2,
                        p_requested_by => $3,
                        p_limit => $4,
                        p_offset => $5
                  )
                  `,
                  [
                        params.status ?? null,
                        params.reservationId ?? null,
                        params.requestedBy ?? null,
                        params.pagination.limit,
                        params.pagination.offset,
                  ],
            );
            return result.rows;
      } catch (error: any) {
            logger.error("Failed to fetch custom charge requests", {
                  message: error.message,
                  stack: error.stack,
            });
            throw mapDatabaseError(
                  error,
                  "Failed to fetch custom charge requests",
            );
      }
};

export const getChargeRequestById = async (
      requestId: string,
): Promise<AdditionalChargeRequestResponseDTO | null> => {
      try {
            const result = await db.query(
                  `
                  SELECT *
                  FROM kubo_additional_charges_management.fn_get_charge_request_by_id($1)
                  `,
                  [requestId],
            );
            return result.rows[0] ?? null;
      } catch (error: any) {
            logger.error("Failed to get custom charge request", {
                  message: error.message,
                  stack: error.stack,
            });
            throw mapDatabaseError(
                  error,
                  "Failed to get custom charge request",
            );
      }
};

export const approveChargeRequest = async (
      requestId: string,
      data: ApproveChargeRequestDTO,
): Promise<AdditionalChargeRequestResponseDTO | null> => {
      try {
            const result = await db.query(
                  `
                  SELECT *
                  FROM kubo_additional_charges_management.fn_approve_charge_request(
                        p_request_id => $1,
                        p_reviewed_by => $2,
                        p_approved_unit_amount => $3,
                        p_reason => $4
                  )
                  `,
                  [
                        requestId,
                        data.employeeId,
                        data.approvedUnitAmount ?? null,
                        data.reason ?? null,
                  ],
            );
            return result.rows[0] ?? null;
      } catch (error: any) {
            logger.error("Failed to approve custom charge request", {
                  message: error.message,
                  stack: error.stack,
            });
            throw mapDatabaseError(
                  error,
                  "Failed to approve custom charge request",
            );
      }
};

export const rejectChargeRequest = async (
      requestId: string,
      data: RejectChargeRequestDTO,
): Promise<AdditionalChargeRequestResponseDTO | null> => {
      try {
            const result = await db.query(
                  `
                  SELECT *
                  FROM kubo_additional_charges_management.fn_reject_charge_request($1, $2, $3)
                  `,
                  [requestId, data.employeeId, data.reason],
            );
            return result.rows[0] ?? null;
      } catch (error: any) {
            logger.error("Failed to reject custom charge request", {
                  message: error.message,
                  stack: error.stack,
            });
            throw mapDatabaseError(
                  error,
                  "Failed to reject custom charge request",
            );
      }
};

export const withdrawChargeRequest = async (
      requestId: string,
      data: WithdrawChargeRequestDTO,
): Promise<AdditionalChargeRequestResponseDTO | null> => {
      try {
            const result = await db.query(
                  `
                  SELECT *
                  FROM kubo_additional_charges_management.fn_withdraw_charge_request($1, $2)
                  `,
                  [requestId, data.employeeId],
            );
            return result.rows[0] ?? null;
      } catch (error: any) {
            logger.error("Failed to withdraw custom charge request", {
                  message: error.message,
                  stack: error.stack,
            });
            throw mapDatabaseError(
                  error,
                  "Failed to withdraw custom charge request",
            );
      }
};
