# Plate Restaurant Management System - Complete AI Developer Guide

## Project Overview
Enterprise-grade Next.js 15 restaurant management system with Supabase backend, featuring multi-tenant operations, advanced bookings, kitchen workflows, PWA capabilities, analytics, and mobile optimization.

### Core Capabilities
- **Multi-Tenant Restaurant Operations** | **Advanced Booking System** | **Kitchen Operations**
- **Progressive Web App** | **Analytics & Reporting** | **Staff Management** 
- **Customer Management** | **Table Management** | **Location Services** | **Mobile Optimization**

## Core Architectural Principles

### 🚫 NEVER USE API ROUTES
**CRITICAL**: Use direct Supabase calls exclusively. API routes add unnecessary layers, reduce performance, and complicate auth flows.

```typescript
// ✅ CORRECT: Direct Supabase calls
const { data } = await supabase.from('table').select()
const { data } = useBookings(restaurantId) // React Query + hooks

// ❌ NEVER: API routes for database operations
// app/api/bookings/route.ts - DON'T CREATE THIS
```

### 🏗️ Multi-Tenant Architecture
- All operations scoped by `restaurant_id`
- RLS policies provide granular access control
- Restaurant staff system for secondary authorization

### 🔐 Authentication Flow
1. Valid Supabase session
2. Active `restaurant_staff` record
3. Middleware validates both before dashboard access

## MCP Integration (Use Proactively)

### 🧠 Sequential Thinking
**Always start here for multi-step problems**
- Complex booking flows | Schema changes | Performance analysis | Feature design

### 📊 Knowledge Graph  
**Store relationships and business logic**
- Restaurant rules | Feature dependencies | Technical debt | Integration patterns

### 💾 Memory Bank
**Reusable patterns and documentation**  
- Code snippets | Configurations | Queries | Migration scripts

### �� Playwright
**End-to-end testing and automation**
- Booking flows | PWA functionality | Mobile responsiveness | Kitchen workflows

### 🗄️ Supabase MCP
**Direct database operations and monitoring**
- Project management | Migrations | RLS policies | Performance monitoring

## System Architecture

### Route Structure
```
app/
├── (auth)/           # Unauthenticated routes
├── (dashboard)/      # Protected routes - requires auth + staff access
│   ├── dashboard/    ├── bookings/     ├── customers/    ├── menu/
│   ├── tables/       ├── analytics/    ├── waitlist/     ├── reviews/
│   ├── loyalty/      ├── staff/        ├── orders/       ├── kitchen/
│   └── settings/
└── actions.ts        # Server actions for push notifications (NO API ROUTES)
```

### Database Schema (`db/schema.sql`)
**Always reference schema first** - 40+ tables with complex relationships
```sql
profiles.id → auth.users.id (extends Supabase auth)
restaurant_staff → restaurants + profiles (access control)
bookings → users + restaurants + tables (via booking_tables junction)
loyalty_* tables → sophisticated points system with audit trails
```

### Supabase Client Strategy
- `lib/supabase/client.ts`: Browser client for client components
- `lib/supabase/server.ts`: Server client for server components
- `lib/supabase/middleware.ts`: Middleware client for route protection

## Key Features

### 📱 PWA & Mobile
- **Service Worker** (`public/sw.js`): Offline functionality, caching strategies
- **Push Notifications** (`app/actions.ts`): VAPID configuration, booking alerts
- **Android APK**: TWA configuration, 8-inch tablet optimization
- **Offline Capabilities**: Cached dashboard access, background sync

### 👨‍🍳 Kitchen & Orders
- **Order States**: `Pending → Confirmed → Preparing → Ready → Served → Completed`
- **Kitchen Display**: Real-time order queue by station
- **Menu Management**: Seeding (`npm run seed:menu`), availability control
- **Background Jobs** (`lib/services/background-jobs.ts`): Automation workflows

