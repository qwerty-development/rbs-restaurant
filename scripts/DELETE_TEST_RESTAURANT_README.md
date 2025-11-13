# Delete Test Restaurant Data

This document explains how to delete all data for the test restaurant with ID: `48176058-02a7-40f4-a6da-4b7cc50dfb59`

## ⚠️ WARNING

**This will permanently delete all data associated with this restaurant!**

- All bookings and reservations
- All customer records
- All menu items and categories
- All orders and transactions
- All staff records
- All analytics and history
- Everything else related to this restaurant

**Make sure you have a backup if you need to restore this data later!**

## Option 1: Run SQL Script (Recommended - Easiest)

This is the simplest approach and doesn't require any local setup.

### Steps:

1. Go to your Supabase SQL Editor:
   ```
   https://supabase.com/dashboard/project/xsovqvbigdettnpeisjs/sql/new
   ```

2. Copy the entire contents of `scripts/delete-test-restaurant-data.sql`

3. Paste it into the SQL editor

4. Review the script to make sure you understand what it does

5. Click "Run" to execute

6. The script will show you progress messages as it deletes data from each table

7. If everything looks good, it will commit the transaction automatically

8. If you want to rollback instead (undo the changes), comment out `COMMIT;` and uncomment `ROLLBACK;` at the end of the script before running

## Option 2: Run TypeScript Script

This approach uses Node.js/TypeScript and requires environment setup.

### Prerequisites:

1. Node.js installed (v18 or higher)
2. Supabase credentials

### Steps:

1. **Get your Supabase credentials:**

   Visit: https://supabase.com/dashboard/project/xsovqvbigdettnpeisjs/settings/api

   You'll need:
   - Project URL (already set in `.env.local`)
   - `anon` public key
   - `service_role` secret key (⚠️ Keep this secure!)

2. **Update `.env.local` file:**

   Open `/home/user/rbs-restaurant/.env.local` and fill in the credentials:

   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://xsovqvbigdettnpeisjs.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   ```

3. **Run the script:**

   ```bash
   npm run delete:test-restaurant
   ```

4. **Review the output:**

   The script will:
   - First check what data exists
   - Show you a count of records to be deleted
   - Wait 3 seconds for you to cancel (Ctrl+C)
   - Delete all data in the correct order
   - Verify that all data was deleted successfully

## Verification

After running either script, you can verify the deletion by:

1. **Using SQL:**
   ```sql
   SELECT
     'bookings' as table_name, COUNT(*) as count
   FROM bookings
   WHERE restaurant_id = '48176058-02a7-40f4-a6da-4b7cc50dfb59'
   UNION ALL
   SELECT 'menu_items', COUNT(*)
   FROM menu_items
   WHERE restaurant_id = '48176058-02a7-40f4-a6da-4b7cc50dfb59'
   -- Add more tables as needed
   ```

2. **Check the admin dashboard:**
   - Go to the dashboard
   - Search for the restaurant ID
   - Verify that no data appears

## Tables Affected

The deletion process handles all these tables (in the correct order to respect foreign key constraints):

### Child Tables (deleted first):
- booking_invites
- booking_status_history
- booking_tables
- loyalty_activities
- loyalty_redemptions
- review_reports
- review_replies
- reviews
- customer_notes
- customer_preferences
- customer_relationships
- customer_tag_assignments
- order_modifications
- kitchen_assignments
- order_status_history
- order_items
- post_comments, post_images, post_likes, post_tags
- staff_position_assignments
- staff_availability, staff_shifts, staff_schedules
- time_clock_entries, time_off_requests
- user_offers, user_loyalty_rule_usage

### Parent Tables (deleted after children):
- bookings
- orders
- posts
- customer_tags
- restaurant_customers
- special_offers
- restaurant_loyalty_rules
- staff_positions
- menu_items
- menu_categories
- kitchen_stations
- restaurant_tables
- restaurant_sections
- floor_plans
- push_subscriptions
- waitlist
- And many more...

### Restaurant Staff (deleted last):
- restaurant_staff

## Troubleshooting

### "Missing required environment variables"
- Make sure `.env.local` has all the required values
- Double-check that the keys are correct (no extra spaces)

### "Foreign key constraint violation"
- The scripts are designed to handle this, but if it happens:
- The SQL script uses a transaction that will rollback on error
- Review the error message to see which table is causing issues

### "Permission denied"
- Make sure you're using the `service_role` key, not the `anon` key
- The service role key bypasses RLS policies

## Need Help?

If you encounter any issues:
1. Check the Supabase logs for errors
2. Review the foreign key relationships in `db/schema.sql`
3. Try running the SQL script with ROLLBACK first to test without committing

## After Deletion

Once the data is deleted:
- The restaurant record itself will still exist in the `restaurants` table (not deleted by these scripts)
- If you want to delete the restaurant record too, run:
  ```sql
  DELETE FROM restaurants WHERE id = '48176058-02a7-40f4-a6da-4b7cc50dfb59';
  ```
