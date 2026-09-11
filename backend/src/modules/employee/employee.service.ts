import {
      getAllEmployees,
      getEmployeeById,
      createEmployee,
      updateEmployee,
      deleteEmployee,
      Employee,
      NewEmployee,
} from "./repositories/employee.queries";
import { employeeRelations } from "./repositories/employee.relations";
import { Pagination } from "../../utils/pagination";
import { getPaginationMeta } from "../../utils/pagination";

export const getAllEmployeesService = async (pagination?: Pagination): Promise<{ data: Employee[]; meta?: any }> => {
      const data = await getAllEmployees();
      if (pagination) {
            const total = data.length; // Placeholder; replace with count query
            const meta = getPaginationMeta(pagination, total);
            return { data, meta };
      }
      return { data };
};

export const getEmployeeByIdService = async (employeeId: string): Promise<Employee | undefined> => {
      return await getEmployeeById(employeeId);
};

export const createEmployeeService = async (data: NewEmployee): Promise<Employee> => {
      return await createEmployee(data);
};

export const updateEmployeeService = async (employeeId: string, data: Partial<NewEmployee>): Promise<Employee | undefined> => {
      return await updateEmployee(employeeId, data);
};

export const deleteEmployeeService = async (employeeId: string): Promise<void> => {
      await deleteEmployee(employeeId);
};

export const getRoleForEmployeeService = async (roleId: string): Promise<any> => {
      return await employeeRelations.getRoleForEmployee(roleId);
};
