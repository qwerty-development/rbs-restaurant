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
CREATE TABLE public.booking_attendees (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  booking_id uuid NOT NULL,
  user_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'pending'::text CHECK (status = ANY (ARRAY['pending'::text, 'confirmed'::text, 'declined'::text, 'cancelled'::text])),
  is_organizer boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT booking_attendees_pkey PRIMARY KEY (id),
  CONSTRAINT booking_attendees_booking_id_fkey FOREIGN KEY (booking_id) REFERENCES public.bookings(id),
  CONSTRAINT booking_attendees_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.booking_invites (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  booking_id uuid NOT NULL,
  from_user_id uuid NOT NULL,
  to_user_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'pending'::text CHECK (status = ANY (ARRAY['pending'::text, 'accepted'::text, 'declined'::text, 'cancelled'::text])),
  message text,
  created_at timestamp with time zone DEFAULT now(),
  responded_at timestamp with time zone,
  CONSTRAINT booking_invites_pkey PRIMARY KEY (id),
  CONSTRAINT booking_invites_to_user_id_fkey FOREIGN KEY (to_user_id) REFERENCES public.profiles(id),
  CONSTRAINT booking_invites_booking_id_fkey FOREIGN KEY (booking_id) REFERENCES public.bookings(id),
  CONSTRAINT booking_invites_from_user_id_fkey FOREIGN KEY (from_user_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.booking_status_history (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL,
  old_status text,
  new_status text NOT NULL,
  changed_by uuid,
  changed_at timestamp with time zone DEFAULT now(),
  reason text,
  metadata jsonb DEFAULT '{}'::jsonb,
  CONSTRAINT booking_status_history_pkey PRIMARY KEY (id),
  CONSTRAINT booking_status_history_changed_by_fkey FOREIGN KEY (changed_by) REFERENCES public.profiles(id),
  CONSTRAINT booking_status_history_booking_id_fkey FOREIGN KEY (booking_id) REFERENCES public.bookings(id)
);
CREATE TABLE public.booking_tables (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL,
  table_id uuid NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT booking_tables_pkey PRIMARY KEY (id),
  CONSTRAINT booking_tables_booking_id_fkey FOREIGN KEY (booking_id) REFERENCES public.bookings(id),
  CONSTRAINT booking_tables_table_id_fkey FOREIGN KEY (table_id) REFERENCES public.restaurant_tables(id)
);
CREATE TABLE public.bookings (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  restaurant_id uuid NOT NULL,
  booking_time timestamp with time zone NOT NULL,
  party_size integer NOT NULL CHECK (party_size > 0),
  status text NOT NULL CHECK (status = ANY (ARRAY['pending'::text, 'confirmed'::text, 'cancelled_by_user'::text, 'declined_by_restaurant'::text, 'auto_declined'::text, 'completed'::text, 'no_show'::text, 'arrived'::text, 'seated'::text, 'ordered'::text, 'appetizers'::text, 'main_course'::text, 'dessert'::text, 'payment'::text, 'cancelled_by_restaurant'::text])),
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
  applied_loyalty_rule_id uuid,
  actual_end_time timestamp with time zone,
  seated_at timestamp with time zone,
  meal_progress jsonb DEFAULT '{}'::jsonb,
  request_expires_at timestamp with time zone,
  auto_declined boolean DEFAULT false,
  acceptance_attempted_at timestamp with time zone,
  acceptance_failed_reason text,
  suggested_alternative_time timestamp with time zone,
  suggested_alternative_tables ARRAY,
  CONSTRAINT bookings_pkey PRIMARY KEY (id),
  CONSTRAINT bookings_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id),
  CONSTRAINT bookings_applied_loyalty_rule_id_fkey FOREIGN KEY (applied_loyalty_rule_id) REFERENCES public.restaurant_loyalty_rules(id),
  CONSTRAINT bookings_organizer_id_fkey FOREIGN KEY (organizer_id) REFERENCES public.profiles(id),
  CONSTRAINT bookings_applied_offer_id_fkey FOREIGN KEY (applied_offer_id) REFERENCES public.special_offers(id),
  CONSTRAINT bookings_restaurant_id_fkey FOREIGN KEY (restaurant_id) REFERENCES public.restaurants(id)
);
CREATE TABLE public.customer_notes (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL,
  note text NOT NULL,
  category text CHECK (category = ANY (ARRAY['dietary'::text, 'preference'::text, 'behavior'::text, 'special_occasion'::text, 'general'::text])),
  is_important boolean DEFAULT false,
  created_by uuid NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT customer_notes_pkey PRIMARY KEY (id),
  CONSTRAINT customer_notes_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id),
  CONSTRAINT customer_notes_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.restaurant_customers(id)
);
CREATE TABLE public.customer_preferences (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL,
  preference_type text NOT NULL CHECK (preference_type = ANY (ARRAY['seating'::text, 'ambiance'::text, 'service'::text, 'menu'::text, 'timing'::text])),
  preference_value jsonb NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT customer_preferences_pkey PRIMARY KEY (id),
  CONSTRAINT customer_preferences_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.restaurant_customers(id)
);
CREATE TABLE public.customer_relationships (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL,
  related_customer_id uuid NOT NULL,
  relationship_type text NOT NULL CHECK (relationship_type = ANY (ARRAY['spouse'::text, 'parent'::text, 'child'::text, 'sibling'::text, 'friend'::text, 'colleague'::text, 'partner'::text, 'other'::text])),
  relationship_details text,
  created_by uuid NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT customer_relationships_pkey PRIMARY KEY (id),
  CONSTRAINT customer_relationships_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.restaurant_customers(id),
  CONSTRAINT customer_relationships_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id),
  CONSTRAINT customer_relationships_related_customer_id_fkey FOREIGN KEY (related_customer_id) REFERENCES public.restaurant_customers(id)
);
CREATE TABLE public.customer_tag_assignments (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL,
  tag_id uuid NOT NULL,
  assigned_by uuid NOT NULL,
  assigned_at timestamp with time zone DEFAULT now(),
  CONSTRAINT customer_tag_assignments_pkey PRIMARY KEY (id),
  CONSTRAINT customer_tag_assignments_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.restaurant_customers(id),
  CONSTRAINT customer_tag_assignments_assigned_by_fkey FOREIGN KEY (assigned_by) REFERENCES public.profiles(id),
  CONSTRAINT customer_tag_assignments_tag_id_fkey FOREIGN KEY (tag_id) REFERENCES public.customer_tags(id)
);
CREATE TABLE public.customer_tags (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL,
  name text NOT NULL,
  color text NOT NULL DEFAULT '#gray'::text,
  description text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT customer_tags_pkey PRIMARY KEY (id),
  CONSTRAINT customer_tags_restaurant_id_fkey FOREIGN KEY (restaurant_id) REFERENCES public.restaurants(id)
);
CREATE TABLE public.data_export_requests (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid,
  status text DEFAULT 'pending'::text CHECK (status = ANY (ARRAY['pending'::text, 'processing'::text, 'completed'::text, 'failed'::text])),
  requested_at timestamp with time zone DEFAULT now(),
  completed_at timestamp with time zone,
  download_url text,
  CONSTRAINT data_export_requests_pkey PRIMARY KEY (id),
  CONSTRAINT data_export_requests_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.favorites (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL,
  restaurant_id uuid NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT favorites_pkey PRIMARY KEY (id),
  CONSTRAINT favorites_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id),
  CONSTRAINT favorites_restaurant_id_fkey FOREIGN KEY (restaurant_id) REFERENCES public.restaurants(id)
);
CREATE TABLE public.floor_plans (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  restaurant_id uuid NOT NULL,
  name text NOT NULL,
  svg_layout text,
  width integer DEFAULT 100,
  height integer DEFAULT 100,
  is_default boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT floor_plans_pkey PRIMARY KEY (id),
  CONSTRAINT floor_plans_restaurant_id_fkey FOREIGN KEY (restaurant_id) REFERENCES public.restaurants(id)
);
CREATE TABLE public.friend_requests (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  from_user_id uuid NOT NULL,
  to_user_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'pending'::text CHECK (status = ANY (ARRAY['pending'::text, 'accepted'::text, 'rejected'::text, 'cancelled'::text])),
  message text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT friend_requests_pkey PRIMARY KEY (id),
  CONSTRAINT friend_requests_from_user_id_fkey FOREIGN KEY (from_user_id) REFERENCES public.profiles(id),
  CONSTRAINT friend_requests_to_user_id_fkey FOREIGN KEY (to_user_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.friends (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL,
  friend_id uuid NOT NULL,
  friendship_date timestamp with time zone DEFAULT now(),
  CONSTRAINT friends_pkey PRIMARY KEY (id),
  CONSTRAINT friends_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id),
  CONSTRAINT friends_friend_id_fkey FOREIGN KEY (friend_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.loyalty_activities (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL,
  activity_type text NOT NULL CHECK (activity_type = ANY (ARRAY['booking_completed'::text, 'review_written'::text, 'photo_uploaded'::text, 'referral_success'::text, 'birthday_bonus'::text, 'streak_bonus'::text, 'manual_adjustment'::text])),
  points_earned integer NOT NULL,
  points_multiplier numeric DEFAULT 1.0,
  description text,
  related_booking_id uuid,
  related_review_id uuid,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT loyalty_activities_pkey PRIMARY KEY (id),
  CONSTRAINT loyalty_activities_related_review_id_fkey FOREIGN KEY (related_review_id) REFERENCES public.reviews(id),
  CONSTRAINT loyalty_activities_related_booking_id_fkey FOREIGN KEY (related_booking_id) REFERENCES public.bookings(id),
  CONSTRAINT loyalty_activities_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.loyalty_audit_log (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  action text NOT NULL,
  restaurant_id uuid,
  user_id uuid,
  booking_id uuid,
  points_amount integer,
  balance_before integer,
  balance_after integer,
  metadata jsonb,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT loyalty_audit_log_pkey PRIMARY KEY (id)
);
CREATE TABLE public.loyalty_redemptions (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL,
  reward_id uuid,
  offer_id uuid,
  points_cost integer NOT NULL,
  redemption_code text DEFAULT encode(gen_random_bytes(8), 'hex'::text) UNIQUE,
  status text DEFAULT 'active'::text CHECK (status = ANY (ARRAY['active'::text, 'used'::text, 'expired'::text, 'cancelled'::text])),
  used_at timestamp with time zone,
  expires_at timestamp with time zone NOT NULL,
  booking_id uuid,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT loyalty_redemptions_pkey PRIMARY KEY (id),
  CONSTRAINT loyalty_redemptions_offer_id_fkey FOREIGN KEY (offer_id) REFERENCES public.special_offers(id),
  CONSTRAINT loyalty_redemptions_reward_id_fkey FOREIGN KEY (reward_id) REFERENCES public.loyalty_rewards(id),
  CONSTRAINT loyalty_redemptions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id),
  CONSTRAINT loyalty_redemptions_booking_id_fkey FOREIGN KEY (booking_id) REFERENCES public.bookings(id)
);
CREATE TABLE public.loyalty_rewards (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  title text NOT NULL,
  description text,
  category text NOT NULL CHECK (category = ANY (ARRAY['food'::text, 'discount'::text, 'experience'::text, 'tier_exclusive'::text])),
  points_cost integer NOT NULL CHECK (points_cost > 0),
  tier_required text NOT NULL CHECK (tier_required = ANY (ARRAY['bronze'::text, 'silver'::text, 'gold'::text, 'platinum'::text])),
  value_description text,
  terms_conditions ARRAY,
  max_redemptions_per_user integer,
  total_available integer,
  restaurant_id uuid,
  is_active boolean DEFAULT true,
  valid_from timestamp with time zone DEFAULT now(),
  valid_until timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT loyalty_rewards_pkey PRIMARY KEY (id),
  CONSTRAINT loyalty_rewards_restaurant_id_fkey FOREIGN KEY (restaurant_id) REFERENCES public.restaurants(id)
);
CREATE TABLE public.menu_categories (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  restaurant_id uuid NOT NULL,
  name text NOT NULL,
  description text,
  display_order integer DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT menu_categories_pkey PRIMARY KEY (id),
  CONSTRAINT menu_categories_restaurant_id_fkey FOREIGN KEY (restaurant_id) REFERENCES public.restaurants(id)
);
CREATE TABLE public.menu_items (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  restaurant_id uuid NOT NULL,
  category_id uuid NOT NULL,
  name text NOT NULL,
  description text,
  price numeric NOT NULL,
  image_url text,
  dietary_tags ARRAY DEFAULT '{}'::text[],
  allergens ARRAY DEFAULT '{}'::text[],
  calories integer,
  preparation_time integer,
  is_available boolean DEFAULT true,
  is_featured boolean DEFAULT false,
  display_order integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT menu_items_pkey PRIMARY KEY (id),
  CONSTRAINT menu_items_restaurant_id_fkey FOREIGN KEY (restaurant_id) REFERENCES public.restaurants(id),
  CONSTRAINT menu_items_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.menu_categories(id)
);
CREATE TABLE public.notifications (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL,
  type text NOT NULL CHECK (type = ANY (ARRAY['friend_request'::text, 'friend_request_accepted'::text, 'booking_shared'::text, 'shared_booking_accepted'::text, 'booking_reminder'::text, 'booking_confirmed'::text, 'booking_cancelled'::text])),
  title text NOT NULL,
  message text NOT NULL,
  data jsonb,
  read boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT notifications_pkey PRIMARY KEY (id),
  CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.playlist_collaborators (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  playlist_id uuid NOT NULL,
  user_id uuid NOT NULL,
  permission text NOT NULL DEFAULT 'view'::text CHECK (permission = ANY (ARRAY['view'::text, 'edit'::text])),
  invited_by uuid NOT NULL,
  invited_at timestamp with time zone DEFAULT now(),
  accepted_at timestamp with time zone,
  CONSTRAINT playlist_collaborators_pkey PRIMARY KEY (id),
  CONSTRAINT playlist_collaborators_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id),
  CONSTRAINT playlist_collaborators_playlist_id_fkey FOREIGN KEY (playlist_id) REFERENCES public.restaurant_playlists(id),
  CONSTRAINT playlist_collaborators_invited_by_fkey FOREIGN KEY (invited_by) REFERENCES public.profiles(id)
);
CREATE TABLE public.playlist_items (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  playlist_id uuid NOT NULL,
  restaurant_id uuid NOT NULL,
  added_by uuid NOT NULL,
  position integer NOT NULL DEFAULT 0,
  note text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT playlist_items_pkey PRIMARY KEY (id),
  CONSTRAINT playlist_items_restaurant_id_fkey FOREIGN KEY (restaurant_id) REFERENCES public.restaurants(id),
  CONSTRAINT playlist_items_playlist_id_fkey FOREIGN KEY (playlist_id) REFERENCES public.restaurant_playlists(id),
  CONSTRAINT playlist_items_added_by_fkey FOREIGN KEY (added_by) REFERENCES public.profiles(id)
);
CREATE TABLE public.post_comments (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  post_id uuid,
  user_id uuid,
  comment text NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT post_comments_pkey PRIMARY KEY (id),
  CONSTRAINT post_comments_post_id_fkey FOREIGN KEY (post_id) REFERENCES public.posts(id),
  CONSTRAINT post_comments_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.post_images (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  post_id uuid,
  image_url text NOT NULL,
  image_order integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT post_images_pkey PRIMARY KEY (id),
  CONSTRAINT post_images_post_id_fkey FOREIGN KEY (post_id) REFERENCES public.posts(id)
);
CREATE TABLE public.post_likes (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  post_id uuid,
  user_id uuid,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT post_likes_pkey PRIMARY KEY (id),
  CONSTRAINT post_likes_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id),
  CONSTRAINT post_likes_post_id_fkey FOREIGN KEY (post_id) REFERENCES public.posts(id)
);
CREATE TABLE public.post_tags (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  post_id uuid,
  tagged_user_id uuid,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT post_tags_pkey PRIMARY KEY (id),
  CONSTRAINT post_tags_post_id_fkey FOREIGN KEY (post_id) REFERENCES public.posts(id),
  CONSTRAINT post_tags_tagged_user_id_fkey FOREIGN KEY (tagged_user_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.posts (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid,
  booking_id uuid,
  restaurant_id uuid,
  content text,
  visibility text DEFAULT 'friends'::text CHECK (visibility = ANY (ARRAY['friends'::text, 'private'::text])),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT posts_pkey PRIMARY KEY (id),
  CONSTRAINT posts_booking_id_fkey FOREIGN KEY (booking_id) REFERENCES public.bookings(id),
  CONSTRAINT posts_restaurant_id_fkey FOREIGN KEY (restaurant_id) REFERENCES public.restaurants(id),
  CONSTRAINT posts_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.profiles (
  id uuid NOT NULL,
  full_name text NOT NULL,
  phone_number text,
  avatar_url text,
  allergies ARRAY,
  favorite_cuisines ARRAY,
  dietary_restrictions ARRAY,
  preferred_party_size integer DEFAULT 2,
  notification_preferences jsonb DEFAULT '{"sms": false, "push": true, "email": true}'::jsonb,
  loyalty_points integer DEFAULT 0,
  membership_tier text DEFAULT 'bronze'::text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  privacy_settings jsonb DEFAULT jsonb_build_object('profile_visibility', 'public', 'activity_sharing', true, 'location_sharing', false, 'friend_requests_allowed', true),
  user_rating numeric DEFAULT 5.0 CHECK (user_rating >= 1.0 AND user_rating <= 5.0),
  total_bookings integer DEFAULT 0,
  completed_bookings integer DEFAULT 0,
  cancelled_bookings integer DEFAULT 0,
  no_show_bookings integer DEFAULT 0,
  rating_last_updated timestamp with time zone DEFAULT now(),
  CONSTRAINT profiles_pkey PRIMARY KEY (id),
  CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id)
);
CREATE TABLE public.restaurant_availability (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL,
  date date NOT NULL,
  time_slot time without time zone NOT NULL,
  total_capacity integer NOT NULL,
  available_capacity integer NOT NULL,
  CONSTRAINT restaurant_availability_pkey PRIMARY KEY (id),
  CONSTRAINT restaurant_availability_restaurant_id_fkey FOREIGN KEY (restaurant_id) REFERENCES public.restaurants(id)
);
CREATE TABLE public.restaurant_closures (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  reason text NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  created_by uuid NOT NULL,
  CONSTRAINT restaurant_closures_pkey PRIMARY KEY (id),
  CONSTRAINT restaurant_closures_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id),
  CONSTRAINT restaurant_closures_restaurant_id_fkey FOREIGN KEY (restaurant_id) REFERENCES public.restaurants(id)
);
CREATE TABLE public.restaurant_customers (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL,
  user_id uuid,
  guest_email text,
  guest_phone text,
  guest_name text,
  total_bookings integer DEFAULT 0,
  total_spent numeric DEFAULT 0,
  average_party_size numeric DEFAULT 0,
  last_visit timestamp with time zone,
  first_visit timestamp with time zone,
  no_show_count integer DEFAULT 0,
  cancelled_count integer DEFAULT 0,
  vip_status boolean DEFAULT false,
  blacklisted boolean DEFAULT false,
  blacklist_reason text,
  preferred_table_types ARRAY,
  preferred_time_slots ARRAY,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT restaurant_customers_pkey PRIMARY KEY (id),
  CONSTRAINT restaurant_customers_restaurant_id_fkey FOREIGN KEY (restaurant_id) REFERENCES public.restaurants(id),
  CONSTRAINT restaurant_customers_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.restaurant_hours (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL,
  day_of_week text NOT NULL CHECK (day_of_week = ANY (ARRAY['monday'::text, 'tuesday'::text, 'wednesday'::text, 'thursday'::text, 'friday'::text, 'saturday'::text, 'sunday'::text])),
  is_open boolean DEFAULT true,
  open_time time without time zone,
  close_time time without time zone,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT restaurant_hours_pkey PRIMARY KEY (id),
  CONSTRAINT restaurant_hours_restaurant_id_fkey FOREIGN KEY (restaurant_id) REFERENCES public.restaurants(id)
);
CREATE TABLE public.restaurant_loyalty_balance (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  restaurant_id uuid NOT NULL UNIQUE,
  total_purchased integer NOT NULL DEFAULT 0 CHECK (total_purchased >= 0),
  current_balance integer NOT NULL DEFAULT 0 CHECK (current_balance >= 0),
  last_purchase_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT restaurant_loyalty_balance_pkey PRIMARY KEY (id),
  CONSTRAINT restaurant_loyalty_balance_restaurant_id_fkey FOREIGN KEY (restaurant_id) REFERENCES public.restaurants(id)
);
CREATE TABLE public.restaurant_loyalty_rules (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  restaurant_id uuid NOT NULL,
  rule_name text NOT NULL,
  points_to_award integer NOT NULL CHECK (points_to_award > 0),
  is_active boolean DEFAULT true,
  valid_from timestamp with time zone DEFAULT now(),
  valid_until timestamp with time zone,
  applicable_days ARRAY DEFAULT ARRAY[0, 1, 2, 3, 4, 5, 6],
  start_time_minutes integer CHECK (start_time_minutes >= 0 AND start_time_minutes < 1440),
  end_time_minutes integer CHECK (end_time_minutes >= 0 AND end_time_minutes <= 1440),
  minimum_party_size integer DEFAULT 1,
  maximum_party_size integer,
  max_uses_total integer,
  current_uses integer DEFAULT 0,
  max_uses_per_user integer,
  priority integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT restaurant_loyalty_rules_pkey PRIMARY KEY (id),
  CONSTRAINT restaurant_loyalty_rules_restaurant_id_fkey FOREIGN KEY (restaurant_id) REFERENCES public.restaurants(id)
);
CREATE TABLE public.restaurant_loyalty_transactions (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  restaurant_id uuid NOT NULL,
  transaction_type text NOT NULL CHECK (transaction_type = ANY (ARRAY['purchase'::text, 'deduction'::text, 'refund'::text, 'adjustment'::text])),
  points integer NOT NULL,
  balance_before integer NOT NULL,
  balance_after integer NOT NULL,
  description text,
  booking_id uuid,
  user_id uuid,
  created_at timestamp with time zone DEFAULT now(),
  metadata jsonb DEFAULT '{}'::jsonb,
  CONSTRAINT restaurant_loyalty_transactions_pkey PRIMARY KEY (id),
  CONSTRAINT restaurant_loyalty_transactions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id),
  CONSTRAINT restaurant_loyalty_transactions_restaurant_id_fkey FOREIGN KEY (restaurant_id) REFERENCES public.restaurants(id),
  CONSTRAINT restaurant_loyalty_transactions_booking_id_fkey FOREIGN KEY (booking_id) REFERENCES public.bookings(id)
);
CREATE TABLE public.restaurant_playlists (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  description text,
  emoji text DEFAULT '📍'::text,
  is_public boolean DEFAULT false,
  share_code text UNIQUE,
  view_count integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT restaurant_playlists_pkey PRIMARY KEY (id),
  CONSTRAINT restaurant_playlists_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.restaurant_special_hours (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL,
  date date NOT NULL,
  is_closed boolean DEFAULT false,
  open_time time without time zone,
  close_time time without time zone,
  reason text,
  created_at timestamp with time zone DEFAULT now(),
  created_by uuid NOT NULL,
  CONSTRAINT restaurant_special_hours_pkey PRIMARY KEY (id),
  CONSTRAINT restaurant_special_hours_restaurant_id_fkey FOREIGN KEY (restaurant_id) REFERENCES public.restaurants(id),
  CONSTRAINT restaurant_special_hours_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id)
);
CREATE TABLE public.restaurant_staff (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL,
  user_id uuid NOT NULL,
  role text NOT NULL CHECK (role = ANY (ARRAY['owner'::text, 'manager'::text, 'staff'::text, 'viewer'::text])),
  permissions ARRAY NOT NULL DEFAULT '{}'::text[],
  is_active boolean DEFAULT true,
  hired_at timestamp with time zone DEFAULT now(),
  terminated_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  created_by uuid,
  last_login_at timestamp with time zone,
  CONSTRAINT restaurant_staff_pkey PRIMARY KEY (id),
  CONSTRAINT restaurant_staff_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id),
  CONSTRAINT restaurant_staff_restaurant_id_fkey FOREIGN KEY (restaurant_id) REFERENCES public.restaurants(id),
  CONSTRAINT restaurant_staff_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id)
);
CREATE TABLE public.restaurant_tables (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  restaurant_id uuid NOT NULL,
  table_number text NOT NULL,
  table_type text NOT NULL CHECK (table_type = ANY (ARRAY['booth'::text, 'window'::text, 'patio'::text, 'standard'::text, 'bar'::text, 'private'::text])),
  capacity integer NOT NULL CHECK (capacity > 0),
  x_position double precision NOT NULL,
  y_position double precision NOT NULL,
  shape text DEFAULT 'rectangle'::text CHECK (shape = ANY (ARRAY['rectangle'::text, 'circle'::text, 'square'::text])),
  width double precision DEFAULT 10,
  height double precision DEFAULT 10,
  is_active boolean DEFAULT true,
  features ARRAY,
  created_at timestamp with time zone DEFAULT now(),
  min_capacity integer NOT NULL,
  max_capacity integer NOT NULL,
  is_combinable boolean DEFAULT true,
  combinable_with ARRAY DEFAULT '{}'::uuid[],
  priority_score integer DEFAULT 0,
  CONSTRAINT restaurant_tables_pkey PRIMARY KEY (id),
  CONSTRAINT restaurant_tables_restaurant_id_fkey FOREIGN KEY (restaurant_id) REFERENCES public.restaurants(id)
);
CREATE TABLE public.restaurant_turn_times (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL,
  party_size integer NOT NULL,
  turn_time_minutes integer NOT NULL,
  day_of_week integer,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT restaurant_turn_times_pkey PRIMARY KEY (id),
  CONSTRAINT restaurant_turn_times_restaurant_id_fkey FOREIGN KEY (restaurant_id) REFERENCES public.restaurants(id)
);
CREATE TABLE public.restaurant_vip_users (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL,
  user_id uuid NOT NULL,
  extended_booking_days integer DEFAULT 60,
  priority_booking boolean DEFAULT true,
  valid_until timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT restaurant_vip_users_pkey PRIMARY KEY (id),
  CONSTRAINT restaurant_vip_users_restaurant_id_fkey FOREIGN KEY (restaurant_id) REFERENCES public.restaurants(id),
  CONSTRAINT restaurant_vip_users_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.restaurants (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  address text NOT NULL,
  location USER-DEFINED NOT NULL,
  main_image_url text,
  image_urls ARRAY,
  cuisine_type text NOT NULL,
  tags ARRAY,
  opening_time time without time zone NOT NULL,
  closing_time time without time zone NOT NULL,
  booking_policy text CHECK (booking_policy = ANY (ARRAY['instant'::text, 'request'::text])),
  price_range integer CHECK (price_range >= 1 AND price_range <= 4),
  average_rating numeric DEFAULT 0,
  total_reviews integer DEFAULT 0,
  phone_number text,
  whatsapp_number text,
  instagram_handle text,
  menu_url text,
  dietary_options ARRAY,
  ambiance_tags ARRAY,
  parking_available boolean DEFAULT false,
  valet_parking boolean DEFAULT false,
  outdoor_seating boolean DEFAULT false,
  shisha_available boolean DEFAULT false,
  live_music_schedule jsonb,
  happy_hour_times jsonb,
  booking_window_days integer DEFAULT 30,
  cancellation_window_hours integer DEFAULT 24,
  table_turnover_minutes integer DEFAULT 120,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  featured boolean DEFAULT false,
  website_url text,
  review_summary jsonb DEFAULT '{"total_reviews": 0, "average_rating": 0, "detailed_ratings": {"food_avg": 0, "value_avg": 0, "service_avg": 0, "ambiance_avg": 0}, "rating_distribution": {"1": 0, "2": 0, "3": 0, "4": 0, "5": 0}, "recommendation_percentage": 0}'::jsonb,
  ai_featured boolean NOT NULL DEFAULT false,
  status text DEFAULT 'active'::text CHECK (status = ANY (ARRAY['active'::text, 'inactive'::text, 'suspended'::text])),
  request_expiry_hours integer DEFAULT 24,
  auto_decline_enabled boolean DEFAULT true,
  max_party_size integer DEFAULT 10 CHECK (max_party_size > 0),
  min_party_size integer DEFAULT 1,
  CONSTRAINT restaurants_pkey PRIMARY KEY (id)
);
CREATE TABLE public.review_replies (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  review_id uuid NOT NULL UNIQUE,
  restaurant_id uuid NOT NULL,
  replied_by uuid NOT NULL,
  reply_message text NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT review_replies_pkey PRIMARY KEY (id),
  CONSTRAINT review_replies_restaurant_id_fkey FOREIGN KEY (restaurant_id) REFERENCES public.restaurants(id),
  CONSTRAINT review_replies_replied_by_fkey FOREIGN KEY (replied_by) REFERENCES public.profiles(id),
  CONSTRAINT review_replies_review_id_fkey FOREIGN KEY (review_id) REFERENCES public.reviews(id)
);
CREATE TABLE public.reviews (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL UNIQUE,
  user_id uuid NOT NULL,
  restaurant_id uuid NOT NULL,
  rating integer NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  food_rating integer CHECK (food_rating >= 1 AND food_rating <= 5),
  service_rating integer CHECK (service_rating >= 1 AND service_rating <= 5),
  ambiance_rating integer CHECK (ambiance_rating >= 1 AND ambiance_rating <= 5),
  value_rating integer CHECK (value_rating >= 1 AND value_rating <= 5),
  recommend_to_friend boolean DEFAULT false,
  visit_again boolean DEFAULT false,
  tags ARRAY,
  photos ARRAY,
  CONSTRAINT reviews_pkey PRIMARY KEY (id),
  CONSTRAINT reviews_booking_id_fkey FOREIGN KEY (booking_id) REFERENCES public.bookings(id),
  CONSTRAINT reviews_restaurant_id_fkey FOREIGN KEY (restaurant_id) REFERENCES public.restaurants(id),
  CONSTRAINT reviews_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.spatial_ref_sys (
  srid integer NOT NULL CHECK (srid > 0 AND srid <= 998999),
  auth_name character varying,
  auth_srid integer,
  srtext character varying,
  proj4text character varying,
  CONSTRAINT spatial_ref_sys_pkey PRIMARY KEY (srid)
);
CREATE TABLE public.special_offers (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL,
  title text NOT NULL,
  description text,
  discount_percentage integer,
  valid_from timestamp with time zone NOT NULL,
  valid_until timestamp with time zone NOT NULL,
  terms_conditions ARRAY,
  minimum_party_size integer DEFAULT 1,
  applicable_days ARRAY,
  created_at timestamp with time zone DEFAULT now(),
  img_url text,
  CONSTRAINT special_offers_pkey PRIMARY KEY (id),
  CONSTRAINT special_offers_restaurant_id_fkey FOREIGN KEY (restaurant_id) REFERENCES public.restaurants(id)
);
CREATE TABLE public.staff_permission_templates (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  description text,
  permissions ARRAY NOT NULL,
  is_system_template boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT staff_permission_templates_pkey PRIMARY KEY (id)
);
CREATE TABLE public.table_availability (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  table_id uuid NOT NULL,
  date date NOT NULL,
  time_slot time without time zone NOT NULL,
  is_available boolean DEFAULT true,
  booking_id uuid,
  CONSTRAINT table_availability_pkey PRIMARY KEY (id),
  CONSTRAINT table_availability_table_id_fkey FOREIGN KEY (table_id) REFERENCES public.restaurant_tables(id),
  CONSTRAINT table_availability_booking_id_fkey FOREIGN KEY (booking_id) REFERENCES public.bookings(id)
);
CREATE TABLE public.table_combinations (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL,
  primary_table_id uuid NOT NULL,
  secondary_table_id uuid NOT NULL,
  combined_capacity integer NOT NULL,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT table_combinations_pkey PRIMARY KEY (id),
  CONSTRAINT table_combinations_restaurant_id_fkey FOREIGN KEY (restaurant_id) REFERENCES public.restaurants(id),
  CONSTRAINT table_combinations_primary_table_id_fkey FOREIGN KEY (primary_table_id) REFERENCES public.restaurant_tables(id),
  CONSTRAINT table_combinations_secondary_table_id_fkey FOREIGN KEY (secondary_table_id) REFERENCES public.restaurant_tables(id)
);
CREATE TABLE public.tier_benefits (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  tier text NOT NULL CHECK (tier = ANY (ARRAY['bronze'::text, 'silver'::text, 'gold'::text, 'platinum'::text])),
  benefit_type text NOT NULL,
  benefit_value text NOT NULL,
  description text NOT NULL,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT tier_benefits_pkey PRIMARY KEY (id)
);
CREATE TABLE public.user_loyalty_rule_usage (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL,
  rule_id uuid NOT NULL,
  booking_id uuid NOT NULL,
  used_at timestamp with time zone DEFAULT now(),
  CONSTRAINT user_loyalty_rule_usage_pkey PRIMARY KEY (id),
  CONSTRAINT user_loyalty_rule_usage_booking_id_fkey FOREIGN KEY (booking_id) REFERENCES public.bookings(id),
  CONSTRAINT user_loyalty_rule_usage_rule_id_fkey FOREIGN KEY (rule_id) REFERENCES public.restaurant_loyalty_rules(id),
  CONSTRAINT user_loyalty_rule_usage_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.user_offers (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  offer_id uuid NOT NULL,
  booking_id uuid,
  claimed_at timestamp with time zone DEFAULT now(),
  used_at timestamp with time zone,
  expires_at timestamp with time zone,
  metadata jsonb DEFAULT '{}'::jsonb,
  redemption_code text DEFAULT encode(gen_random_bytes(8), 'hex'::text),
  status text DEFAULT 'active'::text CHECK (status = ANY (ARRAY['active'::text, 'used'::text, 'expired'::text, 'cancelled'::text])),
  CONSTRAINT user_offers_pkey PRIMARY KEY (id),
  CONSTRAINT user_offers_offer_id_fkey FOREIGN KEY (offer_id) REFERENCES public.special_offers(id),
  CONSTRAINT user_offers_booking_id_fkey FOREIGN KEY (booking_id) REFERENCES public.bookings(id),
  CONSTRAINT user_offers_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.user_privacy_settings (
  user_id uuid NOT NULL,
  marketing_emails boolean DEFAULT true,
  push_notifications boolean DEFAULT true,
  location_sharing boolean DEFAULT false,
  activity_sharing boolean DEFAULT true,
  profile_visibility text DEFAULT 'public'::text CHECK (profile_visibility = ANY (ARRAY['public'::text, 'friends'::text, 'private'::text])),
  data_analytics boolean DEFAULT true,
  third_party_sharing boolean DEFAULT false,
  review_visibility boolean DEFAULT true,
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT user_privacy_settings_pkey PRIMARY KEY (user_id),
  CONSTRAINT user_privacy_settings_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.user_rating_history (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL,
  old_rating numeric,
  new_rating numeric NOT NULL,
  booking_id uuid,
  change_reason text NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT user_rating_history_pkey PRIMARY KEY (id),
  CONSTRAINT user_rating_history_booking_id_fkey FOREIGN KEY (booking_id) REFERENCES public.bookings(id),
  CONSTRAINT user_rating_history_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.waitlist (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  restaurant_id uuid NOT NULL,
  desired_date date NOT NULL,
  desired_time_range tstzrange NOT NULL,
  party_size integer NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  status USER-DEFINED NOT NULL DEFAULT 'active'::waiting_status,
  table_type USER-DEFINED NOT NULL DEFAULT 'any'::table_type,
  CONSTRAINT waitlist_pkey PRIMARY KEY (id),
  CONSTRAINT waitlist_restaurant_id_fkey FOREIGN KEY (restaurant_id) REFERENCES public.restaurants(id),
  CONSTRAINT waitlist_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id)
);