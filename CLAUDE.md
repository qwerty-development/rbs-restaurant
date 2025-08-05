# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

- **Development server:** `npm run dev` (uses Turbopack for faster builds)
- **Build:** `npm run build`
- **Production server:** `npm start`
- **Lint:** `npm run lint`

## Architecture Overview

### Tech Stack
- **Framework:** Next.js 15+ with App Router
- **Language:** TypeScript
- **Database:** Supabase (PostgreSQL)
- **Authentication:** Supabase Auth with role-based access control
- **Styling:** Tailwind CSS with shadcn/ui components
- **State Management:** React Query (@tanstack/react-query) for server state
- **UI Components:** Radix UI primitives via shadcn/ui

### Database Architecture
The system uses Supabase with a comprehensive restaurant management schema including:
- **Core entities:** restaurants, profiles, bookings, restaurant_tables
- **Staff management:** restaurant_staff with role-based permissions (owner/manager/staff)
- **Advanced features:** table combinations, loyalty rules, VIP users, reviews with replies
- **Availability system:** restaurant_hours, restaurant_special_hours, restaurant_closures

### Authentication & Authorization
- **Authentication:** Supabase Auth handles user authentication
- **Authorization:** Role-based access through `restaurant_staff` table
- **Middleware:** `/middleware.ts` protects dashboard routes and verifies staff access
- **Layout protection:** Dashboard layout (`app/(dashboard)/layout.tsx`) enforces authentication and staff verification

### Route Structure
- **Auth routes:** `app/(auth)/` - login, register, password reset
- **Dashboard routes:** `app/(dashboard)/` - main restaurant management interface
- **API routes:** `app/api/` - webhook handlers and auth callbacks

### Key Architectural Patterns
1. **Server-side auth verification:** Both middleware and layout verify authentication
2. **Type-safe database queries:** Comprehensive TypeScript interfaces in `types/index.ts`
3. **Reusable hooks:** Custom hooks in `lib/hooks/` for auth, bookings, and restaurant data
4. **Component organization:** Feature-based components (bookings, customers, dashboard, etc.)
5. **Supabase client patterns:** Separate clients for browser (`lib/supabase/client.ts`) and server-side operations

### State Management Strategy
- Server state managed via React Query hooks
- Local component state with React hooks
- Authentication state through Supabase auth context
- No global client-side state management library needed

### Database Relationships
- Restaurants have staff, tables, bookings, menus, offers, and reviews
- Bookings can be linked to users or be guest bookings (guest_name, guest_email, guest_phone)
- Tables support combinations for larger parties
- Loyalty system with points and rules
- VIP users get extended booking privileges

### Component Architecture
- **Layout components:** Sidebar, Header, MobileNav with role-based rendering
- **Feature components:** Organized by domain (bookings, customers, dashboard, etc.)
- **UI components:** shadcn/ui components in `components/ui/`
- **Forms:** React Hook Form with Zod validation