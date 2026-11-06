import bcrypt from "bcrypt";
import type { PoolClient } from "pg";
import { db } from "../config/connectDB";
import { ADMINISTRATOR_ROLE, STAFF_ROLE } from "../utils/role-names";

/**
 * Seeds a development database with demo accounts and resort inventory.
 *
 * The script is additive and idempotent: rows are matched by their natural
 * unique keys (`role_name`, `username`, `type_name`, `kubo_number`, and the
 * case-insensitive catalog name) and existing rows are never modified or
 * deleted. Re-running it is safe and reports what was inserted or skipped.
 *
 * Direct inserts are used instead of the stored procedures because the first
 * administrator has no acting employee to satisfy the audit routines.
 *
 * Business rules: role names are the canonical lowercase values (BR-001), and
 * at most one active Administrator may exist (BR-006). If another active
 * administrator is already present, the sample `admin` account is skipped.
 *
 * Run with `npm run db:seed` from `backend/`, after migrations have applied.
 */

const SALT_ROUNDS = 12;

interface Totals {
      inserted: number;
      skipped: number;
}

interface AccountSpec {
      username: string;
      password: string;
      firstName: string;
      lastName: string;
      roleName: typeof ADMINISTRATOR_ROLE | typeof STAFF_ROLE;
}

interface KuboTypeSpec {
      typeName: string;
      capacity: number;
      pricePerNight: number;
      description: string;
}

interface KuboSpec {
      kuboNumber: string;
      typeName: string;
}

interface CatalogSpec {
      chargeType: string;
      name: string;
      description: string;
      unitPrice: number;
}

const ROLES = [
      {
            name: ADMINISTRATOR_ROLE,
            description:
                  "Oversees administrative operations of the resort reservation system.",
      },
      {
            name: STAFF_ROLE,
            description: "Oversees reservation operations of the resort.",
      },
] as const;

const ACCOUNTS: AccountSpec[] = [
      {
            username: "admin",
            password: "Admin@123",
            firstName: "System",
            lastName: "Administrator",
            roleName: ADMINISTRATOR_ROLE,
      },
      {
            username: "staff",
            password: "Staff@123",
            firstName: "Front",
            lastName: "Desk",
            roleName: STAFF_ROLE,
      },
];

const KUBO_TYPES: KuboTypeSpec[] = [
      {
            typeName: "Standard Kubo",
            capacity: 3,
            pricePerNight: 2000.0,
            description:
                  "Basic Kubo accommodation suitable for small groups.",
      },
      {
            typeName: "Deluxe Kubo",
            capacity: 4,
            pricePerNight: 3800.0,
            description:
                  "Comfortable Kubo with upgraded furnishings and a private veranda.",
      },
      {
            typeName: "Family Kubo",
            capacity: 6,
            pricePerNight: 4500.0,
            description: "Spacious Kubo suitable for families and small groups.",
      },
      {
            typeName: "Premium Kubo",
            capacity: 8,
            pricePerNight: 6000.0,
            description:
                  "Large Kubo with premium amenities and additional sleeping space.",
      },
];

const KUBOS: KuboSpec[] = [
      { kuboNumber: "K-01", typeName: "Standard Kubo" },
      { kuboNumber: "K-02", typeName: "Standard Kubo" },
      { kuboNumber: "K-03", typeName: "Deluxe Kubo" },
      { kuboNumber: "K-04", typeName: "Deluxe Kubo" },
      { kuboNumber: "K-05", typeName: "Family Kubo" },
      { kuboNumber: "K-06", typeName: "Family Kubo" },
      { kuboNumber: "K-07", typeName: "Premium Kubo" },
      { kuboNumber: "K-08", typeName: "Premium Kubo" },
];

