import type { Request, Response } from "express";
import type {
      CreateEmployeeDTO,
      UpdateEmployeeDTO,
      ResetEmployeePasswordDTO,
} from "./repository/employee.schema";
import { EmployeeFilterSchema } from "./repository/employee.schema";
import { AppError, getPagination, handleControllerError } from "../../utils/http";
import logger from "../../utils/logger";
import {
      createEmployeeService,
      getAllEmployeesService,
      getEmployeeByIdService,
      updateEmployeeService,
      deleteEmployeeService,
      resetEmployeePasswordService,
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

            const filters = EmployeeFilterSchema.safeParse({
                  role: req.query.role,
                  status: req.query.status,
                  search: req.query.search,
            });

            if (!filters.success) {
                  throw new AppError(
                        400,
                        filters.error.issues
                              .map((issue) =>
                                    issue.path.length
                                          ? `${issue.path.join(".")}: ${issue.message}`
                                          : issue.message,
                              )
                              .join("; "),
                  );
            }

            const employees = await getAllEmployeesService(
                  filters.data,
                  pagination,
            );

            res.status(200).json({
                  success: true,
                  count: employees.length,
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
            const employeeId = String(req.params.employeeId)
            const employees = await getEmployeeByIdService(employeeId);

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
            const employeeId = String(req.params.employeeId);
            const data = req.body as UpdateEmployeeDTO;
            const employees = await updateEmployeeService(employeeId, data);

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

export const resetEmployeePasswordController = async (
      req: Request,
      res: Response,
) => {
      try {
            const employeeId = String(req.params.employeeId);
            const data = req.body as ResetEmployeePasswordDTO;
            const employees = await resetEmployeePasswordService(
                  employeeId,
                  data.password,
            );

            res.status(200).json({
                  success: true,
                  message: "Successfully reset Employee password",
                  employees,
            });
      } catch (error: any) {
            logger.error("Failed to reset Employee password", {
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
