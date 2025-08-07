# Waitlist Database Setup Guide

If you're seeing an error when accessing the waitlist feature, it means the database table needs to be created. Follow these steps to set up the waitlist feature:

## Quick Setup

1. **Open Supabase Dashboard**
   - Go to [https://supabase.com/dashboard](https://supabase.com/dashboard)
   - Select your project

2. **Run the Setup Script**
   - Navigate to the SQL Editor in your Supabase dashboard
   - Copy the contents of `db/setup-waitlist.sql`
   - Paste and run the script

3. **Verify Setup**
   - Refresh the waitlist page in your application
   - The feature should now work correctly

## What the Setup Script Does

The setup script (`db/setup-waitlist.sql`) creates:

- **Enum Types**: `waiting_status` and `table_type`
- **Waitlist Table**: With proper schema and constraints
- **Indexes**: For optimal query performance
- **RLS Policies**: For data security and access control
- **Permissions**: For authenticated users

## Manual Setup (Alternative)

If you prefer to create the table manually, here's the core table structure:

```sql
CREATE TABLE public.waitlist (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  restaurant_id uuid NOT NULL,
  desired_date date NOT NULL,
  desired_time_range tstzrange NOT NULL,
  party_size integer NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  status waiting_status NOT NULL DEFAULT 'active',
  table_type table_type NOT NULL DEFAULT 'any',
  CONSTRAINT waitlist_pkey PRIMARY KEY (id)
);
```

## Troubleshooting

### Common Issues:

1. **"relation does not exist" error**
   - The waitlist table hasn't been created yet
   - Run the setup script

2. **"type does not exist" error**
   - The enum types need to be created first
   - The setup script handles this automatically

3. **Permission denied errors**
   - RLS policies may not be set up correctly
   - The setup script includes proper RLS policies

### Getting Help

If you continue to have issues:
1. Check the Supabase logs in your dashboard
2. Verify that your user has proper authentication
3. Ensure your restaurant staff record exists and is active

## Testing the Feature

Once set up, you can test the waitlist feature by:
1. Navigating to the waitlist page (`/waitlist`)
2. The page should load without errors
3. You should see an empty waitlist initially
4. Staff can manage waitlist entries as they are created

For development/testing, you can add sample data using the commented section in the setup script.
