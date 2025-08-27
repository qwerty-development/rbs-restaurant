# Plate System - AI Developer Guide

## Project Overview
This is a comprehensive Next.js 15 restaurant management system with Supabase backend, featuring multi-tenant restaurant operations, social booking features, loyalty programs, staff management, and advanced table management. Uses App Router with TypeScript and Tailwind CSS.

## MCP (Model Context Protocol) Integration

This project leverages 5 MCP servers for enhanced development workflows. Use these intelligently and proactively:

### Sequential Thinking MCP (`@modelcontextprotocol/server-sequential-thinking`)
**When to use**: Complex problem-solving, architectural decisions, debugging multi-step issues
- Breaking down complex restaurant booking flows
- Planning database schema changes or migrations
- Analyzing performance bottlenecks in booking system
- Designing new features like loyalty point calculations
- Debugging complex multi-tenant data issues
- Planning integration of new payment systems
- **Use proactively** for any multi-step analysis

### Knowledge Graph Memory MCP (`@itseasy21/mcp-knowledge-graph`)
**When to use**: Storing and retrieving project knowledge, tracking relationships between entities
- Maintaining restaurant business rules and requirements
- Tracking feature dependencies and integration points  
- Storing customer feedback and feature requests
- Managing technical debt and known issues
- Documenting API integrations and third-party services
- Building knowledge base of booking system edge cases
- **Create entities** for restaurants, features, APIs, users, bookings
- **Create relationships** between components and business logic

### Memory Bank MCP (`@allpepper/memory-bank-mcp`)
**When to use**: Project-specific documentation, code snippets, configuration management
- Storing reusable code patterns for restaurant features
- Managing environment-specific configurations
- Documenting deployment procedures and troubleshooting guides
- Saving tested SQL queries and database operations
- Maintaining component library documentation
- Storing customer onboarding procedures and staff training materials
- **Organized storage** in project-specific folders

### Playwright MCP (`@playwright/mcp`)
**When to use**: End-to-end testing, UI automation, browser-based debugging, PDF generation
- Testing booking flows from customer perspective
- Automating table management interface testing
- Testing responsive design across devices
- Validating payment integration workflows
- Testing real-time features like live table availability
- Generating screenshots for documentation
- Creating booking confirmation PDFs and reports
- Testing PWA functionality and offline capabilities

### Supabase MCP (`@modelcontextprotocol/server-supabase`)
**When to use**: Direct Supabase project management, database operations, real-time monitoring
- Managing Supabase projects and organizations
- Executing SQL queries and database migrations
- Monitoring database performance and logs
- Managing Row Level Security (RLS) policies
- Creating and deploying Edge Functions
- Managing storage buckets and file uploads
- Real-time database monitoring and advisors
- **Critical for restaurant data operations** and multi-tenant management

### MCP Usage Guidelines - PROACTIVE APPROACH
1. **Always use Sequential Thinking** for any multi-step problem analysis or feature planning
2. **Immediately store insights** in Knowledge Graph for relationships and business logic
3. **Document patterns** in Memory Bank for reusable code and configurations
4. **Test with Playwright** for any UI-related changes or user flows
5. **Use Supabase MCP** for all database operations, monitoring, and backend management
6. **Combine MCPs systematically**: Sequential Thinking → Implementation → Knowledge Graph storage → Memory Bank documentation → Playwright testing → Supabase monitoring

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

### MCP-Enhanced Development Process
1. **Problem Analysis**: Use Sequential Thinking MCP for complex issues (ALWAYS start here for multi-step problems)
2. **Database Operations**: Use Supabase MCP for all backend database tasks and monitoring
3. **Knowledge Capture**: Store insights and relationships in Knowledge Graph MCP
4. **Pattern Documentation**: Save reusable solutions in Memory Bank MCP  
5. **Testing & Validation**: Use Playwright MCP for user flows and automation
6. **Continuous Learning**: Update knowledge systems with every solution

### Local Development
```bash
npm run dev --turbopack  # Uses Turbo for faster builds
```

### MCP-Assisted Debugging Workflow
When encountering complex issues:
1. **Sequential Analysis**: Use Sequential Thinking to break down the problem systematically
2. **Database Investigation**: Use Supabase MCP to check database state, logs, and performance
3. **Knowledge Query**: Search Knowledge Graph for similar past issues and relationships
4. **Pattern Search**: Check Memory Bank for relevant code patterns and solutions
5. **Reproduction & Testing**: Use Playwright to reproduce and test fixes
6. **Knowledge Update**: Store the complete solution in both Knowledge Graph and Memory Bank

### Environment Setup
Requires Supabase project with specific tables:
- restaurants, restaurant_staff, bookings, profiles
- Row Level Security (RLS) policies for multi-tenant isolation

### MCP Data Storage Strategy
- **Knowledge Graph**: Store business logic relationships, feature dependencies, code patterns, troubleshooting solutions
- **Memory Bank**: Store detailed documentation, reusable code snippets, configuration files, deployment guides
- **Sequential Thinking**: Use for architectural decisions and complex problem solving
- **Playwright**: Generate test reports, documentation screenshots, user journey validations
- **Supabase MCP**: Direct database operations, monitoring, and backend management

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

