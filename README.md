# Restaurant Booking System (RBS)

A comprehensive restaurant booking and management platform built with Next.js, TypeScript, and Supabase. This system provides end-to-end restaurant management capabilities including table reservations, customer management, staff scheduling, menu management, and analytics.

## 🏗️ System Architecture

This application is a full-stack restaurant management system featuring:

- **Frontend**: Next.js 14 with App Router, TypeScript, Tailwind CSS
- **Backend**: Supabase (PostgreSQL) with real-time subscriptions
- **Authentication**: Supabase Auth
- **Deployment**: Vercel-ready with PWA support
- **Mobile**: Progressive Web App with Android APK support

## 🗄️ Database Schema Overview

### Core Entities

#### User Management
- **`profiles`** - User profiles with ratings, loyalty points, and preferences
- **`friends`** - Friend relationships between users
- **`friend_requests`** - Friend request management
- **`blocked_users`** - User blocking system
- **`user_privacy_settings`** - Granular privacy controls
- **`user_devices`** - Device management for push notifications

#### Restaurant Management
- **`restaurants`** - Restaurant profiles with location, cuisine, pricing
- **`restaurant_staff`** - Staff members and roles (owner, manager, staff, viewer)
- **`restaurant_hours`** - Operating hours by day of week
- **`restaurant_special_hours`** - Holiday/special event hours
- **`restaurant_closures`** - Temporary closures
- **`restaurant_sections`** - Dining room sections/areas
- **`restaurant_rating_requirements`** - User rating requirements for bookings

#### Table Management
- **`restaurant_tables`** - Physical table layout with positions and capacity
- **`table_combinations`** - Table joining rules for larger parties
- **`floor_plans`** - Visual restaurant layouts

#### Booking System
- **`bookings`** - Core reservation records with detailed status tracking
- **`booking_tables`** - Table assignments for bookings
- **`booking_invites`** - Group booking invitations
- **`booking_status_history`** - Complete audit trail
- **`waitlist`** - Waitlist management with notifications

#### Menu & Ordering
- **`menu_categories`** - Menu section organization
- **`menu_items`** - Individual menu items with dietary information
- **`orders`** - Order management with kitchen workflow
- **`order_items`** - Individual order line items
- **`order_modifications`** - Special requests and modifications
- **`order_status_history`** - Order progress tracking

#### Kitchen Operations
- **`kitchen_stations`** - Kitchen prep areas (grill, cold, hot, etc.)
- **`kitchen_assignments`** - Task assignments to stations
- **`kitchen_display_settings`** - KDS configuration

#### Customer Relationship Management
- **`restaurant_customers`** - Customer profiles per restaurant
- **`customer_notes`** - Staff notes about customers
- **`customer_preferences`** - Seating, dietary, and service preferences
- **`customer_relationships`** - Family/business relationships
- **`customer_tags`** - Custom tagging system
- **`customer_tag_assignments`** - Tag-to-customer mappings

#### Reviews & Feedback
- **`reviews`** - Customer reviews with detailed ratings
- **`review_replies`** - Restaurant responses to reviews
- **`review_reports`** - Review moderation system

#### Loyalty & Rewards
- **`loyalty_activities`** - Point-earning activities
- **`loyalty_rewards`** - Available rewards catalog
- **`loyalty_redemptions`** - Reward usage tracking
- **`restaurant_loyalty_rules`** - Custom loyalty rules per restaurant
- **`restaurant_loyalty_balance`** - Restaurant point balances
- **`restaurant_loyalty_transactions`** - Point transaction history
- **`tier_benefits`** - Membership tier benefits
- **`user_loyalty_rule_usage`** - Rule usage tracking

#### Offers & Promotions
- **`special_offers`** - Restaurant promotions
- **`user_offers`** - User-specific offer claims

#### Staff Management
- **`staff_schedules`** - Work schedule templates
- **`staff_shifts`** - Individual shift assignments
- **`staff_availability`** - Staff availability preferences
- **`staff_positions`** - Job positions and pay rates
- **`staff_position_assignments`** - Staff-to-position mappings
- **`time_clock_entries`** - Clock in/out tracking
- **`time_off_requests`** - PTO request management
- **`staff_permission_templates`** - Role-based permission templates

#### Notifications
- **`notifications`** - In-app notifications
- **`notification_preferences`** - User notification settings
- **`notification_outbox`** - Multi-channel notification queue
- **`notification_delivery_logs`** - Delivery tracking

#### Social Features
- **`posts`** - User-generated content
- **`post_comments`** - Comment system
- **`post_likes`** - Like tracking
- **`post_tags`** - User tagging in posts
- **`post_images`** - Image attachments
- **`restaurant_playlists`** - User restaurant collections
- **`playlist_items`** - Restaurant-to-playlist mappings
- **`playlist_collaborators`** - Shared playlist management

