-- Missing RPC functions used by the app. Adjust types/schemas to your Supabase project as needed.
-- Idempotent guards so it can be run multiple times.

-- check_booking_overlap(p_table_ids uuid[], p_start_time timestamptz, p_end_time timestamptz, p_exclude_booking_id uuid = NULL)
-- Returns a conflicting booking id if any overlap exists for any of the tables; otherwise NULL
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc WHERE proname = 'check_booking_overlap'
  ) THEN
    CREATE OR REPLACE FUNCTION public.check_booking_overlap(
      p_table_ids uuid[],
      p_start_time timestamptz,
      p_end_time timestamptz,
      p_exclude_booking_id uuid DEFAULT NULL
    ) RETURNS uuid AS $$
    BEGIN
      RETURN (
        SELECT b.id
        FROM public.bookings b
        JOIN public.booking_tables bt ON bt.booking_id = b.id
        WHERE bt.table_id = ANY(p_table_ids)
          AND b.status IN ('confirmed','arrived','seated','ordered','appetizers','main_course','dessert','payment')
          AND (b.booking_time < p_end_time AND (b.booking_time + make_interval(mins => COALESCE(b.turn_time_minutes, 120))) > p_start_time)
          AND (p_exclude_booking_id IS NULL OR b.id <> p_exclude_booking_id)
        LIMIT 1
      );
    END;
    $$ LANGUAGE plpgsql SECURITY DEFINER;
  END IF;
END $$;

-- lock_booking_for_update(p_booking_id uuid)
-- Locks and returns the booking row to avoid concurrent acceptance.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc WHERE proname = 'lock_booking_for_update'
  ) THEN
    CREATE OR REPLACE FUNCTION public.lock_booking_for_update(
      p_booking_id uuid
    ) RETURNS public.bookings AS $$
    DECLARE
      result public.bookings;
    BEGIN
      SELECT * INTO result
      FROM public.bookings
      WHERE id = p_booking_id
      FOR UPDATE;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'Booking not found';
      END IF;

      RETURN result;
    END;
    $$ LANGUAGE plpgsql SECURITY DEFINER;
  END IF;
END $$;

-- validate_booking_acceptance(p_booking_id uuid, p_table_ids uuid[])
-- Performs server-side checks prior to acceptance. Returns a JSON structure with { valid, reason }
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc WHERE proname = 'validate_booking_acceptance'
  ) THEN
    CREATE OR REPLACE FUNCTION public.validate_booking_acceptance(
      p_booking_id uuid,
      p_table_ids uuid[]
    ) RETURNS jsonb AS $$
    DECLARE
      v_booking public.bookings;
      v_conflict uuid;
      v_valid boolean := true;
      v_reason text := NULL;
    BEGIN
      SELECT * INTO v_booking FROM public.bookings WHERE id = p_booking_id;
      IF NOT FOUND THEN
        RETURN jsonb_build_object('valid', false, 'reason', 'Booking not found');
      END IF;

      -- Only pending bookings can be accepted
      IF v_booking.status <> 'pending' THEN
        RETURN jsonb_build_object('valid', false, 'reason', 'Booking is not pending');
      END IF;

      -- Ensure tables belong to the same restaurant and are active
      IF EXISTS (
        SELECT 1
        FROM public.restaurant_tables t
        WHERE t.id = ANY(p_table_ids)
          AND (t.restaurant_id <> v_booking.restaurant_id OR t.is_active = false)
      ) THEN
        RETURN jsonb_build_object('valid', false, 'reason', 'Invalid or inactive tables selected');
      END IF;

      -- Time overlap check using helper
      SELECT public.check_booking_overlap(p_table_ids, v_booking.booking_time, v_booking.booking_time + make_interval(mins => COALESCE(v_booking.turn_time_minutes, 120)), v_booking.id)
        INTO v_conflict;

      IF v_conflict IS NOT NULL THEN
        RETURN jsonb_build_object('valid', false, 'reason', 'Selected tables are not available');
      END IF;

      RETURN jsonb_build_object('valid', true);
    END;
    $$ LANGUAGE plpgsql SECURITY DEFINER;
  END IF;
END $$;

-- find_alternative_slots(p_restaurant_id uuid, p_original_time timestamptz, p_party_size int, p_duration_minutes int)
-- Returns a set of suggested_time and available_tables counts around the original time.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc WHERE proname = 'find_alternative_slots'
  ) THEN
    CREATE OR REPLACE FUNCTION public.find_alternative_slots(
      p_restaurant_id uuid,
      p_original_time timestamptz,
      p_party_size int,
      p_duration_minutes int
    ) RETURNS TABLE (suggested_time timestamptz, available_tables int) AS $$
    DECLARE
      delta int;
      start_time timestamptz := p_original_time - interval '60 minutes';
      end_time timestamptz := p_original_time + interval '120 minutes';
      slot timestamptz;
    BEGIN
      FOR slot IN SELECT generate_series(start_time, end_time, interval '15 minutes') LOOP
        -- Count tables that could seat the party and are free in this slot
        RETURN QUERY
        SELECT slot AS suggested_time,
               COUNT(*)::int AS available_tables
        FROM public.restaurant_tables t
        WHERE t.restaurant_id = p_restaurant_id
          AND t.is_active = true
          AND t.capacity >= p_party_size
          AND NOT EXISTS (
            SELECT 1
            FROM public.booking_tables bt
            JOIN public.bookings b ON b.id = bt.booking_id
            WHERE bt.table_id = t.id
              AND b.status IN ('confirmed','arrived','seated','ordered','appetizers','main_course','dessert','payment')
              AND (b.booking_time < slot + make_interval(mins => p_duration_minutes)
                   AND (b.booking_time + make_interval(mins => COALESCE(b.turn_time_minutes, 120))) > slot)
          );
      END LOOP;
    END;
    $$ LANGUAGE plpgsql SECURITY DEFINER;
  END IF;
END $$;

