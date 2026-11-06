/*
  Migration: 20261106_enforce_canonical_role_names.sql
  ----------------------------------------------------
  Makes `kubo.role.role_name` a closed set of canonical lowercase values:
  'administrator' and 'staff' (BR-001, BR-005).

  - Normalizes existing variants ('Administrator', 'ADMIN', 'admin', ...).
  - Merges duplicate variants by repointing employees to the surviving row.
  - Adds a CHECK constraint so no other spelling can be stored.
  - Tightens kubo_employee_management.is_administrator_role to the exact name.
  - Re-validates role create/update at the database boundary.

  The business role names are enforced case-sensitively from here on. Any
  environment holding an unrelated custom role must resolve it before this
  migration can apply; the migration fails loudly instead of reassigning people.
*/

-- ---------------------------------------------------------------------------
-- 1. Canonicalize existing data and add the database guard
-- ---------------------------------------------------------------------------
DO $migration$
DECLARE
    v_target text;
    v_variants text[];
    v_keep uuid;
    v_dupe uuid;
    v_unknown text;
BEGIN
    IF to_regclass('kubo.role') IS NULL
       OR to_regclass('kubo.employee') IS NULL
       OR to_regnamespace('kubo_employee_management') IS NULL THEN
        RAISE NOTICE 'Role/employee schema is not provisioned; skipping canonical role-name enforcement';
        RETURN;
    END IF;

    FOREACH v_target IN ARRAY ARRAY['administrator', 'staff'] LOOP
        IF v_target = 'administrator' THEN
            v_variants := ARRAY['admin', 'administrator'];
        ELSE
            v_variants := ARRAY['staff'];
        END IF;

        -- Prefer the exact canonical spelling as the survivor.
        SELECT r.role_id
          INTO v_keep
          FROM kubo.role AS r
         WHERE lower(btrim(r.role_name)) = ANY (v_variants)
         ORDER BY (lower(btrim(r.role_name)) = v_target) DESC, r.role_id
         LIMIT 1;

        IF v_keep IS NULL THEN
            CONTINUE;
        END IF;

        FOR v_dupe IN
            SELECT r.role_id
              FROM kubo.role AS r
             WHERE lower(btrim(r.role_name)) = ANY (v_variants)
               AND r.role_id <> v_keep
        LOOP
            UPDATE kubo.employee
               SET role_id = v_keep
             WHERE role_id = v_dupe;

            DELETE FROM kubo.role WHERE role_id = v_dupe;
        END LOOP;

        UPDATE kubo.role
           SET role_name = v_target
         WHERE role_id = v_keep;
    END LOOP;

    SELECT string_agg(DISTINCT role_name, ', ' ORDER BY role_name)
      INTO v_unknown
      FROM kubo.role
     WHERE role_name NOT IN ('administrator', 'staff');

    IF v_unknown IS NOT NULL THEN
        RAISE EXCEPTION
            'Unsupported role name(s) found: %. Resolve them before applying canonical role names.',
            v_unknown
            USING ERRCODE = '22023';
    END IF;

    IF NOT EXISTS (
        SELECT 1
          FROM pg_constraint
         WHERE conname = 'role_name_canonical'
           AND conrelid = 'kubo.role'::regclass
    ) THEN
        ALTER TABLE kubo.role
            ADD CONSTRAINT role_name_canonical
            CHECK (role_name IN ('administrator', 'staff'));
    END IF;
END
$migration$;

-- ---------------------------------------------------------------------------
-- 2. Administrator detection uses the exact canonical name
-- ---------------------------------------------------------------------------
DO $migration$
BEGIN
    IF to_regclass('kubo.role') IS NULL
       OR to_regnamespace('kubo_employee_management') IS NULL THEN
        RAISE NOTICE 'Role/employee schema is not provisioned; skipping is_administrator_role update';
        RETURN;
    END IF;

    EXECUTE $sql$
        CREATE OR REPLACE FUNCTION kubo_employee_management.is_administrator_role(
            p_role_id uuid
        )
        RETURNS boolean
        LANGUAGE sql
        STABLE
        SECURITY DEFINER
        SET search_path TO 'pg_catalog', 'pg_temp'
        AS $function$
        SELECT EXISTS (
            SELECT 1
            FROM kubo.role
            WHERE role_id = p_role_id
              AND role_name = 'administrator'
        );
        $function$
    $sql$;
END
$migration$;

