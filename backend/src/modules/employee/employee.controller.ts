import { Request, Response, NextFunction } from "express";
import {
      getAllEmployeesService,
      getEmployeeByIdService,
      createEmployeeService,
      updateEmployeeService,
      deleteEmployeeService,
} from "./employee.service";
import { employeeCreateSchema, employeeUpdateSchema } from "./repositories/employee.validations";
import { getPagination, handleControllerError, validateBody } from "../../utils/http";
import logger from "../../utils/logger";

export const getAllEmployeesController = async (
      _req: Request,
      res: Response,
      next: NextFunction,
) => {
      try {
            const pagination = getPagination(_req.query);
            logger.info("Fetching all employees", { pagination });
            const result = await getAllEmployeesService(pagination);
            res.json(result);
      } catch (err) {
            handleControllerError(res, err);
      }
};

export const getEmployeeByIdController = async (
      req: Request,
      res: Response,
      next: NextFunction,
) => {
      try {
            const employeeId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
            const employee = await getEmployeeByIdService(employeeId);
            if (!employee) {
                  return res.status(404).json({ message: "Employee not found" });
            }
            res.json(employee);
      } catch (err) {
            handleControllerError(res, err);
      }
};

export const createEmployeeController = async (
      req: Request,
      res: Response,
      next: NextFunction,
) => {
      try {
            const data = validateBody(employeeCreateSchema, req.body);
            const newEmployee = await createEmployeeService(data);
            logger.info("Created employee", { employeeId: newEmployee.employeeId });
            res.status(201).json(newEmployee);
      } catch (err) {
            handleControllerError(res, err);
      }
};

export const updateEmployeeController = async (
      req: Request,
      res: Response,
      next: NextFunction,
) => {
      try {
            const data = validateBody(employeeUpdateSchema, req.body);
            const employeeId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
            const updated = await updateEmployeeService(employeeId, data);
            if (!updated) {
                  return res.status(404).json({ message: "Employee not found" });
            }
            logger.info("Updated employee", { employeeId });
            res.json(updated);
      } catch (err) {
            handleControllerError(res, err);
      }
};

export const deleteEmployeeController = async (
      req: Request,
      res: Response,
      next: NextFunction,
) => {
      try {
            const employeeId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
            await deleteEmployeeService(employeeId);
            logger.info("Deleted employee", { employeeId });
            res.status(204).send();
      } catch (err) {
            handleControllerError(res, err);
      }
};
