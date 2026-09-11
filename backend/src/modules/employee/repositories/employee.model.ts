import { pgTable, uuid, varchar, timestamp } from "drizzle-orm/pg-core";

export const employee = pgTable("employee", {
      employeeId: uuid("employee_id").defaultRandom().notNull(),
      roleId: varchar("role_id", { length: 36 }).notNull(), // FK to role.roleId
      firstName: varchar("first_name", { length: 50 }).notNull(),
      lastName: varchar("last_name", { length: 50 }).notNull(),
      username: varchar("username", { length: 30 }).notNull().unique(),
      passwordHash: varchar("password_hash", { length: 255 }).notNull(),
      status: varchar("status", { length: 20 }).notNull(),
      createdAt: timestamp("created_at").defaultNow().notNull(),
      updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
