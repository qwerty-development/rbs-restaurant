-- Waitlist Feature Database Setup
-- Run this SQL script in your Supabase SQL editor to set up the waitlist feature

-- First, create the enum types if they don't exist
DO $$ BEGIN
  CREATE TYPE waiting_status AS ENUM ('active', 'notified', 'booked', 'expired');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE table_type AS ENUM ('any', 'booth', 'window', 'patio', 'standard', 'bar', 'private');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Create the waitlist table
CREATE TABLE IF NOT EXISTS public.waitlist (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  restaurant_id uuid NOT NULL,
  desired_date date NOT NULL,
  desired_time_range tstzrange NOT NULL,
  party_size integer NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  status waiting_status NOT NULL DEFAULT 'active'::waiting_status,
  table_type table_type NOT NULL DEFAULT 'any'::table_type,
  CONSTRAINT waitlist_pkey PRIMARY KEY (id),
  CONSTRAINT waitlist_restaurant_id_fkey FOREIGN KEY (restaurant_id) REFERENCES public.restaurants (id),
  CONSTRAINT waitlist_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles (id),
  CONSTRAINT waitlist_party_size_check CHECK (party_size > 0)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_waitlist_user ON public.waitlist USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_waitlist_restaurant_date ON public.waitlist USING btree (restaurant_id, desired_date);
CREATE INDEX IF NOT EXISTS idx_waitlist_restaurant_date_status_created ON public.waitlist USING btree (restaurant_id, desired_date, status, created_at);

-- Enable Row Level Security (RLS)
ALTER TABLE public.waitlist ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for waitlist table
-- Policy for restaurant staff to view waitlist entries for their restaurant
CREATE POLICY "Restaurant staff can view their restaurant's waitlist" ON public.waitlist
  FOR SELECT 
  USING (
    restaurant_id IN (
      SELECT restaurant_id 
      FROM restaurant_staff 
      WHERE user_id = auth.uid() 
      AND is_active = true
    )
  );

-- Policy for restaurant staff to update waitlist entries for their restaurant
CREATE POLICY "Restaurant staff can update their restaurant's waitlist" ON public.waitlist
  FOR UPDATE 
  USING (
    restaurant_id IN (
      SELECT restaurant_id 
      FROM restaurant_staff 
      WHERE user_id = auth.uid() 
      AND is_active = true
    )
  );

-- Policy for customers to view their own waitlist entries
CREATE POLICY "Users can view their own waitlist entries" ON public.waitlist
  FOR SELECT 
  USING (user_id = auth.uid());

-- Policy for customers to insert their own waitlist entries
CREATE POLICY "Users can insert their own waitlist entries" ON public.waitlist
  FOR INSERT 
  WITH CHECK (user_id = auth.uid());

-- Policy for customers to update their own waitlist entries (for cancellation)
CREATE POLICY "Users can update their own waitlist entries" ON public.waitlist
  FOR UPDATE 
  USING (user_id = auth.uid());

-- Add some sample data for testing (optional)
-- You can uncomment these lines and modify the UUIDs to match your data
/*
INSERT INTO public.waitlist (user_id, restaurant_id, desired_date, desired_time_range, party_size, status, table_type) VALUES 
  ('your-user-uuid-here', 'your-restaurant-uuid-here', '2025-08-08', '["2025-08-08 19:00:00+00", "2025-08-08 21:00:00+00")', 4, 'active', 'booth'),
  ('another-user-uuid', 'your-restaurant-uuid-here', '2025-08-08', '["2025-08-08 20:00:00+00", "2025-08-08 22:00:00+00")', 2, 'contacted', 'window');
*/

-- Grant necessary permissions
GRANT ALL ON public.waitlist TO authenticated;
GRANT ALL ON public.waitlist TO service_role;
