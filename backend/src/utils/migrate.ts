import { db } from "../config/connectDB";
import logger from "./logger";
import path from "path";
import fs from "fs";

/**
 * Simple migrations runner.
 *
 * It expects a directory `src/migrations` containing SQL files whose names start
 * with a sortable timestamp (e.g. `20240920_create_role_schema.sql`).
 *
 * The runner creates a tiny table `schema_migrations` (if it doesn't exist) to
 * keep track of which files have already been applied. On each run it reads the
 * migration directory, sorts the files alphabetically, skips those already
 * recorded, and executes the remaining scripts inside a single transaction.
 */
export const runMigrations = async () => {
      // Ensure the migrations tracking table exists
      await db.query(`
            CREATE TABLE IF NOT EXISTS schema_migrations (
                  id SERIAL PRIMARY KEY,
                  filename TEXT NOT NULL UNIQUE,
                  executed_at TIMESTAMPTZ NOT NULL DEFAULT now()
            );
      `);

      const migrationsDir = path.resolve(__dirname, "../migrations");
      const files = await fs.promises.readdir(migrationsDir);

      // Filter only .sql files and sort them – alphabetical order respects timestamps
      const sqlFiles = files.filter((f) => f.endsWith(".sql")).sort();

      for (const file of sqlFiles) {
            // Check if this migration was already run
            const already = await db.query(
                  "SELECT 1 FROM schema_migrations WHERE filename = $1",
                  [file],
            );
            if ((already.rowCount ?? 0) > 0) {
                  logger.info(`Migration ${file} already executed – skipping`);
                  continue;
            }

            const filePath = path.join(migrationsDir, file);
            const sql = await fs.promises.readFile(filePath, {
                  encoding: "utf8",
            });

            try {
                  await db.query("BEGIN");
                  await db.query(sql);
                  await db.query(
                        "INSERT INTO schema_migrations (filename) VALUES ($1)",
                        [file],
                  );
                  await db.query("COMMIT");
                  logger.info(`Migration ${file} applied successfully`);
            } catch (err: any) {
                  await db.query("ROLLBACK");
                  logger.error(`Failed to apply migration ${file}`, {
                        message: err.message,
                        stack: err.stack,
                  });
                  throw err; // Re‑throw so the app can fail fast
            }
      }
};
