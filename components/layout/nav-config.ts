// components/layout/nav-config.ts
import type { LucideIcon } from 'lucide-react'
import {
  LayoutDashboard,
  Calendar,
  Users,
  User,
  Utensils,
  Table as TableIcon,
  BarChart3,
  Settings,
  Star,
  DollarSign,
  Gift,
  HelpCircle,
  Bell,
  Crown,
  Clock,
  Upload,
  Grid,
  PartyPopper,
} from 'lucide-react'

export interface NavigationItem {
  title: string
  href: string
  icon: LucideIcon
  permission: string | null
  tierFeature?: string // Maps to tier feature from our tier utility
  badge?: number
}

export const NAV_ITEMS: NavigationItem[] = [
  { title: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, permission: null, tierFeature: 'booking_management' },
  { title: 'Bookings', href: '/bookings', icon: Calendar, permission: 'bookings.view', tierFeature: 'bookings_advanced' },
  { title: 'Customers', href: '/customers', icon: Users, permission: 'customers.view', tierFeature: 'customer_management' },
  { title: 'VIP Customers', href: '/vip', icon: Crown, permission: 'vip.view', tierFeature: 'customer_management' },
  { title: 'Menu', href: '/menu', icon: Utensils, permission: 'menu.view', tierFeature: 'menu_management' },
  { title: 'Sections', href: '/sections', icon: Grid, permission: null, tierFeature: 'section_management' },
  { title: 'Tables', href: '/tables', icon: TableIcon, permission: 'tables.view', tierFeature: 'table_management' },
  { title: 'Events', href: '/events', icon: PartyPopper, permission: null, tierFeature: 'booking_management' },
  { title: 'Analytics', href: '/analytics', icon: BarChart3, permission: 'analytics.view', tierFeature: 'advanced_analytics' },
  { title: 'Waiting List', href: '/waitlist', icon: Clock, permission: 'bookings.view', tierFeature: 'waitlist' },
  { title: 'Reviews', href: '/reviews', icon: Star, permission: 'reviews.view', tierFeature: 'review_management' },
  { title: 'Loyalty', href: '/loyalty', icon: Gift, permission: 'loyalty.view', tierFeature: 'loyalty_management' },
  { title: 'Offers', href: '/offers', icon: DollarSign, permission: 'offers.view', tierFeature: 'offers_management' },
  { title: 'Staff', href: '/staff', icon: Users, permission: 'staff.manage', tierFeature: 'staff_management' },
  { title: 'Schedules', href: '/schedules', icon: Clock, permission: 'schedules.view', tierFeature: 'schedules_management' },
  { title: 'Migration', href: '/migration', icon: Upload, permission: 'settings.manage', tierFeature: 'advanced_analytics' },
  { title: 'Profile', href: '/profile', icon: User, permission: null, tierFeature: 'profile_management' },
  { title: 'Settings', href: '/settings', icon: Settings, permission: 'settings.view', tierFeature: 'settings_basic' },
]

export const BOTTOM_NAV_ITEMS: NavigationItem[] = [
  { title: 'Notifications', href: '/notifications', icon: Bell, permission: null, tierFeature: 'notifications_advanced' },
  { title: 'Help & Support', href: '/help', icon: HelpCircle, permission: null },
]


