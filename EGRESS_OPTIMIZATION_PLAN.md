# Egress Optimization Plan

## Overview
Analysis found your high egress is caused by:
1. **Aggressive polling** (15-30s intervals across 10+ hooks)
2. **Over-fetching data** (wildcard selects with deep relations)
3. **Missing pagination** (unlimited queries on large tables)
4. **Redundant queries** (same data fetched multiple times)

**Expected Impact**: 40-70% egress reduction

---

## Phase 1: Quick Wins (30 minutes, 40-50% reduction)

### Fix 1.1: Shared Tables Polling
**File**: `hooks/use-shared-tables.ts`
**Lines**: 32, 140, 183

**Current**:
```typescript
refetchInterval: 15000, // Line 140
refetchInterval: 30000, // Lines 32, 183
```

**Fix**:
```typescript
// Import adaptive refetch
import { useAdaptiveBookingConfig } from './use-adaptive-refetch'

// In each hook, replace static refetchInterval with:
const adaptiveConfig = useAdaptiveBookingConfig(healthStatus)

// Then in useQuery:
refetchInterval: adaptiveConfig.refetchInterval,
staleTime: adaptiveConfig.staleTime,
```

**Impact**: Reduces shared table queries from 5,760/day → 2,880/day (50% reduction)

---

### Fix 1.2: Kitchen Orders Polling
**File**: `lib/hooks/use-orders.ts`
**Line**: 356

**Current**:
```typescript
refetchInterval: 15 * 1000, // Always 15 seconds
```

**Fix**:
```typescript
import { useAdaptiveBookingConfig } from '@/hooks/use-adaptive-refetch'

// Add to hook:
const adaptiveConfig = useAdaptiveBookingConfig(healthStatus)

// In useQuery:
refetchInterval: adaptiveConfig.refetchInterval, // 30s when healthy, 15s when disconnected
```

**Impact**: Reduces kitchen queries from 5,760/day → 2,880/day (50% reduction)

---

### Fix 1.3: Revenue Dashboard - Add Pagination + Reduce Queries
**File**: `components/analytics/revenue-dashboard.tsx`
**Lines**: 146-270

**Problem**:
- No `.limit()` on order queries (can fetch thousands)
- Makes 2 separate queries for current + previous periods

**Fix - Part A: Add Limit**:
```typescript
// Line ~180, add .limit(1000) before .order()
const { data: orders, error } = await supabase
  .from('orders')
  .select(`...`)
  .eq('restaurant_id', restaurantId)
  .gte('created_at', start.toISOString())
  .lte('created_at', end.toISOString())
  .in('status', ['completed', 'served'])
  .limit(1000) // ← ADD THIS
  .order('created_at', { ascending: false })
```

**Fix - Part B: Combine Previous Period Query**:
```typescript
// Lines 264-270 - Remove second query, calculate previous period in same query
// Change the query to fetch both periods:
const prevStart = new Date(start)
prevStart.setDate(prevStart.getDate() - (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))

const { data: orders, error } = await supabase
  .from('orders')
  .select(`
    id,
    total_amount,
    subtotal,
    tax_amount,
    order_type,
    course_type,
    created_at,
    completed_at,
    status
  `) // ← Removed booking and order_items join for comparison query
  .eq('restaurant_id', restaurantId)
  .gte('created_at', prevStart.toISOString())
  .lte('created_at', end.toISOString())
  .in('status', ['completed', 'served'])
  .limit(2000) // ← Increased limit for 2 periods
  .order('created_at', { ascending: false })

// Then filter in code:
const currentPeriodOrders = orders.filter(o => new Date(o.created_at) >= start)
const previousPeriodOrders = orders.filter(o => new Date(o.created_at) < start)
```

**Impact**:
- Prevents unbounded queries on large date ranges (potential 10,000+ orders → 1,000 max)
- Reduces 2 queries → 1 query (50% reduction)
- Estimated: 70% egress reduction for revenue dashboard