const CATALOG_ITEMS: CatalogSpec[] = [
      {
            chargeType: "ExtraBed",
            name: "Extra Bed",
            description: "Rollaway bed for one additional guest.",
            unitPrice: 500.0,
      },
      {
            chargeType: "ExtraBed",
            name: "Extra Towel",
            description: "Additional bath towel.",
            unitPrice: 75.0,
      },
      {
            chargeType: "ExtraPerson",
            name: "Extra Person",
            description: "Additional guest beyond the kubo capacity.",
            unitPrice: 400.0,
      },
      {
            chargeType: "LateCheckOut",
            name: "Late Check-Out",
            description: "Extended check-out beyond the standard schedule.",
            unitPrice: 300.0,
      },
      {
            chargeType: "FoodAndBeverage",
            name: "Breakfast",
            description: "Breakfast plate per guest.",
            unitPrice: 250.0,
      },
      {
            chargeType: "Transportation",
            name: "Airport Transfer",
            description: "One-way airport transfer.",
            unitPrice: 800.0,
      },
];

const log = (message: string) => console.log(`[seed] ${message}`);

const bump = (totals: Map<string, Totals>, group: string, inserted: boolean) => {
      const entry = totals.get(group) ?? { inserted: 0, skipped: 0 };

      if (inserted) {
            entry.inserted += 1;
      } else {
            entry.skipped += 1;
      }

      totals.set(group, entry);
};

const seedRoles = async (client: PoolClient, totals: Map<string, Totals>) => {
      for (const role of ROLES) {
            const result = await client.query(
                  `
                  INSERT INTO kubo.role (role_name, description)
                  VALUES ($1, $2)
                  ON CONFLICT (role_name) DO NOTHING
                  RETURNING role_id
                  `,
                  [role.name, role.description],
            );

            bump(totals, "roles", (result.rowCount ?? 0) > 0);
      }
};

const seedAccounts = async (client: PoolClient, totals: Map<string, Totals>) => {
      for (const account of ACCOUNTS) {
            const existing = await client.query(
                  `SELECT 1 FROM kubo.employee WHERE username = $1`,
                  [account.username],
            );

            if ((existing.rowCount ?? 0) > 0) {
                  log(
                        `Skipped employee "${account.username}": username already exists.`,
                  );
                  bump(totals, "employees", false);
                  continue;
            }

            if (account.roleName === ADMINISTRATOR_ROLE) {
                  const activeAdmin = await client.query(
                        `
                        SELECT e.username
                        FROM kubo.employee AS e
                        JOIN kubo.role AS r ON r.role_id = e.role_id
                        WHERE r.role_name = $1
                          AND e.status = 'Active'
                        LIMIT 1
                        `,
                        [ADMINISTRATOR_ROLE],
                  );

                  if ((activeAdmin.rowCount ?? 0) > 0) {
                        const activeUsername = activeAdmin.rows[0].username;
                        log(
                              `Skipped sample administrator: active administrator "${activeUsername}" already exists. ` +
                                    `Deactivate it and re-run to create ${account.username}/${account.password}.`,
                        );
                        bump(totals, "employees", false);
                        continue;
                  }
            }

            const role = await client.query(
                  `SELECT role_id FROM kubo.role WHERE role_name = $1`,
                  [account.roleName],
            );
            const roleId = role.rows[0]?.role_id;

            if (!roleId) {
                  throw new Error(
                        `Role "${account.roleName}" is missing; cannot seed "${account.username}".`,
                  );
            }

            const passwordHash = await bcrypt.hash(
                  account.password,
                  SALT_ROUNDS,
            );

            await client.query(
                  `
                  INSERT INTO kubo.employee (
                        role_id,
                        first_name,
                        last_name,
                        username,
                        password_hash,
                        status
                  )
                  VALUES ($1, $2, $3, $4, $5, 'Active')
                  `,
                  [
                        roleId,
                        account.firstName,
                        account.lastName,
                        account.username,
                        passwordHash,
                  ],
            );

            log(
                  `Inserted employee "${account.username}" (${account.roleName}) with password "${account.password}".`,
            );
            bump(totals, "employees", true);
      }
};

