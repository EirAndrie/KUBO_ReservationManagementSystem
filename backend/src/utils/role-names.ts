/**
 * Canonical business role names.
 *
 * `kubo.role.role_name` stores the lowercase canonical spellings
 * `administrator` and `staff` (enforced by migration
 * `20261106_enforce_canonical_role_names.sql`). Matching against these values
 * is exact: no case folding and no `admin` shorthand.
 */
export const ADMINISTRATOR_ROLE = "administrator";
export const STAFF_ROLE = "staff";

/** Every role name the business allows, in canonical lowercase form. */
export const ROLE_NAMES = [ADMINISTRATOR_ROLE, STAFF_ROLE] as const;

/** A business role name accepted by authentication and authorization. */
export type RoleName = (typeof ROLE_NAMES)[number];

/** Narrows an arbitrary string to a canonical {@link RoleName}. */
export const isRoleName = (value: string): value is RoleName =>
      (ROLE_NAMES as readonly string[]).includes(value);