---

### Fix 1.4: Add Pagination to Unbounded Queries

**File**: `hooks/use-shared-tables.ts`
**Line**: 174 (useSharedTableBookings)

**Current**:
```typescript
.order("booking_time", { ascending: true })
// No limit
```

**Fix**:
```typescript
.order("booking_time", { ascending: true })
.limit(100) // ← ADD THIS - safety measure for busy days
```

**File**: `lib/hooks/use-events.ts`
**Line**: 582 (useEventOccurrenceBookings)

**Current**:
```typescript
.order('created_at', { ascending: false })
// No limit
```

**Fix**:
```typescript
.order('created_at', { ascending: false })
.limit(100) // ← ADD THIS
```

**Impact**: Prevents potential runaway queries on busy days (estimated 20-30% reduction for affected hooks)

---

## Phase 2: Field Selection Optimization (15 minutes, 15-20% additional reduction)

### Fix 2.1: Table Combinations - Remove Wildcard Selects
**File**: `lib/hooks/use-table-combinations.ts`
**Lines**: 17-26

**Current**:
```typescript
.select(`
  *,
  primary_table:restaurant_tables!table_combinations_primary_table_id_fkey(*),
  secondary_table:restaurant_tables!table_combinations_secondary_table_id_fkey(*)
`)
```

**Fix**:
```typescript
.select(`
  id,
  restaurant_id,
  primary_table_id,
  secondary_table_id,
  combined_capacity,
  is_active,
  created_at,
  primary_table:restaurant_tables!table_combinations_primary_table_id_fkey(
    id,
    table_number,
    max_capacity,
    section_id,
    status
  ),
  secondary_table:restaurant_tables!table_combinations_secondary_table_id_fkey(
    id,
    table_number,
    max_capacity,
    section_id,
    status
  )
`)
```

**Impact**: Reduces data transfer by ~40% for table combinations (removes position_x, position_y, width, height, rotation, features array, etc.)

---

### Fix 2.2: Comprehensive Restaurant Data - Specify Fields
**File**: `lib/hooks/use-comprehensive-restaurant-data.ts`
**Lines**: 111-125

**Current**:
```typescript
.select(`
  *,
  profiles!bookings_user_id_fkey(full_name, phone_number),
  ...
`)
```

**Fix**:
```typescript
.select(`
  id,
  booking_time,
  party_size,
  status,
  guest_name,
  guest_phone,
  user_id,
  restaurant_id,
  created_at,
  profiles!bookings_user_id_fkey(
    id,
    full_name,
    phone_number
  ),
  booking_tables(
    table:restaurant_tables(id, table_number, max_capacity, section_id)
  ),
  restaurant_customers!bookings_user_id_fkey(vip_status)
`)
```

**Impact**: Reduces booking query size by ~30% (removes special_requests, dietary_notes, occasion, metadata, etc.)

---

## Phase 3: Database-Level Optimization (Medium Effort, 20-30% additional reduction)

### Fix 3.1: Create RPC for Comprehensive Dashboard Data
**Why**: `use-comprehensive-restaurant-data.ts` makes 4 separate queries that could be 1

**Create Migration**: `db/migrations/20250127_create_dashboard_rpc.sql`

