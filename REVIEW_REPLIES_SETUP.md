# Review Replies Database Setup

This document explains how to set up the `review_replies` table for the review reply functionality.

## Database Schema

The `review_replies` table allows restaurant staff to reply to customer reviews. Each review can have at most one reply from the restaurant.

### Table Structure

```sql
CREATE TABLE public.review_replies (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  review_id uuid NOT NULL,
  restaurant_id uuid NOT NULL,
  replied_by uuid NOT NULL,
  reply_message text NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT review_replies_pkey PRIMARY KEY (id),
  CONSTRAINT review_replies_review_id_fkey FOREIGN KEY (review_id) REFERENCES public.reviews(id) ON DELETE CASCADE,
  CONSTRAINT review_replies_restaurant_id_fkey FOREIGN KEY (restaurant_id) REFERENCES public.restaurants(id) ON DELETE CASCADE,
  CONSTRAINT review_replies_replied_by_fkey FOREIGN KEY (replied_by) REFERENCES public.profiles(id),
  CONSTRAINT review_replies_review_id_unique UNIQUE (review_id)
);
```

### Key Features

- **One reply per review**: The `review_id_unique` constraint ensures each review can only have one reply
- **Cascade deletion**: If a review or restaurant is deleted, the reply is automatically deleted
- **Staff authorization**: The `replied_by` field links to the staff member who wrote the reply
- **Audit trail**: `created_at` and `updated_at` fields track when replies are made and modified

### Row Level Security (RLS)

The table uses RLS policies to ensure:
- Only restaurant staff can read/write replies for their restaurant
- Staff can only create replies for restaurants they work for
- Staff can only edit/delete their own replies

## Setup Instructions

### Option 1: Supabase Dashboard
1. Go to your Supabase project dashboard
2. Navigate to the SQL Editor
3. Copy and paste the SQL from `/tmp/create_review_replies_table.sql`
4. Run the script

### Option 2: Command Line (if you have database access)
```bash
# Copy the SQL file to your desired location
cp /tmp/create_review_replies_table.sql ./database/migrations/

# Run it with your database client
psql -d your_database -f ./database/migrations/create_review_replies_table.sql
```

## Usage

Once the table is created, the review reply functionality will work automatically:

1. Restaurant staff can see a "Reply to review" button on each review
2. Clicking the button opens a text area for composing the reply
3. Replies are displayed below the original review with restaurant branding
4. Staff can edit or delete their replies
5. Each review can only have one reply (enforced by database constraint)

## Permissions

The following staff roles can reply to reviews (based on your existing `restaurant_staff` table):
- Owner
- Manager  
- Staff
- Viewer (if they have appropriate permissions)

The system automatically validates that the user is an active staff member of the restaurant before allowing them to reply.
