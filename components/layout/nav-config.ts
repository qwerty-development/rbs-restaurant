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
} from 'lucide-react'

export interface NavigationItem {
  title: string
  href: string
  icon: LucideIcon
  permission: string | null
  badge?: number
}

export const NAV_ITEMS: NavigationItem[] = [
  { title: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, permission: null },
  { title: 'Bookings', href: '/bookings', icon: Calendar, permission: 'bookings.view' },
  { title: 'Customers', href: '/customers', icon: Users, permission: 'customers.view' },
  { title: 'VIP Customers', href: '/vip', icon: Crown, permission: 'vip.view' },
  { title: 'Menu', href: '/menu', icon: Utensils, permission: 'menu.view' },
  { title: 'Tables', href: '/tables', icon: TableIcon, permission: 'tables.view' },
  { title: 'Analytics', href: '/analytics', icon: BarChart3, permission: 'analytics.view' },
  { title: 'Waiting List', href: '/waitlist', icon: Clock, permission: 'bookings.view' },
  { title: 'Reviews', href: '/reviews', icon: Star, permission: 'reviews.view' },
  { title: 'Loyalty', href: '/loyalty', icon: Gift, permission: 'loyalty.view' },
  { title: 'Offers', href: '/offers', icon: DollarSign, permission: 'offers.view' },
  { title: 'Staff', href: '/staff', icon: Users, permission: 'staff.manage' },
  { title: 'Schedules', href: '/schedules', icon: Clock, permission: 'schedules.view' },
  { title: 'Migration', href: '/migration', icon: Upload, permission: 'settings.manage' },
  { title: 'Profile', href: '/profile', icon: User, permission: null },
  { title: 'Settings', href: '/settings', icon: Settings, permission: 'settings.view' },
]

export const BOTTOM_NAV_ITEMS: NavigationItem[] = [
  { title: 'Notifications', href: '/notifications', icon: Bell, permission: null, badge: 3 },
  { title: 'Help & Support', href: '/help', icon: HelpCircle, permission: null },
]