```sql
-- RPC to get comprehensive dashboard data in single call
CREATE OR REPLACE FUNCTION get_comprehensive_restaurant_dashboard(
  p_restaurant_id UUID,
  p_date DATE DEFAULT CURRENT_DATE
) RETURNS JSON AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_build_object(
    'bookings', (
      SELECT json_agg(row_to_json(b))
      FROM (
        SELECT
          id, booking_time, party_size, status, guest_name, user_id,
          (SELECT row_to_json(p) FROM (
            SELECT id, full_name, phone_number
            FROM profiles WHERE id = bookings.user_id
          ) p) as user,
          (SELECT json_agg(row_to_json(bt)) FROM (
            SELECT id, table_number, max_capacity, section_id
            FROM restaurant_tables rt
            JOIN booking_tables bts ON bts.table_id = rt.id
            WHERE bts.booking_id = bookings.id
          ) bt) as tables
        FROM bookings
        WHERE restaurant_id = p_restaurant_id
          AND DATE(booking_time) = p_date
          AND status != 'cancelled'
        ORDER BY booking_time
      ) b
    ),
    'tables', (
      SELECT json_agg(row_to_json(t))
      FROM (
        SELECT id, table_number, max_capacity, section_id, status
        FROM restaurant_tables
        WHERE restaurant_id = p_restaurant_id
          AND is_active = true
        ORDER BY section_id, table_number
      ) t
    ),
    'waitlist_count', (
      SELECT COUNT(*)
      FROM waitlist
      WHERE restaurant_id = p_restaurant_id
        AND status = 'waiting'
    ),
    'pending_bookings_count', (
      SELECT COUNT(*)
      FROM bookings
      WHERE restaurant_id = p_restaurant_id
        AND status = 'pending'
    )
  ) INTO result;

  RETURN result;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;
```

**Update Hook**: `lib/hooks/use-comprehensive-restaurant-data.ts`

```typescript
// Replace multiple queries with single RPC call
const { data, error } = await supabase.rpc('get_comprehensive_restaurant_dashboard', {
  p_restaurant_id: restaurantId,
  p_date: currentDate
})

// Transform response:
return {
  bookings: data.bookings || [],
  tables: data.tables || [],
  waitlistCount: data.waitlist_count || 0,
  pendingBookingsCount: data.pending_bookings_count || 0
}
```

**Impact**:
- Reduces 4 queries → 1 RPC call
- Reduces round trips and connection overhead
- Estimated 30-40% reduction in dashboard egress

---

### Fix 3.2: Create RPC for Revenue Analytics
**Create Migration**: `db/migrations/20250127_create_revenue_rpc.sql`

```sql
CREATE OR REPLACE FUNCTION get_revenue_analytics(
  p_restaurant_id UUID,
  p_start_date TIMESTAMP,
  p_end_date TIMESTAMP
) RETURNS JSON AS $$
DECLARE
  result JSON;
  prev_start TIMESTAMP;
  period_duration INTERVAL;
BEGIN
  -- Calculate previous period
  period_duration := p_end_date - p_start_date;
  prev_start := p_start_date - period_duration;

  SELECT json_build_object(
    'current_period', (
      SELECT json_build_object(
        'total_revenue', COALESCE(SUM(total_amount), 0),
        'order_count', COUNT(*),
        'avg_order_value', COALESCE(AVG(total_amount), 0),
        'order_types', json_object_agg(
          order_type,
          json_build_object('count', type_count, 'revenue', type_revenue)
        )
      )
      FROM (
        SELECT
          total_amount,
          order_type,
          COUNT(*) OVER (PARTITION BY order_type) as type_count,
          SUM(total_amount) OVER (PARTITION BY order_type) as type_revenue
        FROM orders
        WHERE restaurant_id = p_restaurant_id
          AND created_at >= p_start_date
          AND created_at <= p_end_date
          AND status IN ('completed', 'served')
      ) current_orders
    ),
    'previous_period', (
      SELECT json_build_object(
        'total_revenue', COALESCE(SUM(total_amount), 0),
        'order_count', COUNT(*)
      )
      FROM orders
      WHERE restaurant_id = p_restaurant_id
        AND created_at >= prev_start
        AND created_at < p_start_date
        AND status IN ('completed', 'served')
    )
  ) INTO result;

  RETURN result;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;
```

**Impact**:
- Aggregates at database level (much faster)
- Reduces 2 large queries → 1 small RPC call
- Estimated 60-70% reduction in revenue dashboard egress

---

## Phase 4: Realtime Subscription Optimization (20 minutes, 10-15% reduction)

### Fix 4.1: Consolidate Overlapping Channels
**Problem**: Multiple components subscribe to same tables independently

