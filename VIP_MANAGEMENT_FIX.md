# VIP Management Fix

## Problem
When removing a customer from VIP status via the VIP page and then trying to add them back via the customers page, a unique constraint violation error occurred:

```
Error: duplicate key value violates unique constraint "restaurant_vip_users_restaurant_id_user_id_key"
```

## Root Cause
The `restaurant_vip_users` table has a unique constraint on `(restaurant_id, user_id)` combination. The original implementation had inconsistent approaches:

1. **VIP Page removal**: Updated `valid_until` to a past date, leaving the record in the database
2. **Customer Page addition**: Used `upsert` which should work but could conflict with existing records

## Solution

### 1. VIP Page (`app/(dashboard)/vip/page.tsx`)

**Remove VIP (`removeVIPMutation`)**:
- ✅ **Before**: Updated `valid_until` to past date
- ✅ **After**: Delete the record completely
- ✅ **Added**: Update `restaurant_customers.vip_status = false`

**Add VIP (`addVIPMutation`)**:
- ✅ **Added**: Delete any existing VIP records before inserting new one
- ✅ **Added**: Update `restaurant_customers.vip_status = true`

### 2. Customer Page (`app/(dashboard)/customers/page.tsx`)

**Toggle VIP (`handleToggleVIP`)**:

**Remove VIP**:
- ✅ **Before**: Used `upsert` to set past `valid_until`
- ✅ **After**: Find and delete the specific VIP record
- ✅ **Kept**: Update `restaurant_customers.vip_status = false`

**Add VIP**:
- ✅ **Before**: Used `upsert` (could cause constraint violations)
- ✅ **After**: Delete any existing records, then insert new one
- ✅ **Kept**: Update `restaurant_customers.vip_status = true`

## Key Changes

### Consistent Delete Strategy
Both pages now use a "delete-then-insert" approach to avoid unique constraint violations:

```javascript
// Delete any existing VIP record first
await supabase
  .from('restaurant_vip_users')
  .delete()
  .eq('restaurant_id', restaurantId)
  .eq('user_id', userId)

// Then insert the new VIP record
await supabase
  .from('restaurant_vip_users')
  .insert({
    restaurant_id: restaurantId,
    user_id: userId,
    extended_booking_days: 60,
    priority_booking: true,
    valid_until: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()
  })
```

### Data Consistency
Both tables are now kept in sync:
- `restaurant_vip_users`: Contains active VIP records
- `restaurant_customers.vip_status`: Boolean flag for quick queries

### Error Handling
- Better error messages for constraint violations
- Graceful handling of missing records
- Non-blocking updates to `restaurant_customers` table

## Testing

A test script (`test-vip-fix.js`) is provided to verify the fix works correctly by:
1. Cleaning up existing test data
2. Adding VIP status
3. Removing VIP status
4. Re-adding VIP status (this step previously failed)
5. Final cleanup

## Benefits

1. **No More Constraint Violations**: Delete-then-insert eliminates unique constraint conflicts
2. **Data Consistency**: Both tables stay synchronized
3. **Better UX**: Users can add/remove VIP status without errors
4. **Cleaner Data**: No "expired" VIP records cluttering the database
5. **Predictable Behavior**: Same logic across both pages

## Migration Notes

No database migration is required. The fix is purely in the application logic.

Existing expired VIP records (with past `valid_until` dates) will be automatically cleaned up when those users are toggled again.