## MCP Best Practices & Workflow Integration

### When to Use Each MCP Server

#### Sequential Thinking (`mcp_sequentialthinking_sequentialthinking`)
**Trigger conditions:**
- Feature requests involving multiple components/tables
- Performance issues requiring root cause analysis
- Database schema changes or migrations
- Complex business logic implementation
- Debugging multi-step user flows
- Architectural decisions for new features

**Example usage:**
```
When implementing loyalty points system:
1. Analyze point calculation rules
2. Design database transaction patterns
3. Plan UI/UX for point redemption
4. Consider edge cases and rollback scenarios
```

#### Knowledge Graph (`mcp_memory_*`)
**Entity types to track:**
- **Restaurants**: Business rules, configuration, special requirements
- **Features**: Dependencies, integration points, known issues
- **APIs**: Third-party integrations, rate limits, authentication
- **Users**: Customer types, loyalty tiers, special permissions
- **Bookings**: Complex scenarios, edge cases, business rules

**Relationship types:**
- "depends_on", "integrates_with", "conflicts_with"
- "requires_permission", "affects_loyalty", "impacts_billing"
- "tested_with", "documented_in", "deployed_to"

#### Memory Bank (`mcp_allpepper-mem_*`)
**Project organization:**
- **rbs-restaurant/code-patterns**: Reusable components and hooks
- **rbs-restaurant/configurations**: Environment setups, deployment configs
- **rbs-restaurant/queries**: Tested SQL queries and Supabase operations
- **rbs-restaurant/troubleshooting**: Common issues and solutions
- **rbs-restaurant/integrations**: Third-party service configurations

#### Playwright (`mcp_playwright_browser_*`)
**Test scenarios to automate:**
- Complete booking flow (guest → confirmed → completed)
- Table management drag-and-drop operations
- Staff permission boundaries
- Payment integration workflows
- Mobile responsive layouts
- PWA installation and offline functionality

#### Supabase (`mcp_supabase_*`)
**Core database operations:**
- **Project Management**: List projects, get project details, monitor status
- **Database Queries**: Execute SQL, apply migrations, manage schemas
- **Table Management**: List tables, manage relationships, check constraints
- **RLS Policies**: Create and manage Row Level Security for multi-tenant architecture
- **Edge Functions**: Deploy and manage serverless functions
- **Storage**: Manage buckets, file uploads, and storage configurations
- **Monitoring**: Get logs, advisors, performance metrics
- **Real-time Operations**: Monitor database health and performance

### MCP Workflow Patterns

#### Feature Development Workflow
1. **Planning Phase**:
   - Use Sequential Thinking to break down requirements
   - Query Knowledge Graph for existing similar features
   - Check Memory Bank for reusable patterns

2. **Implementation Phase**:
   - Store new patterns in Memory Bank as you develop
   - Update Knowledge Graph with new relationships
   - Use Playwright for testing during development

3. **Testing Phase**:
   - Playwright for user journey testing
   - Sequential Thinking for edge case analysis

4. **Documentation Phase**:
   - Store final patterns in Memory Bank
   - Update Knowledge Graph with lessons learned

#### Bug Investigation Workflow
1. **Analysis**: Sequential Thinking to break down the issue
2. **Context**: Query Knowledge Graph for related problems
3. **Solutions**: Check Memory Bank for similar fixes
4. **Reproduction**: Use Playwright to reproduce the bug
5. **Testing**: Validate fix with automated tests
6. **Documentation**: Store solution in Memory Bank + Knowledge Graph

#### Code Review Workflow
1. **Impact Analysis**: Use Knowledge Graph to see what's affected
2. **Pattern Matching**: Check Memory Bank for established patterns
3. **Testing Strategy**: Use Playwright to validate changes
4. **Knowledge Update**: Store new insights from the review

### Smart MCP Usage Examples

#### Restaurant Onboarding Feature
```typescript
// 1. Use Sequential Thinking to plan the flow
// 2. Query Knowledge Graph for restaurant entity requirements
// 3. Check Memory Bank for onboarding patterns
// 4. Implement with stored patterns
// 5. Test with Playwright automation
// 6. Store new insights in Knowledge Graph + Memory Bank
```

#### Performance Optimization
```typescript
// 1. Sequential Thinking for bottleneck analysis
// 2. Knowledge Graph to map performance relationships
// 3. Memory Bank for proven optimization patterns
// 4. Playwright for load testing scenarios
// 5. Store optimization patterns in Knowledge Graph + Memory Bank
```

#### New Payment Integration
```typescript
// 1. Sequential Thinking for integration planning
// 2. Knowledge Graph for API dependency mapping
// 3. Memory Bank for payment patterns and configurations
// 4. Playwright for payment flow testing
// 5. Store learnings back in Knowledge Graph + Memory Bank
```

