/*
  Migration: 20240920_create_role_schema.sql
  -------------------------------------------------
  This migration creates the `kubo` schema, the `role` table and all
  stored procedures required by the role module.
*/

CREATE SCHEMA IF NOT EXISTS kubo;

-- Table definition
CREATE TABLE IF NOT EXISTS kubo.role (
    role_id      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    role_name    text NOT NULL UNIQUE,
    description  text
);

-- 1️⃣ create_role(name, description) → returns the inserted row
CREATE OR REPLACE FUNCTION kubo.create_role(p_name text, p_desc text)
RETURNS kubo.role AS $$
DECLARE
    v_role kubo.role%ROWTYPE;
BEGIN
    INSERT INTO kubo.role (role_name, description)
    VALUES (p_name, p_desc)
    RETURNING * INTO v_role;
    RETURN v_role;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2️⃣ get_roles() → list all roles
CREATE OR REPLACE FUNCTION kubo.get_roles()
RETURNS SETOF kubo.role AS $$
BEGIN
    RETURN QUERY SELECT * FROM kubo.role ORDER BY role_name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3️⃣ get_role_by_id(id) → single role
CREATE OR REPLACE FUNCTION kubo.get_role_by_id(p_id uuid)
RETURNS kubo.role AS $$
DECLARE
    v_role kubo.role%ROWTYPE;
BEGIN
    SELECT * INTO v_role FROM kubo.role WHERE role_id = p_id;
    RETURN v_role;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4️⃣ get_role_by_name(name) → single role (used for duplicate check)
CREATE OR REPLACE FUNCTION kubo.get_role_by_name(p_name text)
RETURNS kubo.role AS $$
DECLARE
    v_role kubo.role%ROWTYPE;
BEGIN
    SELECT * INTO v_role FROM kubo.role WHERE lower(role_name) = lower(p_name);
    RETURN v_role;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5️⃣ update_role(id, name, description) → updated row
CREATE OR REPLACE FUNCTION kubo.update_role(p_id uuid, p_name text, p_desc text)
RETURNS kubo.role AS $$
DECLARE
    v_role kubo.role%ROWTYPE;
BEGIN
    UPDATE kubo.role
       SET role_name = COALESCE(p_name, role_name),
           description = COALESCE(p_desc, description)
     WHERE role_id = p_id
     RETURNING * INTO v_role;
    RETURN v_role;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6️⃣ delete_role(id) → returns the deleted id (or null)
CREATE OR REPLACE FUNCTION kubo.delete_role(p_id uuid)
RETURNS uuid AS $$
BEGIN
    DELETE FROM kubo.role WHERE role_id = p_id;
    RETURN p_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
