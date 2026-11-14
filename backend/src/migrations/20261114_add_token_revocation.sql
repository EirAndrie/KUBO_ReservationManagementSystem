/*
  Migration: 20261114_add_token_revocation.sql
  -------------------------------------------------
  Makes logout revoke the access token instead of being audit-only.

  Every access token now carries a unique `jti` claim. POST /auth/logout stores
  that jti here until the token's own expiry; the authenticate middleware
  rejects any token whose jti is listed. Rows past their expiry are useless
  (the JWT signature check already rejects the token), so revoke_token prunes
  them on each call to keep the table small.

  Included:
  - kubo_auth_management.revoked_token (jti primary key, employee, expiry).
  - revoke_token(jti, employee_id, expires_at): idempotent insert + pruning.
  - is_token_revoked(jti): boolean lookup used on every protected request.
*/

DO $$
BEGIN
    IF to_regclass('kubo.employee') IS NULL
       OR to_regnamespace('kubo_auth_management') IS NULL THEN
        RAISE NOTICE 'Auth schema is not provisioned; skipping token revocation';
        RETURN;
    END IF;

    EXECUTE $ddl$
        CREATE TABLE IF NOT EXISTS kubo_auth_management.revoked_token (
            jti uuid PRIMARY KEY,
            employee_id uuid NOT NULL
                REFERENCES kubo.employee(employee_id) ON DELETE CASCADE,
            expires_at timestamp with time zone NOT NULL,
            revoked_at timestamp with time zone NOT NULL DEFAULT now()
        )
    $ddl$;

    EXECUTE $ddl$
        CREATE INDEX IF NOT EXISTS revoked_token_expires_at_idx
            ON kubo_auth_management.revoked_token (expires_at)
    $ddl$;

    EXECUTE $sql$
        CREATE OR REPLACE FUNCTION kubo_auth_management.revoke_token(
            p_jti uuid,
            p_employee_id uuid,
            p_expires_at timestamp with time zone
        )
        RETURNS void
        LANGUAGE plpgsql
        SECURITY DEFINER
        SET search_path TO 'pg_catalog', 'pg_temp'
        AS $function$
        BEGIN
            IF p_jti IS NULL OR p_employee_id IS NULL OR p_expires_at IS NULL THEN
                RAISE EXCEPTION 'Token id, employee, and expiry are required.'
                    USING ERRCODE = '22023';
            END IF;

            DELETE FROM kubo_auth_management.revoked_token AS t
            WHERE t.expires_at < now();

            INSERT INTO kubo_auth_management.revoked_token (jti, employee_id, expires_at)
            VALUES (p_jti, p_employee_id, p_expires_at)
            ON CONFLICT (jti) DO NOTHING;
        END;
        $function$
    $sql$;

    EXECUTE $sql$
        CREATE OR REPLACE FUNCTION kubo_auth_management.is_token_revoked(
            p_jti uuid
        )
        RETURNS boolean
        LANGUAGE sql
        STABLE
        SECURITY DEFINER
        SET search_path TO 'pg_catalog', 'pg_temp'
        AS $function$
        SELECT EXISTS (
            SELECT 1
            FROM kubo_auth_management.revoked_token AS t
            WHERE t.jti = p_jti
        );
        $function$
    $sql$;
END;
$$;
