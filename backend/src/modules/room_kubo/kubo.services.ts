import {
      createRoom,
      getRooms,
      getRoomById,
      updateRoom,
      deleteRoom,
      searchRooms,
      getRoomsByType,
} from "./repository/kubo.repository";
import { AppError } from "../../utils/http";
import logger from "../../utils/logger";
import type { CreateKuboDTO, UpdateKuboDTO } from "./repository/kubo.schema";
import type { Pagination } from "../../utils/pagination";

export const createRoomService = async (data: CreateKuboDTO) => {
      // No uniqueness checks defined
      return createRoom(data);
};

export const getAllRoomsService = async () => {
      return getRooms();
};

export const getRoomByIdService = async (roomId: string) => {
      const room = await getRoomById(roomId);
      if (!room) {
            throw new AppError(404, "Room not found");
      }
      return room;
};

export const updateRoomService = async (data: UpdateKuboDTO) => {
      const existing = await getRoomById(data.kuboId);
      if (!existing) {
            throw new AppError(404, "Room not found");
      }
      return updateRoom(data);
};

export const deleteRoomService = async (roomId: string) => {
      const existing = await getRoomById(roomId);
      if (!existing) {
            throw new AppError(404, "Room not found");
      }
      await deleteRoom(roomId);
};

export const searchRoomsService = async (params: {
      roomTypeId?: string;
      status?: string;
      search?: string;
      pagination: Pagination;
}) => {
      return searchRooms({
            roomTypeId: params.roomTypeId,
            status: params.status,
            search: params.search,
            pagination: {
                  limit: params.pagination.limit,
                  offset: params.pagination.offset,
            },
      });
};

export const getRoomsByTypeService = async (roomTypeId: string) => {
      return getRoomsByType(roomTypeId);
};
