# Database Schema Compatibility Fix

## Issue
The customer integration features were using incorrect column names that don't exist in the actual database schema:
- `blacklist_status` (doesn't exist) → should be `blacklisted` (boolean)
- `notes` (doesn't exist in restaurant_customers table) → exists in separate `customer_notes` table
- `tags` (doesn't exist in restaurant_customers table) → exists in separate `customer_tags` table  
- `dietary_restrictions` (doesn't exist in restaurant_customers table) → exists in `profiles` table

## Database Schema Analysis
According to the actual schema, the `restaurant_customers` table has:
- `blacklisted` (boolean) - whether customer is blacklisted
- `blacklist_reason` (text) - reason for blacklisting
- `vip_status` (boolean) - VIP status
- `preferred_table_types` (array) - table preferences
- `total_bookings`, `total_spent`, `no_show_count` - customer metrics

## Changes Made

### 1. Dashboard Page (`app/(dashboard)/dashboard/page.tsx`)
- **Fixed customer data query**: Updated to select correct columns (`blacklisted` instead of `blacklist_status`)
- **Removed non-existent columns**: Removed `notes`, `tags`, `dietary_restrictions` from query
- **Updated customer indicators**: Changed references throughout component to use `blacklisted` instead of `blacklist_status`
- **Simplified UI**: Removed dietary restrictions and notes badges since they're not in the main table

### 2. Check-in Manager (`components/dashboard/checkin-manager.tsx`)
- **Fixed badge logic**: Updated `blacklist_status` → `blacklisted`
- **Removed invalid references**: Removed dietary restrictions and notes displays
- **Added blacklist alert**: Show blacklist reason when customer is blacklisted

### 3. Timeline Component (`components/dashboard/todays-timeline.tsx`)
- **Fixed badge logic**: Updated `blacklist_status` → `blacklisted`
- **Removed invalid badges**: Removed dietary restrictions badge

### 4. Recent Bookings (`components/dashboard/recent-bookings.tsx`)
- **Fixed import statement**: Corrected broken import from previous edit
- **Fixed badge logic**: Updated `blacklist_status` → `blacklisted`
- **Removed invalid badges**: Removed dietary restrictions and notes badges

## Current Customer Data Structure
The dashboard now correctly displays:
- ⭐ VIP badge for `vip_status: true`
- 🚫 Alert badge for `blacklisted: true`
- Alert message showing `blacklist_reason` when applicable

## Future Enhancements
To add notes, tags, and dietary restrictions back:
1. **Customer Notes**: Query `customer_notes` table and join on `customer_id`
2. **Customer Tags**: Query `customer_tag_assignments` → `customer_tags` relationship
3. **Dietary Restrictions**: Query `profiles.dietary_restrictions` for user dietary info

## Database Schema Compliance
All queries now use only columns that exist in the actual database schema, ensuring:
- No runtime database errors
- Consistent data display
- Proper customer status indicators
- Maintainable code aligned with schema
