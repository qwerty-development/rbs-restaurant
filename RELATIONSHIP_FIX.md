# Relationship Display Fix

## Issue
The customer relationships were incorrectly showing the current customer instead of the related person.

## Root Cause
The logic in both `BookingCustomerDetails` and `CustomerDetailsDialog` was flawed:
```typescript
// INCORRECT logic
const isCustomer = rel.customer_id === customer.id
const relatedCustomer = isCustomer ? rel.related_customer : customer // Shows current customer when isCustomer is false
```

## Solution

### 1. Updated Database Queries
Modified relationship queries to fetch both sides of the relationship:
```typescript
.select(`
  *,
  related_customer:restaurant_customers!customer_relationships_related_customer_id_fkey(
    *,
    profile:profiles(full_name, avatar_url)
  ),
  customer:restaurant_customers!customer_relationships_customer_id_fkey(
    *,
    profile:profiles(full_name, avatar_url)
  )
`)
```

### 2. Fixed Display Logic
Updated the logic to always show the OTHER person in the relationship:
```typescript
// CORRECT logic
const isCurrentCustomerTheCreator = rel.customer_id === customerData.id
const relatedCustomer = isCurrentCustomerTheCreator ? rel.related_customer : rel.customer
```

### 3. Updated TypeScript Types
Added the missing `customer` property to the `CustomerRelationship` interface:
```typescript
export interface CustomerRelationship {
  // ... existing properties
  related_customer?: RestaurantCustomer
  customer?: RestaurantCustomer  // Added this
}
```

## Files Modified
1. `components/bookings/booking-customer-details.tsx` - Fixed relationship display in booking details
2. `components/customers/customer-details-dialog.tsx` - Fixed relationship display in customer dialog
3. `types/customer.ts` - Added missing customer property to relationship interface

## Result
Now when viewing customer relationships:
- In booking details: Shows the related person, not the current customer
- In customer details: Shows the related person, not the current customer
- Works correctly for both directions of the relationship (creator → target and target → creator)
