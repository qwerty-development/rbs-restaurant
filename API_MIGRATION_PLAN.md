# API Routes Migration to Direct Supabase Calls

This document outlines the remaining API routes that should be converted to use direct Supabase calls, following the core architectural principle: **"NEVER USE API ROUTES for database operations"**.

## ✅ Completed
- `/api/migration/serveme` → Converted to `lib/services/migration-service.ts`

## 🔄 Remaining API Routes to Convert

### High Priority Database Operations
These routes should be converted first as they directly violate the architecture:

1. **`/api/customers/merge`** → Create `lib/services/customer-operations.ts`
2. **`/api/bookings`** → Use React Query hooks with direct Supabase calls  
3. **`/api/bookings/[id]`** → Use `useBooking(id)` hook
4. **`/api/bookings/[id]/accept`** → Create `lib/services/booking-actions.ts`
5. **`/api/bookings/[id]/decline`** → Create `lib/services/booking-actions.ts`
6. **`/api/bookings/[id]/check-in`** → Create `lib/services/booking-actions.ts`
7. **`/api/bookings/[id]/seat`** → Create `lib/services/table-operations.ts`
8. **`/api/orders`** → Use `useOrders()` hook with direct Supabase
9. **`/api/orders/[id]`** → Use `useOrder(id)` hook  
10. **`/api/orders/[id]/status`** → Create `lib/services/order-operations.ts`
11. **`/api/menu/categories`** → Use `useMenuCategories()` hook
12. **`/api/menu/items`** → Use `useMenuItems()` hook
13. **`/api/menu/items/[id]`** → Use `useMenuItem(id)` hook

### Medium Priority
14. **`/api/kitchen/events`** → Use realtime subscriptions
15. **`/api/kitchen/orders`** → Use `useKitchenOrders()` hook
16. **`/api/kitchen/stations`** → Use `useKitchenStations()` hook
17. **`/api/performance/metrics`** → Create `lib/services/analytics.ts`
18. **`/api/restaurants/[id]/location`** → Create `lib/services/restaurant-operations.ts`

### Keep (Non-Database Operations)
These can remain as they don't violate the architecture:

- **`/api/auth/[...supabase]`** ✅ Auth handler (keep)
- **`/api/staff-ai`** ✅ AI operations (keep) 
- **`/api/bookings/[id]/orders`** ✅ Complex business logic (keep)
- **`/api/kitchen/workload`** ✅ Complex calculations (keep)

## 🎯 Implementation Strategy

### Phase 1: Core Booking Operations
```typescript
// lib/services/booking-operations.ts
export async function acceptBooking(bookingId: string, staffId: string) {
  const supabase = createClient()
  // Direct Supabase call
}

export async function declineBooking(bookingId: string, reason: string) {
  const supabase = createClient()
  // Direct Supabase call
}
```

### Phase 2: React Query Hooks
```typescript
// lib/hooks/use-bookings.ts
export function useBookings(restaurantId: string) {
  const supabase = createClient()
  return useQuery({
    queryKey: ['bookings', restaurantId],
    queryFn: () => supabase.from('bookings').select('*').eq('restaurant_id', restaurantId)
  })
}
```

### Phase 3: Menu & Kitchen Operations
Convert menu and kitchen API routes to direct Supabase calls with real-time subscriptions.

## 🚀 Benefits of Conversion

1. **Performance**: Remove unnecessary API layer
2. **Simplicity**: Direct database access
3. **Real-time**: Native Supabase subscriptions
4. **Security**: RLS policies handle access control
5. **Type Safety**: Better TypeScript integration
6. **Architecture Compliance**: Follow established patterns

## 📋 Next Steps

1. Start with booking operations (highest impact)
2. Create service files for business logic
3. Replace API calls with React Query hooks
4. Test each conversion thoroughly
5. Remove API route files after conversion
6. Update documentation

This conversion will align the entire codebase with the core architectural principle of using direct Supabase calls exclusively.