### 📊 Analytics & Reporting
- **Business Intelligence**: Revenue, booking, customer, operational analytics
- **Data Visualization**: Recharts integration for charts and metrics
- **Real-time Dashboards**: Live performance monitoring
- **Export Capabilities**: PDF, Excel, CSV formats

### 🗺️ Location Services
- **Leaflet Maps**: Restaurant locations, delivery zones, customer mapping
- **Geographic Features**: Service area visualization, multi-location support

## Development Workflow

### Scripts & Commands
```bash
# Core Development
npm run dev --turbopack          # Turbo for faster builds
npm run build                    # Production build

# Data Management
npm run seed:menu                # Populate menu data
npm run create:sample-data       # Generate sample data
npm run test:kitchen-operations  # Test kitchen workflow

# ServeMeApp Migration
npm run migrate:serveme          # Migrate data
npm run migrate:serveme:dry-run  # Preview changes
```

### Environment Variables
```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
NEXT_PUBLIC_VAPID_PUBLIC_KEY=    # Push notifications
VAPID_PRIVATE_KEY=
REDIS_URL=                       # Caching & background jobs
```

### MCP-Enhanced Workflow
1. **Sequential Thinking** → Break down complex problems
2. **Knowledge Graph** → Store insights and relationships  
3. **Memory Bank** → Document patterns and solutions
4. **Playwright** → Test user flows and functionality
5. **Supabase MCP** → Database operations and monitoring

## Critical Code Patterns

### Staff Access Check
```typescript
const { data: staffData } = await supabase
  .from('restaurant_staff')
  .select('id, role, permissions, restaurant_id')
  .eq('user_id', userId)
  .eq('is_active', true)
  .single()
```

### PWA Service Worker
```typescript
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js', {
    scope: '/', updateViaCache: 'none'
  })
}
```

### Push Notifications
```typescript
const subscription = await registration.pushManager.subscribe({
  userVisibleOnly: true,
  applicationServerKey: urlBase64ToUint8Array(vapidPublicKey)
})
```

### Booking with Relations
```typescript
const { data: booking } = await supabase
  .from('bookings')
  .select(`
    *, user:profiles(*), restaurant:restaurants(*),
    tables:booking_tables(table:restaurant_tables(*)),
    attendees:booking_attendees(user:profiles(*))
  `)
  .eq('id', bookingId).single()
```

### Loyalty Points Transaction
```typescript
await supabase.from('restaurant_loyalty_transactions').insert({
  restaurant_id, user_id, transaction_type: 'purchase',
  points: pointsAwarded, balance_before: currentBalance,
  balance_after: newBalance
})
```

## Essential Guidelines

### ✅ DO
- Use direct Supabase calls exclusively
- Filter all queries by `restaurant_id` for multi-tenant isolation
- Use React Query hooks for client-side data fetching
- Implement proper RLS policies for security
- Test PWA functionality with Playwright
- Store patterns in Memory Bank, relationships in Knowledge Graph

### ❌ DON'T
- Create API routes (`/api/*`) for database operations
- Query Supabase directly in client components
- Skip restaurant_staff access checks
- Cache dynamic/auth endpoints in service worker
- Ignore booking status state machines
- Make assumptions - use Sequential Thinking for complex problems

## Key Files Reference
- `middleware.ts`: Route protection logic
- `lib/restaurant-auth.ts`: Custom authentication layer
- `types/index.ts`: Complete domain model interfaces  
- `app/(dashboard)/layout.tsx`: Main dashboard with staff access check
- `db/schema.sql`: Complete database schema (ground truth)
- `app/actions.ts`: Server actions for push notifications
- `public/sw.js`: Service worker for PWA functionality
- `components/pwa/`: PWA components and offline handling
- `lib/services/`: Background jobs and real-time services
- `migration-tools/`: ServeMeApp migration utilities

---

**Remember**: This is an enterprise-grade system. Always use Sequential Thinking for complex decisions, document patterns in Memory Bank, store relationships in Knowledge Graph, test with Playwright, and leverage Supabase MCP for database operations. Never use API routes - direct Supabase calls only! 🚀
