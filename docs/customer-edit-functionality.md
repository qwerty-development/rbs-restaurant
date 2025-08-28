# Customer Edit Functionality

## Overview
The edit customer functionality allows restaurant staff to modify certain customer information directly from the customers management page. This feature respects user privacy and data integrity by only allowing edits to restaurant-specific fields.

## Editable Fields

### For Guest Customers (no user_id)
- **Guest Name**: Customer's name as recorded by the restaurant
- **Guest Email**: Contact email for booking confirmations
- **Guest Phone**: Contact phone number
- **VIP Status**: Whether the customer has VIP privileges
- **Blacklist Status**: Whether the customer is blacklisted
- **Blacklist Reason**: Reason for blacklisting (required if blacklisted)
- **Preferred Table Types**: Array of preferred seating types (booth, window, patio, etc.)
- **Preferred Time Slots**: Array of preferred dining times (breakfast, lunch, dinner, etc.)

### For Registered Users (has user_id)
- **VIP Status**: Whether the customer has VIP privileges
- **Blacklist Status**: Whether the customer is blacklisted
- **Blacklist Reason**: Reason for blacklisting (required if blacklisted)
- **Preferred Table Types**: Array of preferred seating types
- **Preferred Time Slots**: Array of preferred dining times

**Note**: Personal information (name, email, phone) for registered users cannot be edited by restaurants as it's managed in the user's profile.

## Non-Editable Fields (System Calculated)
- **User ID**: System identifier, cannot be changed
- **Restaurant ID**: System identifier, cannot be changed
- **Total Bookings**: Automatically calculated from booking history
- **Total Spent**: Automatically calculated from completed bookings
- **Average Party Size**: Automatically calculated from booking history
- **Last Visit**: Automatically updated when customer visits
- **First Visit**: Historical data, cannot be changed
- **No Show Count**: Automatically calculated from booking history
- **Cancelled Count**: Automatically calculated from booking history

## Permissions
- **View Permission**: `customers.view` - Required to see customer list
- **Edit Permission**: `customers.manage` - Required to edit customer information

## User Interface

### Access Points
1. **Quick Edit Button**: Edit icon next to each customer in the list
2. **Dropdown Menu**: "Edit Customer" option in the customer actions menu

### Edit Dialog Features
- **Customer Type Indicator**: Shows whether customer is a registered user or guest
- **Conditional Fields**: Only shows editable fields based on customer type
- **Visual Preferences**: Interactive selection for table types and time slots
- **Validation**: Form validation ensures data integrity
- **Status Indicators**: Clear display of VIP and blacklist status

### VIP Status Management
When VIP status is toggled:
- **For Registered Users**: Updates both `restaurant_customers.vip_status` and `restaurant_vip_users` table
- **For Guest Customers**: Only updates `restaurant_customers.vip_status`
- **VIP Benefits**: Extended booking windows (60 days) and priority booking

### Blacklist Management
- **Checkbox Control**: Simple toggle for blacklist status
- **Reason Required**: Must provide reason when blacklisting a customer
- **Automatic Cleanup**: Blacklist reason is cleared when customer is removed from blacklist

## Technical Implementation

### Schema Fields
```sql
-- Editable fields in restaurant_customers table
guest_name TEXT
guest_email TEXT  
guest_phone TEXT
vip_status BOOLEAN
blacklisted BOOLEAN
blacklist_reason TEXT
preferred_table_types TEXT[]
preferred_time_slots TEXT[]
```

### Form Validation
- Email validation for guest email fields
- Required blacklist reason when blacklisting
- Automatic data type conversion for arrays

### Database Operations
- Updates are conditional - only changed fields are included in the update query
- Automatic `updated_at` timestamp
- Concurrent VIP table management for registered users

### Error Handling
- Permission checks before allowing edits
- Database error handling with user-friendly messages
- Form validation with field-specific error messages

## Security Considerations
- Only restaurant staff with `customers.manage` permission can edit
- Guest customer personal data can only be edited if no user account exists
- Registered user personal data is protected and cannot be edited by restaurants
- All changes are logged with timestamps

## Future Enhancements
- Audit trail for customer data changes
- Bulk edit functionality for multiple customers
- Integration with loyalty program for automatic tier updates
- Customer consent tracking for data modifications
