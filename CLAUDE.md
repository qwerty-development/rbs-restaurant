# CLAUDE.md

## Commands
- `npm run dev` - Development server (Turbopack)
- `npm run build` - Production build
- `npm start` - Production server
- `npm run lint` - Lint code

## Tech Stack
- **Framework:** Next.js 15+ App Router
- **Language:** TypeScript (strict)
- **Database:** Supabase PostgreSQL
- **Auth:** Supabase Auth + role-based access (`restaurant_staff`)
- **UI:** Tailwind CSS + shadcn/ui + Radix
- **State:** React Query for server state

## Key Architecture
- **Routes:** `app/(auth)/`, `app/(dashboard)/`, `app/api/`
- **Auth:** Middleware + layout double verification
- **DB Schema:** Always check `db/schema.sql` as source of truth
- **Types:** `types/index.ts` for comprehensive TypeScript interfaces
- **Clients:** Separate Supabase clients for browser/server
- **Components:** Feature-based organization (bookings, customers, etc.)

## Critical Rules - DO NOT VIOLATE
- **NEVER create mock/simplified components** - fix existing code
- **NEVER replace complex components** - debug and fix root cause
- **ALWAYS work with existing codebase** - no new simplified alternatives
- **ALWAYS add explicit TypeScript types** to all parameters/returns
- **Fix all linter/TypeScript errors immediately**
- **When in doubt, always ask first**

## Best Practices
- Use existing Supabase client patterns and type definitions
- Implement proper error boundaries and user feedback
- Leverage React Query for efficient data fetching
- Follow WCAG accessibility guidelines
- Never expose sensitive data or bypass auth checks