### MCP Maintenance Guidelines
- **Daily**: Store new patterns and insights in Knowledge Graph and Memory Bank
- **Weekly**: Update Knowledge Graph with new relationships
- **Monthly**: Review and organize stored knowledge
- **Per Feature**: Use Sequential Thinking for complex decisions
- **Per Release**: Generate documentation and test coverage reports with Playwright

### MCP Workflow Patterns

#### Feature Development Workflow
1. **Planning Phase**:
   - Use Sequential Thinking to break down requirements
   - Query Knowledge Graph for existing similar features
   - Check Memory Bank for reusable patterns

2. **Implementation Phase**:
   - Store new patterns in Memory Bank as you develop
   - Update Knowledge Graph with new relationships
   - Use Playwright for testing during development

3. **Testing Phase**:
   - Playwright for user journey testing
   - Sequential Thinking for edge case analysis

4. **Documentation Phase**:
   - Store final patterns in Memory Bank
   - Update Knowledge Graph with lessons learned

#### Bug Investigation Workflow
1. **Analysis**: Sequential Thinking to break down the issue
2. **Context**: Query Knowledge Graph for related problems
3. **Solutions**: Check Memory Bank for similar fixes
4. **Reproduction**: Use Playwright to reproduce the bug
5. **Testing**: Validate fix with automated tests
6. **Documentation**: Store solution in Memory Bank + Knowledge Graph

#### Code Review Workflow
1. **Impact Analysis**: Use Knowledge Graph to see what's affected
2. **Pattern Matching**: Check Memory Bank for established patterns
3. **Testing Strategy**: Use Playwright to validate changes
4. **Knowledge Update**: Store new insights from the review

### Smart MCP Usage Examples

#### Restaurant Onboarding Feature
```typescript
// 1. Use Sequential Thinking to plan the flow
// 2. Query Knowledge Graph for restaurant entity requirements
// 3. Check Memory Bank for onboarding patterns
// 4. Implement with stored patterns
// 5. Test with Playwright automation
// 6. Store new insights in Knowledge Graph + Memory Bank
```

#### Performance Optimization
```typescript
// 1. Sequential Thinking for bottleneck analysis
// 2. Knowledge Graph to map performance relationships
// 3. Memory Bank for proven optimization patterns
// 4. Playwright for load testing scenarios
// 5. Store optimization patterns in Knowledge Graph + Memory Bank
```

#### New Payment Integration
```typescript
// 1. Sequential Thinking for integration planning
// 2. Knowledge Graph for API dependency mapping
// 3. Memory Bank for payment patterns and configurations
// 4. Playwright for payment flow testing
// 5. Store learnings back in Knowledge Graph + Memory Bank
```

### MCP Maintenance Guidelines
- **Daily**: Store new patterns and insights in Knowledge Graph and Memory Bank
- **Weekly**: Update Knowledge Graph with new relationships
- **Monthly**: Review and organize stored knowledge
- **Per Feature**: Use Sequential Thinking for complex decisions
- **Per Release**: Generate documentation and test coverage reports with Playwright

## MCP Configuration Status ✅

All 5 MCP servers are properly configured and working:

### Working MCP Configuration
```json
{
    "servers": {
        "sequentialthinking": {
            "type": "stdio",
            "command": "npx",
            "args": ["-y", "@modelcontextprotocol/server-sequential-thinking@latest"],
            "gallery": true
        },
        "memory": {
            "command": "npx",
            "args": ["-y", "@itseasy21/mcp-knowledge-graph"],
            "env": {
                "MEMORY_FILE_PATH": "/Users/asifalam/.mcp/knowledge-graph.jsonl"
            },
            "type": "stdio"
        },
        "playwright": {
            "type": "stdio",
            "command": "npx",
            "args": ["@playwright/mcp@0.0.35", "--browser=chrome", "--headless", "--caps=vision,pdf,tabs,install"],
            "env": {}
        },
        "allpepper-memory-bank": {
            "type": "stdio",
            "command": "npx",
            "args": ["-y", "@allpepper/memory-bank-mcp@0.2.1"],
            "env": {
                "MEMORY_BANK_ROOT": "/Users/asifalam/.mcp/memory-bank"
            }
        },
        "supabase": {
            "type": "stdio",
            "command": "npx",
            "args": ["-y", "@modelcontextprotocol/server-supabase@0.5.0"],
            "env": {}
        }
    }
}
```

### MCP Status
- ✅ **Sequential Thinking**: Verified working
- ✅ **Knowledge Graph**: Verified working (contains project entities)
- ✅ **Memory Bank**: Verified working (contains project documentation)
- ✅ **Playwright**: Verified working (browser automation ready)
- ✅ **Supabase**: Verified working (database operations and monitoring ready)

### File Structure
```
/Users/asifalam/.mcp/
├── knowledge-graph.jsonl    # Knowledge Graph storage
└── memory-bank/             # Memory Bank project folders
    └── Plate/              # RBS Restaurant project docs
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
