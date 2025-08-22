# Plate System - AI Developer Guide

## Project Overview
This is a comprehensive Next.js 15 restaurant management system with Supabase backend, featuring multi-tenant restaurant operations, social booking features, loyalty programs, staff management, and advanced table management. Uses App Router with TypeScript and Tailwind CSS.

## Database Architecture & Domain Model

### Schema Provided by User
Use the complete SQL schema provided by the user as the ground truth for all database table definitions, column names, relationships, enums, and constraints. Refer to it when generating code to ensure consistency between application types and database schema.
Always open and reference `db/schema.sql` in the repository before starting any work on database models, queries, or migrations to ensure schema accuracy.

### Core Entity Relationships
- **Multi-Tenant Structure**: All operations scoped by `restaurant_id` 
- **User Profiles**: Extended user system with loyalty points, ratings, and social features
- **Booking Ecosystem**: Complex booking flow with attendees, invites, status history, and table assignments
- **Staff Management**: Role-based access with permissions array and activity logging
- **Loyalty System**: Points, rules, redemptions, and tier-based rewards per restaurant

### Critical Database Patterns
```sql
-- Key relationships to understand:
profiles.id → auth.users.id (extends Supabase auth)
restaurant_staff → restaurants + profiles (staff access control)
bookings → users + restaurants + tables (via booking_tables junction)
loyalty_* tables → sophisticated points system with audit trails
```

### Status Enums & State Machines
- **Booking Status**: `pending → confirmed → completed/no_show/cancelled_*`
- **Staff Roles**: `owner > manager > staff > viewer` (hierarchical permissions)
- **Membership Tiers**: `bronze → silver → gold → platinum`
- **Table Types**: `booth|window|patio|standard|bar|private`

## Authentication & Authorization Architecture

### Multi-Layer Auth System
- **Supabase Auth**: Primary user authentication (`app/(auth)/layout.tsx`)
- **Restaurant Staff System**: Secondary authorization via `restaurant_staff` table
- **Middleware Protection**: Route-level security in `middleware.ts` checks both session and restaurant access
- **Layout-Level Guards**: Both auth and dashboard layouts perform user state checks

### Critical Auth Pattern
```typescript
// All dashboard routes require:
1. Valid Supabase session 
2. Active restaurant_staff record with restaurant association
3. Middleware validates both before allowing dashboard access
```

## App Router Structure & Route Groups

### Route Group Convention
- `(auth)`: Unauthenticated routes - redirects logged-in users to dashboard
- `(dashboard)`: Protected routes - requires authentication + restaurant staff access
- Both use specialized layouts with auth checks

### Server vs Client Components
- **Layouts are Server Components**: Handle auth checks, database queries
- **Interactive Components are Client**: Forms, state management, real-time features
- **Auth Provider Pattern**: `components/provider.tsx` wraps React Query + Theme Provider

## Database & API Patterns

### Supabase Client Strategy
Three client types for different contexts:
- `lib/supabase/client.ts`: Browser client for client components
- `lib/supabase/server.ts`: Server client for server components/layouts  
- `lib/supabase/middleware.ts`: Middleware client for route protection

### Data Access Pattern
```typescript
// Server components query directly
const { data } = await supabase.from('table').select()

// Client components use React Query + custom hooks
const { data } = useBookings(restaurantId)
```

## Component Architecture

### shadcn/ui Integration
- Components in `components/ui/` follow shadcn patterns
- `components.json` configures New York style with CSS variables
- `lib/utils.ts` provides `cn()` utility for conditional classes

### Feature-Based Organization
```
components/
├── ui/          # Base shadcn components
├── auth/        # Authentication forms
├── bookings/    # Booking management
├── layout/      # App shell (sidebar, header, mobile nav)
└── [feature]/   # Domain-specific components
```

### Form Handling Standard
- React Hook Form + Zod validation
- Toast notifications via `react-hot-toast`
- Server actions for mutations

## Key Business Logic

### Restaurant Staff System
- `lib/restaurant-auth.ts`: Custom auth layer for restaurant staff
- Staff roles: owner, manager, staff, viewer (hierarchical permissions)
- Permission arrays control granular feature access
- Activity logging via `booking_status_history` and audit trails

