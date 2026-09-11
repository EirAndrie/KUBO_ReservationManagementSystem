// Employee Queries using Drizzle ORM
// Provides CRUD operations for the Employee entity.

import { db } from "../../../config/connectDB";
import { eq } from "drizzle-orm";
import { employee } from "./employee.model";
import type { InferModel } from "drizzle-orm";

export type Employee = InferModel<typeof employee>;
export type NewEmployee = InferModel<typeof employee, "insert">;

export const getAllEmployees = async (): Promise<Employee[]> => {
      return await db.select().from(employee);
};

export const getEmployeeById = async (employeeId: string): Promise<Employee | undefined> => {
      const result = await db
            .select()
            .from(employee)
            .where(eq(employee.employeeId, employeeId))
            .limit(1);
      return result[0];
};

export const createEmployee = async (data: NewEmployee): Promise<Employee> => {
      const [created] = await db.insert(employee).values(data).returning();
      return created;
};

export const updateEmployee = async (employeeId: string, data: Partial<NewEmployee>): Promise<Employee | undefined> => {
      const result = await db
            .update(employee)
            .set(data)
            .where(eq(employee.employeeId, employeeId))
            .returning();
      return result[0];
};

export const deleteEmployee = async (employeeId: string): Promise<void> => {
      await db.delete(employee).where(eq(employee.employeeId, employeeId));
};
