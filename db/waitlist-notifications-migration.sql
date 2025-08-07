-- Migration: Add waitlist notifications tracking
-- This table logs all notifications sent to waitlist customers

CREATE TABLE IF NOT EXISTS public.waitlist_notifications (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  waitlist_entry_id uuid NOT NULL,
  notification_method text NOT NULL CHECK (notification_method IN ('sms', 'email', 'push')),
  message text NOT NULL,
  subject text, -- For email notifications
  sent_at timestamp with time zone NOT NULL DEFAULT now(),
  sent_by uuid, -- Staff member who sent the notification
  delivery_status text DEFAULT 'sent' CHECK (delivery_status IN ('sent', 'delivered', 'failed', 'read')),
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT waitlist_notifications_pkey PRIMARY KEY (id),
  CONSTRAINT waitlist_notifications_waitlist_entry_id_fkey FOREIGN KEY (waitlist_entry_id) REFERENCES public.waitlist(id) ON DELETE CASCADE,
  CONSTRAINT waitlist_notifications_sent_by_fkey FOREIGN KEY (sent_by) REFERENCES public.profiles(id)
);

-- Add RLS policies
ALTER TABLE public.waitlist_notifications ENABLE ROW LEVEL SECURITY;

-- Policy: Staff can view notifications for their restaurant's waitlist entries
CREATE POLICY "Restaurant staff can view waitlist notifications" ON public.waitlist_notifications
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 
      FROM public.waitlist w
      JOIN public.restaurant_staff rs ON w.restaurant_id = rs.restaurant_id
      WHERE w.id = waitlist_notifications.waitlist_entry_id
        AND rs.user_id = auth.uid()
        AND rs.is_active = true
    )
  );

-- Policy: Staff can insert notifications for their restaurant's waitlist entries  
CREATE POLICY "Restaurant staff can create waitlist notifications" ON public.waitlist_notifications
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 
      FROM public.waitlist w
      JOIN public.restaurant_staff rs ON w.restaurant_id = rs.restaurant_id
      WHERE w.id = waitlist_notifications.waitlist_entry_id
        AND rs.user_id = auth.uid()
        AND rs.is_active = true
    )
  );

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_waitlist_notifications_waitlist_entry_id 
  ON public.waitlist_notifications(waitlist_entry_id);
CREATE INDEX IF NOT EXISTS idx_waitlist_notifications_sent_at 
  ON public.waitlist_notifications(sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_waitlist_notifications_method 
  ON public.waitlist_notifications(notification_method);

-- Add additional fields to waitlist table for better tracking
ALTER TABLE public.waitlist 
ADD COLUMN IF NOT EXISTS last_notified_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS notification_count integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS created_from_booking_id uuid REFERENCES public.bookings(id);

-- Add index for better waitlist queries
CREATE INDEX IF NOT EXISTS idx_waitlist_status_date 
  ON public.waitlist(status, desired_date);
CREATE INDEX IF NOT EXISTS idx_waitlist_restaurant_status 
  ON public.waitlist(restaurant_id, status);

-- Add columns to bookings table to track waitlist origin
ALTER TABLE public.bookings
ADD COLUMN IF NOT EXISTS created_from_waitlist boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS waitlist_entry_id uuid REFERENCES public.waitlist(id);
