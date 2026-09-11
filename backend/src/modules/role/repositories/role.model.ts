import { pgTable, uuid, varchar } from "drizzle-orm/pg-core";

export const ROLES = ["admin", "staff"] as const;

export const role = pgTable("role", {
      roleId: uuid("role_id").defaultRandom().notNull(),
      roleName: varchar("role_name", { length: 20, enum: ROLES })
            .notNull()
            .unique(),
      roleDescription: varchar("role_description", { length: 255 }),
});