const seedKuboTypes = async (
      client: PoolClient,
      totals: Map<string, Totals>,
) => {
      for (const kuboType of KUBO_TYPES) {
            const result = await client.query(
                  `
                  INSERT INTO kubo.kubo_type (
                        type_name,
                        capacity,
                        price_per_night,
                        description
                  )
                  SELECT $1::text, $2::integer, $3::numeric, $4::text
                  WHERE NOT EXISTS (
                        SELECT 1
                        FROM kubo.kubo_type
                        WHERE lower(type_name) = lower($1::text)
                  )
                  RETURNING kubo_type_id
                  `,
                  [
                        kuboType.typeName,
                        kuboType.capacity,
                        kuboType.pricePerNight,
                        kuboType.description,
                  ],
            );

            bump(totals, "kubo types", (result.rowCount ?? 0) > 0);
      }
};

const seedKubos = async (client: PoolClient, totals: Map<string, Totals>) => {
      for (const kubo of KUBOS) {
            const kuboType = await client.query(
                  `
                  SELECT kubo_type_id
                  FROM kubo.kubo_type
                  WHERE lower(type_name) = lower($1)
                  LIMIT 1
                  `,
                  [kubo.typeName],
            );
            const kuboTypeId = kuboType.rows[0]?.kubo_type_id;

            if (!kuboTypeId) {
                  throw new Error(
                        `Kubo type "${kubo.typeName}" is missing; cannot seed ${kubo.kuboNumber}.`,
                  );
            }

            const result = await client.query(
                  `
                  INSERT INTO kubo.kubo (kubo_type_id, kubo_number, status)
                  VALUES ($1, $2, 'Available')
                  ON CONFLICT (kubo_number) DO NOTHING
                  RETURNING kubo_id
                  `,
                  [kuboTypeId, kubo.kuboNumber],
            );

            bump(totals, "kubos", (result.rowCount ?? 0) > 0);
      }
};

const seedCatalog = async (client: PoolClient, totals: Map<string, Totals>) => {
      for (const item of CATALOG_ITEMS) {
            const result = await client.query(
                  `
                  INSERT INTO kubo.additional_charge_catalog (
                        charge_type,
                        name,
                        description,
                        unit_price,
                        is_active
                  )
                  SELECT $1::kubo.charge_type, $2::text, $3::text, $4::numeric, TRUE
                  WHERE NOT EXISTS (
                        SELECT 1
                        FROM kubo.additional_charge_catalog
                        WHERE lower(name) = lower($2::text)
                  )
                  RETURNING catalog_id
                  `,
                  [
                        item.chargeType,
                        item.name,
                        item.description,
                        item.unitPrice,
                  ],
            );

            bump(totals, "catalog items", (result.rowCount ?? 0) > 0);
      }
};

const seed = async (client: PoolClient): Promise<Map<string, Totals>> => {
      const totals = new Map<string, Totals>();

      await seedRoles(client, totals);
      await seedAccounts(client, totals);
      await seedKuboTypes(client, totals);
      await seedKubos(client, totals);
      await seedCatalog(client, totals);

      return totals;
};

const main = async () => {
      let client: PoolClient | null = null;

      try {
            client = await db.connect();
            await client.query("BEGIN");

            const totals = await seed(client);

            await client.query("COMMIT");

            log("Sample data ready.");
            for (const [group, counts] of totals) {
                  log(
                        `${group}: ${counts.inserted} inserted, ${counts.skipped} skipped`,
                  );
            }
            log(
                  "Demo credentials for accounts created by this run: " +
                        "admin / Admin@123, staff / Staff@123",
            );
      } catch (error) {
            if (client) {
                  try {
                        await client.query("ROLLBACK");
                  } catch {
                        // Ignore rollback failures; the original error is reported.
                  }
            }

            throw error;
      } finally {
            client?.release();
            await db.end();
      }
};

main().catch((error) => {
      console.error(
            "[seed] Failed:",
            error instanceof Error ? error.message : error,
      );
      process.exitCode = 1;
});
