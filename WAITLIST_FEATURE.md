# Waitlist Feature Implementation

This document describes the waitlist feature implementation for the restaurant booking system.

## Overview

The waitlist feature allows customers to join a waiting list when their preferred booking time is not available. Restaurant staff can then manage these waitlist entries through a dedicated interface.

## Database Schema

The waitlist is stored in the `public.waitlist` table with the following structure:

```sql
CREATE TABLE public.waitlist (
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
  CONSTRAINT waitlist_restaurant_id_fkey FOREIGN KEY (restaurant_id) REFERENCES restaurants (id),
  CONSTRAINT waitlist_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles (id)
);
```

### Enum Types

- **waiting_status**: `active`, `contacted`, `seated`, `cancelled`, `expired`
- **table_type**: `any`, `booth`, `window`, `patio`, `standard`, `bar`, `private`

## Features Implemented

### 1. Sidebar Navigation
- Added "Waiting List" button in the sidebar below "Analytics"
- Uses Clock icon and requires `bookings.view` permission
- Navigates to `/waitlist`

### 2. Waitlist Management Page (`/waitlist`)
- **Statistics Cards**: Shows total entries, active, contacted, and completed counts
- **Filtering Options**:
  - Search by customer name or email
  - Filter by status (all, active, contacted, seated, cancelled, expired)
  - Filter by date (all, today, tomorrow, future, past)
- **Tabbed View**: Organized by status for better management
- **Restaurant Isolation**: Only shows waitlist entries for the current restaurant

### 3. Waitlist Entry Cards
- **Customer Information**: Name, email, phone, avatar
- **Booking Details**: Desired date, time range, party size, table preference
- **Status Management**: Visual status badges with color coding
- **Quick Actions**:
  - Mark as Contacted
  - Seat Customer
  - Create Booking (redirects to booking form with pre-filled data)
  - Cancel Entry

### 4. Status Workflow
```
active → contacted → seated
   ↓         ↓
cancelled  cancelled
```

### 5. Integration with Booking System
- "Create Booking" button redirects to `/bookings/create` with pre-filled parameters:
  - `party_size`: Number of guests
  - `date`: Desired date
  - `time_range`: Desired time range
  - `table_type`: Table preference
  - `user_id`: Customer ID
  - `from_waitlist`: Flag indicating source
  - `waitlist_id`: Reference to waitlist entry

## File Structure

```
app/(dashboard)/waitlist/
  └── page.tsx                 # Main waitlist management page

components/waitlist/
  └── waitlist-entry-card.tsx  # Individual waitlist entry component

lib/utils/
  └── time-utils.ts           # Utility functions for time formatting

types/
  └── index.ts                # Added WaitlistEntry interface
```

## Components

### WaitlistEntryCard
Reusable component for displaying individual waitlist entries with:
- Customer information display
- Status badge
- Quick action buttons
- Dropdown menu for additional actions
- Loading states during updates

### Utility Functions
- `formatTimeRange()`: Parses PostgreSQL tstzrange format
- `getTableTypeDisplay()`: Converts table type to display name
- `getStatusColor()`: Returns appropriate CSS classes for status badges

## Permissions

The waitlist feature uses the existing `bookings.view` permission to control access. Staff members with this permission can:
- View the waitlist page
- Update entry statuses
- Create bookings from waitlist entries

## Security

- **Restaurant Isolation**: All queries filter by `restaurant_id` to ensure restaurants only see their own waitlist
- **Staff Validation**: Validates staff permissions before allowing access
- **User Authentication**: Requires authenticated session

## Usage Instructions

### For Restaurant Staff:

1. **Access**: Navigate to "Waiting List" in the sidebar
2. **View Entries**: See all waitlist entries organized by status
3. **Filter**: Use search and filters to find specific entries
4. **Manage Status**: 
   - Mark customers as "Contacted" when you reach out
   - Mark as "Seated" when a table becomes available
   - Cancel entries if needed
5. **Create Bookings**: Use "Create Booking" to convert waitlist entries to confirmed bookings

### Status Meanings:
- **Active**: New waitlist entry, needs attention
- **Contacted**: Staff has reached out to customer
- **Seated**: Customer has been accommodated
- **Cancelled**: Entry was cancelled (by staff or customer)
- **Expired**: Entry has expired (can be implemented with automated rules)

## Future Enhancements

Potential improvements for the waitlist feature:
1. **Automated Notifications**: Email/SMS when tables become available
2. **Priority Scoring**: VIP customers or special occasions get higher priority
3. **Time-based Expiration**: Automatically expire old entries
4. **Analytics**: Waitlist conversion rates and timing analysis
5. **Customer Self-Service**: Allow customers to join waitlist from booking flow
6. **Real-time Updates**: WebSocket integration for live status updates
