import { Router } from "express";
import {
      createEmployeeController,
      getAllEmployeesController,
      getEmployeeByIdController,
      updateEmployeeController,
      deleteEmployeeController,
} from "./employee.controllers";
import {
      CreateEmployeeSchema,
      UpdateEmployeeSchame,
} from "./repository/employee.schema";
import { validateBody, requireUuidParam } from "../../utils/http";

const router = Router();

router.post("/", validateBody(CreateEmployeeSchema), createEmployeeController);
router.get("/", getAllEmployeesController);
router.get(
      "/:employeeId",
      requireUuidParam("employeeId"),
      getEmployeeByIdController,
);
router.patch(
      "/:employeeId",
      requireUuidParam("employeeId"),
      validateBody(UpdateEmployeeSchame),
      updateEmployeeController,
);
router.delete(
      "/:employeeId",
      requireUuidParam("employeeId"),
      deleteEmployeeController,
);

export default router;