#### System Administration
- **`rbs_admins`** - System administrators
- **`user_rating_config`** - User rating tier configuration
- **`user_rating_history`** - Rating change audit trail
- **`user_restaurant_blacklist`** - Restaurant-user blocking
- **`spatial_ref_sys`** - PostGIS spatial reference system

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- npm/yarn/pnpm/bun
- Supabase account and project

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd rbs-restaurant
```

2. Install dependencies:
```bash
npm install
# or
yarn install
# or
pnpm install
# or
bun install
```

3. Set up environment variables:
```bash
cp .env.example .env.local
```

Add your Supabase credentials:
```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

4. Run the development server:
```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

5. Open [http://localhost:3000](http://localhost:3000) with your browser.

## 📱 Features

### For Restaurants
- **Dashboard**: Comprehensive analytics and KPIs
- **Booking Management**: Real-time reservation handling
- **Table Management**: Visual floor plan editor
- **Menu Management**: Dynamic menu with image upload
- **Staff Scheduling**: Shift management and time tracking
- **Customer Profiles**: Detailed customer relationship management
- **Kitchen Display**: Real-time order management
- **Reviews**: Respond to customer feedback
- **Loyalty Programs**: Custom point rules and rewards
- **Analytics**: Revenue, booking, and performance insights

### For Customers
- **Restaurant Discovery**: Search and browse restaurants
- **Instant Booking**: Real-time table availability
- **Waitlist**: Join waitlists for full restaurants
- **Social Features**: Friend connections and shared experiences
- **Loyalty Points**: Earn and redeem rewards
- **Reviews**: Rate and review dining experiences
- **Playlists**: Create and share restaurant collections
- **Notifications**: Real-time booking updates

### For Staff
- **Order Management**: Kitchen display system
- **Customer Notes**: Access customer preferences
- **Shift Management**: Clock in/out and schedule viewing
- **Table Status**: Real-time table management

## 🏗️ Project Structure

```
rbs-restaurant/
├── app/                    # Next.js App Router pages
│   ├── (auth)/            # Authentication pages
│   ├── (dashboard)/       # Main application dashboard
│   └── api/               # API routes
├── components/            # Reusable React components
│   ├── analytics/         # Analytics dashboards
│   ├── bookings/          # Booking management
│   ├── customers/         # Customer management
│   ├── dashboard/         # Dashboard components
│   ├── layout/            # Layout components
│   ├── menu/              # Menu management
│   ├── staff/             # Staff management
│   ├── tables/            # Table management
│   ├── ui/                # UI primitives
│   └── waitlist/          # Waitlist components
├── lib/                   # Utility libraries
│   ├── hooks/             # Custom React hooks
│   ├── services/          # Business logic services
│   ├── supabase/          # Supabase client
│   └── utils/             # Helper functions
├── types/                 # TypeScript type definitions
├── db/                    # Database schema
└── docs/                  # Documentation
```

## 🔧 Development

### Database Schema
The complete database schema is available in `db/schema.sql`. The schema includes:
- 80+ tables covering all aspects of restaurant management
- Comprehensive foreign key relationships
- Check constraints for data validation
- JSONB fields for flexible metadata storage
- PostGIS support for location features

### API Routes
- `/api/auth/*` - Authentication endpoints
- `/api/bookings/*` - Booking management
- `/api/customers/*` - Customer operations
- `/api/menu/*` - Menu management
- `/api/restaurants/*` - Restaurant operations

### Key Dependencies
- **Next.js 14** - React framework with App Router
- **TypeScript** - Type safety
- **Tailwind CSS** - Utility-first styling
- **Supabase** - Backend as a Service
- **React Hook Form** - Form management
- **Zod** - Schema validation
- **Recharts** - Analytics charts

## 📚 Documentation

- [Booking System Documentation](docs/booking-system.md)
- [Customer Edit Functionality](docs/customer-edit-functionality.md)
- [Menu Image Upload](docs/menu-image-upload.md)
- [Android APK Distribution](ANDROID_APK_DISTRIBUTION.md)
- [API Migration Plan](API_MIGRATION_PLAN.md)

## 🔒 Security Features

- Row Level Security (RLS) on all tables
- Role-based access control
- User rating system for booking eligibility
- Restaurant blacklist management
- Privacy settings and data controls
- Secure image upload with RLS

## 🚀 Deployment

This project is optimized for deployment on Vercel:

```bash
npm run build
npm run start
```

For Android APK generation, see [ANDROID_APK_DISTRIBUTION.md](ANDROID_APK_DISTRIBUTION.md).

## 📄 License

This project is proprietary software. All rights reserved.

## 🤝 Contributing

This is a private project. For development access, please contact the project maintainers.