-- ---------------------------------------------------------------------------
-- 3. Role create/update reject anything outside the canonical set
-- ---------------------------------------------------------------------------
DO $migration$
BEGIN
    IF to_regclass('kubo.role') IS NULL
       OR to_regclass('kubo.audit_log') IS NULL
       OR to_regnamespace('kubo_role_management') IS NULL THEN
        RAISE NOTICE 'Role or audit_log is not provisioned; skipping role function redefinition';
        RETURN;
    END IF;

    EXECUTE $sql$
        CREATE OR REPLACE FUNCTION kubo_role_management.create_role(
            p_name text,
            p_desc text,
            p_actor_employee_id uuid DEFAULT NULL
        )
        RETURNS kubo.role
        LANGUAGE plpgsql
        SECURITY DEFINER
        SET search_path TO 'pg_catalog', 'pg_temp'
        AS $function$
        DECLARE
            v_role kubo.role%ROWTYPE;
            v_name text := lower(btrim(p_name));
        BEGIN
            IF v_name IS NULL OR v_name NOT IN ('administrator', 'staff') THEN
                RAISE EXCEPTION 'Role name must be either administrator or staff.'
                    USING ERRCODE = '22023';
            END IF;

            IF p_desc IS NOT NULL AND length(btrim(p_desc)) > 255 THEN
                RAISE EXCEPTION 'Role description cannot exceed 255 characters.'
                    USING ERRCODE = '22023';
            END IF;

            INSERT INTO kubo.role (role_name, description)
            VALUES (v_name, NULLIF(btrim(p_desc), ''))
            RETURNING * INTO v_role;

            PERFORM kubo_audit_management.write_audit_log(
                p_actor_employee_id,
                'Create'::kubo.audit_action,
                'role',
                v_role.role_id,
                format('Created role %s', v_name),
                NULL,
                json_build_object(
                    'role_id', v_role.role_id,
                    'role_name', v_role.role_name,
                    'description', v_role.description
                )
            );

            RETURN v_role;
        EXCEPTION
            WHEN unique_violation THEN
                RAISE EXCEPTION 'Role name already exists.'
                    USING ERRCODE = '23505';
        END;
        $function$
    $sql$;

    EXECUTE $sql$
        CREATE OR REPLACE FUNCTION kubo_role_management.update_role(
            p_id uuid,
            p_name text,
            p_desc text,
            p_actor_employee_id uuid DEFAULT NULL
        )
        RETURNS kubo.role
        LANGUAGE plpgsql
        SECURITY DEFINER
        SET search_path TO 'pg_catalog', 'pg_temp'
        AS $function$
        DECLARE
            v_role kubo.role%ROWTYPE;
            v_name text := NULLIF(lower(btrim(p_name)), '');
            v_desc text := NULLIF(btrim(p_desc), '');
            v_old json;
        BEGIN
            IF p_name IS NOT NULL AND v_name IS NULL THEN
                RAISE EXCEPTION 'Role name cannot be blank.'
                    USING ERRCODE = '22023';
            END IF;

            IF v_name IS NOT NULL AND v_name NOT IN ('administrator', 'staff') THEN
                RAISE EXCEPTION 'Role name must be either administrator or staff.'
                    USING ERRCODE = '22023';
            END IF;

            IF v_desc IS NOT NULL AND length(v_desc) > 255 THEN
                RAISE EXCEPTION 'Role description cannot exceed 255 characters.'
                    USING ERRCODE = '22023';
            END IF;

            SELECT json_build_object(
                'role_id', r.role_id,
                'role_name', r.role_name,
                'description', r.description
            )
            INTO v_old
            FROM kubo.role AS r
            WHERE r.role_id = p_id;

            UPDATE kubo.role
               SET role_name = COALESCE(v_name, role_name),
                   description = COALESCE(v_desc, description)
             WHERE role_id = p_id
             RETURNING * INTO v_role;

            PERFORM kubo_audit_management.write_audit_log(
                p_actor_employee_id,
                'Update'::kubo.audit_action,
                'role',
                p_id,
                format('Updated role %s', v_role.role_name),
                v_old,
                json_build_object(
                    'role_id', v_role.role_id,
                    'role_name', v_role.role_name,
                    'description', v_role.description
                )
            );

            RETURN v_role;
        EXCEPTION
            WHEN unique_violation THEN
                RAISE EXCEPTION 'Role name already exists.'
                    USING ERRCODE = '23505';
        END;
        $function$
    $sql$;
END
$migration$;