### Advanced Table Management
- Visual floor plan editor (`components/tables/floor-plan-editor.tsx`)
- Drag-and-drop table positioning with x/y coordinates
- Table combinations for large parties via `table_combinations`
- Real-time availability tracking via `table_availability`
- Complex booking-to-table assignments via `booking_tables` junction

### Sophisticated Booking Workflow
- **Group Bookings**: Multi-user bookings with organizers and attendees
- **Booking Invites**: Social invitation system with accept/decline
- **Status Tracking**: Complete audit trail via `booking_status_history`
- **Guest Bookings**: Non-user bookings with guest contact info
- **Table Preferences**: Array-based preference matching
- **Turn Time Management**: Dynamic table turnover calculations

### Multi-Level Loyalty System
- **Restaurant-Specific Rules**: Custom points rules per restaurant
- **Tier Benefits**: Bronze/Silver/Gold/Platinum with escalating rewards  
- **Points Transactions**: Full audit via `restaurant_loyalty_transactions`
- **Redemption System**: Codes, expiration, usage tracking
- **Activity Tracking**: Points for bookings, reviews, referrals, etc.

### Social Features
- **Friend Networks**: Friend requests, connections via `friends` table
- **Restaurant Playlists**: Shareable restaurant collections
- **Posts & Reviews**: Booking-linked social posts with photos/tags
- **VIP Management**: Extended booking windows for special customers

## Development Workflows

### Local Development
```bash
npm run dev --turbopack  # Uses Turbo for faster builds
```

### Environment Setup
Requires Supabase project with specific tables:
- restaurants, restaurant_staff, bookings, profiles
- Row Level Security (RLS) policies for multi-tenant isolation

### Type System
- Central types in `types/index.ts` mirror database schema
- Comprehensive interfaces for Restaurant, Booking, Profile, etc.
- Server components get typed Supabase responses

## Styling Conventions

### Tailwind + CSS Variables
- Theme system via CSS variables in `app/globals.css`
- Dark mode support via `next-themes`
- Consistent spacing and color tokens

### Component Styling Pattern
```typescript
// Use cn() for conditional classes
const buttonClass = cn(
  "base-classes",
  variant === "primary" && "primary-classes",
  className
)
```

## Common Pitfalls to Avoid

1. **Don't query Supabase in client components** - Use server components or React Query hooks
2. **Always check restaurant_staff access** - Not just user authentication
3. **Handle multi-tenant data isolation** - Always filter by `restaurant_id` in queries
4. **Respect booking status state machine** - Use proper status transitions
5. **Use absolute imports** - All imports should use `@/` prefix
6. **Server/Client boundary** - Mark client components with "use client"
7. **Middleware auth flow** - Understand the session update pattern
8. **Junction table patterns** - Use `booking_tables`, `booking_attendees` for relationships
9. **Audit trail compliance** - Most actions require status history entries
10. **Points system integrity** - Always use transaction patterns for loyalty points

## Essential Database Queries

### Staff Access Check
```typescript
const { data: staffData } = await supabase
  .from('restaurant_staff')
  .select('id, role, permissions, restaurant_id')
  .eq('user_id', userId)
  .eq('is_active', true)
  .single()
```

### Booking with Relations
```typescript
const { data: booking } = await supabase
  .from('bookings')
  .select(`
    *,
    user:profiles(*),
    restaurant:restaurants(*),
    tables:booking_tables(table:restaurant_tables(*)),
    attendees:booking_attendees(user:profiles(*))
  `)
  .eq('id', bookingId)
  .single()
```

### Loyalty Points Transaction
```typescript
// Always update points with transaction record
const { data: transaction } = await supabase
  .from('restaurant_loyalty_transactions')
  .insert({
    restaurant_id,
    user_id,
    transaction_type: 'purchase',
    points: pointsAwarded,
    balance_before: currentBalance,
    balance_after: newBalance
  })
```

## Key Files for Context
- `middleware.ts`: Route protection logic
- `lib/restaurant-auth.ts`: Custom authentication layer  
- `types/index.ts`: Complete domain model (249 lines of interfaces)
- `app/(dashboard)/layout.tsx`: Main dashboard shell with staff access check
- `components/layout/sidebar.tsx`: Navigation with role-based access
- Database schema: 40+ tables with complex relationships and constraints