**Files Affected**:
- `lib/hooks/use-realtime-bookings.ts`
- `lib/hooks/use-realtime-tables.ts`
- `lib/hooks/use-realtime-orders.ts`
- `app/(dashboard)/bookings/page.tsx:129-143`

**Current Pattern**:
```typescript
// Component A
supabase.channel('bookings-a').on(...).subscribe()

// Component B
supabase.channel('bookings-b').on(...).subscribe()
```

**Fix - Create Global Subscription Manager**:

**New File**: `lib/hooks/use-global-realtime.ts`

```typescript
import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase/client'

export function useGlobalRealtimeSubscriptions(restaurantId: string) {
  const queryClient = useQueryClient()

  useEffect(() => {
    if (!restaurantId) return

    // Single consolidated channel for all restaurant data
    const channel = supabase
      .channel(`restaurant:${restaurantId}:all`)

      // Bookings
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'bookings',
        filter: `restaurant_id=eq.${restaurantId}`
      }, () => {
        queryClient.invalidateQueries({ queryKey: ['bookings', restaurantId] })
        queryClient.invalidateQueries({ queryKey: ['todays-bookings', restaurantId] })
      })

      // Tables
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'restaurant_tables',
        filter: `restaurant_id=eq.${restaurantId}`
      }, () => {
        queryClient.invalidateQueries({ queryKey: ['tables', restaurantId] })
      })

      // Orders
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'orders',
        filter: `restaurant_id=eq.${restaurantId}`
      }, () => {
        queryClient.invalidateQueries({ queryKey: ['orders', restaurantId] })
        queryClient.invalidateQueries({ queryKey: ['kitchen-orders', restaurantId] })
      })

      .subscribe()

    return () => {
      channel.unsubscribe()
    }
  }, [restaurantId, queryClient])
}
```

**Use in Dashboard Layout**: `app/(dashboard)/layout.tsx`

```typescript
import { useGlobalRealtimeSubscriptions } from '@/lib/hooks/use-global-realtime'

export default function DashboardLayout({ children }) {
  const restaurantId = useRestaurantId()

  // Single subscription for entire dashboard
  useGlobalRealtimeSubscriptions(restaurantId)

  return <>{children}</>
}
```

**Remove Individual Subscriptions**: Comment out `.subscribe()` calls in:
- `use-realtime-bookings.ts`
- `use-realtime-tables.ts`
- `use-realtime-orders.ts`
- `bookings/page.tsx`

**Impact**:
- Reduces 5+ channels → 1 channel
- Eliminates duplicate postgres_changes listeners
- Estimated 10-15% reduction in realtime overhead

---

## Summary of Expected Impact

| Phase | Effort | Egress Reduction | Files Changed |
|-------|--------|------------------|---------------|
| **Phase 1: Quick Wins** | 30 min | 40-50% | 4 files |
| **Phase 2: Field Selection** | 15 min | 15-20% | 2 files |
| **Phase 3: Database RPCs** | 2 hours | 20-30% | 2 migrations + 2 hooks |
| **Phase 4: Realtime Consolidation** | 20 min | 10-15% | 1 new file + 4 updates |
| **TOTAL** | ~3.5 hours | **60-70%** | ~13 files |

---

## Recommended Implementation Order

### Day 1 (Production-Safe Quick Wins)
1. ✅ Implement Phase 1.1 - Shared tables polling (5 min)
2. ✅ Implement Phase 1.2 - Kitchen orders polling (5 min)
3. ✅ Implement Phase 1.4 - Add pagination limits (5 min)
4. ✅ Implement Phase 2.1 - Table combinations fields (5 min)
5. ✅ Implement Phase 2.2 - Comprehensive data fields (5 min)

**Total Time**: 25 minutes
**Expected Reduction**: 40-50% egress
**Risk**: LOW (all reversible changes)

### Day 2 (Revenue Dashboard Fix)
6. ✅ Implement Phase 1.3 - Revenue pagination + combine queries (15 min)

