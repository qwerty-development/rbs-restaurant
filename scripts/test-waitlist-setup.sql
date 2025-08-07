-- Test script to check waitlist database setup
-- Run this in your Supabase SQL editor to check if waitlist is properly set up

-- Check if waitlist table exists
SELECT EXISTS (
   SELECT FROM information_schema.tables 
   WHERE  table_schema = 'public'
   AND    table_name   = 'waitlist'
) AS waitlist_table_exists;

-- Check if enum types exist
SELECT EXISTS (
   SELECT FROM pg_type 
   WHERE typname = 'waiting_status'
) AS waiting_status_type_exists;

SELECT EXISTS (
   SELECT FROM pg_type 
   WHERE typname = 'table_type'
) AS table_type_exists;

-- Check the actual enum values
SELECT unnest(enum_range(NULL::waiting_status)) AS waiting_status_values;
SELECT unnest(enum_range(NULL::table_type)) AS table_type_values;

-- If waitlist table exists, check its structure
SELECT column_name, data_type, udt_name 
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'waitlist'
ORDER BY ordinal_position;

-- Check if there are any waitlist entries
SELECT COUNT(*) as total_waitlist_entries FROM public.waitlist;
