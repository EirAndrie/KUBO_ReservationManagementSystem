import type { Request, Response } from "express";
import type {
      CreateEmployeeDTO,
      UpdateEmployeeDTO,
} from "./repository/employee.schema";
import { handleControllerError } from "../../utils/http";
import logger from "../../utils/logger";
import { getPagination } from "../../utils/http";
import {
      createEmployeeService,
      getAllEmployeesService,
      getEmployeeByIdService,
      updateEmployeeService,
      deleteEmployeeService,
      searchEmployeesService,
} from "./employee.services";

export const createEmployeeController = async (req: Request, res: Response) => {
      try {
            const data = req.body as CreateEmployeeDTO;
            const employees = await createEmployeeService(data);

            res.status(201).json({
                  success: true,
                  message: "Employee created successfully",
                  employees,
            });
      } catch (error: any) {
            logger.error("Failed to create Employee", {
                  error: error.message,
                  stack: error.stack,
            });
            handleControllerError(res, error, error.message);
      }
};

export const getAllEmployeesController = async (
      req: Request,
      res: Response,
) => {
      try {
            const pagination = getPagination(req.query);

            const role =
                  typeof req.query.role === "string"
                        ? req.query.role
                        : undefined;
            const status =
                  typeof req.query.status === "string"
                        ? req.query.status
                        : undefined;
            const search =
                  typeof req.query.search === "string"
                        ? req.query.search
                        : undefined;

            let employees;
            if (role || status || search) {
                  employees = await searchEmployeesService({
                        role,
                        status,
                        search,
                        pagination,
                  });
            } else {
                  employees = await getAllEmployeesService();
            }

            res.status(200).json({
                  success: true,
                  message: "Successfully listed employees",
                  employees,
            });
      } catch (error: any) {
            logger.error("Failed to list Employees", {
                  message: error.message,
                  stack: error.stack,
            });
            handleControllerError(res, error, error.message);
      }
};

export const getEmployeeByIdController = async (
      req: Request,
      res: Response,
) => {
      try {
            const employees = await getEmployeeByIdService(
                  req.params.employeeId as string,
            );

            res.status(200).json({
                  success: true,
                  message: "Successfully fetched Employee by its ID",
                  employees,
            });
      } catch (error: any) {
            logger.error("Failed to get Employee by ID", {
                  message: error.message,
                  stack: error.stack,
            });
            handleControllerError(res, error, error.message);
      }
};

export const updateEmployeeController = async (req: Request, res: Response) => {
      try {
            const data = req.body as UpdateEmployeeDTO;
            const employees = await updateEmployeeService({
                  ...data,
                  employeeId: req.params.employeeId as string,
            });

            res.status(200).json({
                  success: true,
                  message: "Successully updated Employee",
                  employees,
            });
      } catch (error: any) {
            logger.error("Failed to update Employee", {
                  message: error.message,
                  stack: error.stack,
            });
            handleControllerError(res, error, error.message);
      }
};

export const deleteEmployeeController = async (req: Request, res: Response) => {
      try {
            const employees = await deleteEmployeeService(
                  req.params.employeeId as string,
            );

            res.status(204).json({
                  success: true,
                  message: "Successfully deleted Employee",
                  employees,
            });
      } catch (error: any) {
            logger.error("Failed to delete Employee", {
                  message: error.message,
                  stack: error.stack,
            });
            handleControllerError(res, error, error.message);
      }
};
