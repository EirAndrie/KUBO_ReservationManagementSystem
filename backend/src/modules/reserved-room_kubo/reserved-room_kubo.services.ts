import {
      assignKubo,
      getReservedKubos,
      getReservedKubo,
      updateReservedKubo,
      deleteReservedKubo,
      checkInReservedKubo,
      checkOutReservedKubo,
      approveEarlyCheckIn,
} from "./repository/reserved-kubo.repository";
import { AppError } from "../../utils/http";
import type {
      CreateReservedKuboDTO,
      UpdateReservedKuboDTO,
      WithActor,
} from "./repository/reserved-kubo.schema";

// Checked
export const assignKuboService = async (
      reservationId: string,
      data: WithActor<CreateReservedKuboDTO>,
) => {
      const assignment = await assignKubo(reservationId, data);
      if (!assignment) {
            throw new AppError(404, "Reserved kubo not found");
      }
      return assignment;
};

// Checked
export const getReservedKubosService = async (reservationId: string) => {
      return getReservedKubos(reservationId);
};

// Checked
export const getReservedKuboService = async (
      reservationId: string,
      kuboId: string,
) => {
      const assignment = await getReservedKubo(reservationId, kuboId);
      if (!assignment) {
            throw new AppError(404, "Reserved kubo not found");
      }
      return assignment;
};

// Checked
export const updateReservedKuboService = async (
      reservationId: string,
      kuboId: string,
      data: WithActor<UpdateReservedKuboDTO>,
) => {
      const existing = await getReservedKubo(reservationId, kuboId);
      if (!existing) {
            throw new AppError(404, "Reserved kubo not found");
      }

      const assignment = await updateReservedKubo(
            reservationId,
            kuboId,
            data,
      );
      if (!assignment) {
            throw new AppError(404, "Reserved kubo not found");
      }
      return assignment;
};

// Checked
export const deleteReservedKuboService = async (
      reservationId: string,
      kuboId: string,
      employeeId: string,
) => {
      const existing = await getReservedKubo(reservationId, kuboId);
      if (!existing) {
            throw new AppError(404, "Reserved kubo not found");
      }

      const deleted = await deleteReservedKubo(reservationId, kuboId, employeeId);
      if (!deleted) {
            throw new AppError(404, "Reserved kubo not found");
      }
};

// Checked
export const checkInReservedKuboService = async (
      reservationId: string,
      kuboId: string,
      employeeId: string,
) => {
      const assignment = await checkInReservedKubo(reservationId, kuboId, employeeId);
      if (!assignment) {
            throw new AppError(404, "Reserved kubo not found");
      }
      return assignment;
};

// Checked
export const checkOutReservedKuboService = async (
      reservationId: string,
      kuboId: string,
      employeeId: string,
) => {
      const assignment = await checkOutReservedKubo(reservationId, kuboId, employeeId);
      if (!assignment) {
            throw new AppError(404, "Reserved kubo not found");
      }
      return assignment;
};

// Checked
export const approveEarlyCheckInService = async (
      reservationId: string,
      kuboId: string,
      employeeId: string,
) => {
      const assignment = await approveEarlyCheckIn(reservationId, kuboId, employeeId);
      if (!assignment) {
            throw new AppError(404, "Reserved kubo not found");
      }
      return assignment;
};
