/*
  Migration: 20261121_protect_time_fee_charges_from_deletion.sql
  --------------------------------------------------------------
  Early check-in and late check-out fees cannot be deleted by Staff.

  Staff may delete any applied charge before settlement
  (kubo_additional_charges_management.fn_delete_additional_charge). The
  `EarlyCheckIn` fee is written only during check-in, so deleting it waived the
  fee for good, and nothing stopped a Staff member doing so. A time fee is
  identified by `time_fee_kubo_id` (20261120_add_early_late_checkout_fees.sql).
  Deleting one is now refused; an Administrator reduces or reverses it with an
  Adjustment or Reversal payment, which is audited.

  The function is 20261102_harden_additional_charge_management.sql with only
  the time-fee check added.
*/

DO $$
BEGIN
    IF to_regclass('kubo.additional_charge') IS NULL
       OR to_regnamespace('kubo_additional_charges_management') IS NULL
       OR NOT EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = 'kubo'
              AND table_name = 'additional_charge'
              AND column_name = 'time_fee_kubo_id'
       ) THEN
        RAISE EXCEPTION 'time-fee charges are not provisioned; apply 20261120_add_early_late_checkout_fees.sql first';
    END IF;

    EXECUTE $sql$
        CREATE OR REPLACE FUNCTION kubo_additional_charges_management.fn_delete_additional_charge(
            p_charge_id uuid,
            p_employee_id uuid
        )
        RETURNS boolean
        LANGUAGE plpgsql
        SECURITY DEFINER
        SET search_path TO 'pg_catalog', 'pg_temp'
        AS $function$
        DECLARE
            v_old kubo.additional_charge%ROWTYPE;
            v_reservation_id uuid;
        BEGIN
            IF NOT kubo_additional_charges_management.fn_is_active_staff(p_employee_id) THEN
                RAISE EXCEPTION 'Only an active Staff member may delete applied charges.'
                    USING ERRCODE = '42501';
            END IF;

            SELECT * INTO v_old
            FROM kubo.additional_charge AS ac
            WHERE ac.charge_id = p_charge_id
            FOR UPDATE;

            IF NOT FOUND THEN
                RETURN FALSE;
            END IF;

            v_reservation_id := v_old.reservation_id;

            IF v_old.time_fee_kubo_id IS NOT NULL THEN
                RAISE EXCEPTION 'Early check-in and late check-out fees cannot be deleted. Ask an Administrator to record an Adjustment or Reversal.'
                    USING ERRCODE = '23514';
            END IF;

            IF kubo_additional_charges_management.fn_is_reservation_settled(v_reservation_id) THEN
                RAISE EXCEPTION 'Charge cannot be deleted after settlement.'
                    USING ERRCODE = '23514';
            END IF;

            DELETE FROM kubo.additional_charge AS ac
            WHERE ac.charge_id = p_charge_id;

            PERFORM kubo_audit_management.write_audit_log(
                p_employee_id,
                'Delete'::kubo.audit_action,
                'additional_charge',
                p_charge_id,
                format('Deleted applied charge %s', v_old.charge_type),
                to_json(v_old),
                NULL
            );

            RETURN TRUE;
        END;
        $function$
    $sql$;
END $$;