**Total Time**: 15 minutes
**Expected Reduction**: Additional 10-15%
**Risk**: LOW (add limits + client-side filtering)

### Day 3+ (Advanced Optimizations - Optional)
7. ⚠️ Implement Phase 3.1 - Dashboard RPC (1 hour)
8. ⚠️ Implement Phase 3.2 - Revenue RPC (1 hour)
9. ⚠️ Implement Phase 4.1 - Realtime consolidation (20 min)

**Total Time**: 2.5 hours
**Expected Reduction**: Additional 20-30%
**Risk**: MEDIUM (requires database migrations, test thoroughly in staging)

---

## Testing Checklist

### Before Deployment
- [ ] Run `npm run build` - verify no TypeScript errors
- [ ] Test each dashboard page locally
- [ ] Check browser Network tab - verify reduced query count
- [ ] Monitor Supabase dashboard - check query count metrics

### After Deployment (Monitor Every 15 min for 1 hour)
- [ ] Check Supabase Query Performance page
- [ ] Verify egress metrics in Supabase Dashboard
- [ ] Test booking creation/updates still work
- [ ] Test kitchen display updates properly
- [ ] Test revenue analytics loads correctly

### Success Metrics
- Query count reduced by 40-50% (Phase 1+2)
- Average response time remains < 200ms
- No errors in browser console
- No increase in failed requests

---

## Rollback Procedures

### For Phase 1 & 2 (Code Changes)
```bash
git log --oneline -5  # Find commit hash before changes
git revert <commit-hash>
git push
```

### For Phase 3 (Database Changes)
```sql
-- Rollback RPC functions
DROP FUNCTION IF EXISTS get_comprehensive_restaurant_dashboard(UUID, DATE);
DROP FUNCTION IF EXISTS get_revenue_analytics(UUID, TIMESTAMP, TIMESTAMP);
```

Then revert hook changes via git.

---

## Files to Change

### Phase 1 & 2 (Quick Wins)
1. `hooks/use-shared-tables.ts` (Lines 32, 140, 183)
2. `lib/hooks/use-orders.ts` (Line 356)
3. `components/analytics/revenue-dashboard.tsx` (Lines 146-270)
4. `lib/hooks/use-events.ts` (Line 582)
5. `lib/hooks/use-table-combinations.ts` (Lines 17-26)
6. `lib/hooks/use-comprehensive-restaurant-data.ts` (Lines 111-125)

### Phase 3 (Database Optimizations)
7. `db/migrations/20250127_create_dashboard_rpc.sql` (NEW)
8. `db/migrations/20250127_create_revenue_rpc.sql` (NEW)
9. `lib/hooks/use-comprehensive-restaurant-data.ts` (Refactor to use RPC)
10. `components/analytics/revenue-dashboard.tsx` (Refactor to use RPC)

### Phase 4 (Realtime Consolidation)
11. `lib/hooks/use-global-realtime.ts` (NEW)
12. `app/(dashboard)/layout.tsx` (Add global subscription)
13. `lib/hooks/use-realtime-bookings.ts` (Remove subscription)
14. `lib/hooks/use-realtime-tables.ts` (Remove subscription)
15. `lib/hooks/use-realtime-orders.ts` (Remove subscription)
16. `app/(dashboard)/bookings/page.tsx` (Remove local subscription)

---

## Questions to Answer Before Starting

1. **Which phase do you want to implement first?**
   - Recommend: Phase 1 (Quick Wins) - 25 min, 40-50% reduction, LOW risk

2. **Do you have a staging environment?**
   - If YES: We can test Phase 3 there first
   - If NO: Skip Phase 3 for now, stick to Phase 1+2

3. **What are your peak hours?**
   - Recommend deploying Phase 1 during off-peak hours

4. **Current Supabase plan?**
   - Need to check if you're hitting egress limits

Let me know which phase you want to start with, and I'll implement it!
