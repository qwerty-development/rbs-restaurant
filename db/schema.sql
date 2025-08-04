-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.booking_archive (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  restaurant_id uuid NOT NULL,
  booking_time timestamp with time zone NOT NULL,
  party_size integer NOT NULL CHECK (party_size > 0),
  status text NOT NULL CHECK (status = ANY (ARRAY['pending'::text, 'confirmed'::text, 'cancelled_by_user'::text, 'declined_by_restaurant'::text, 'completed'::text, 'no_show'::text])),
  special_requests text,
  occasion text,
  dietary_notes ARRAY,
  confirmation_code text UNIQUE,
  table_preferences ARRAY,
  reminder_sent boolean DEFAULT false,
  checked_in_at timestamp with time zone,
  loyalty_points_earned integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  applied_offer_id uuid,
  expected_loyalty_points integer DEFAULT 0,
  guest_name text,
  guest_email text,
  guest_phone text,
  is_group_booking boolean DEFAULT false,
  organizer_id uuid,
  attendees integer DEFAULT 1,
  turn_time_minutes integer NOT NULL DEFAULT 120,
  archived_at timestamp with time zone DEFAULT now(),
  archived_by uuid,
  CONSTRAINT booking_archive_pkey PRIMARY KEY (id),
  CONSTRAINT booking_archive_archived_by_fkey FOREIGN KEY (archived_by) REFERENCES public.profiles(id)
);

-- (the rest of the provided schema would follow here in full)
