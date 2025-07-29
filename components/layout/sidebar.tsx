// components/layout/sidebar.tsx
"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import {
  LayoutDashboard,
  CalendarDays,
  Users,
  Utensils,
  TableProperties,
  Star,
  Gift,
  TrendingUp,
  Settings,
  Crown,
  MessageSquare,
  ClipboardList,
  Award,
} from "lucide-react"
import type { Restaurant } from "@/types"

interface NavItem {
  title: string
  href: string
  icon: React.ElementType
  permission?: string
}

const navItems: NavItem[] = [
  {
    title: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    title: "Bookings",
    href: "/bookings",
    icon: CalendarDays,
  },
  {
    title: "Tables",
    href: "/tables",
    icon: TableProperties,
  },
  {
    title: "Menu",
    href: "/menu",
    icon: Utensils,
  },
  {
    title: "VIP Customers",
    href: "/vip",
    icon: Crown,
    permission: "manage_vip",
  },
  {
    title: "Special Offers",
    href: "/offers",
    icon: Gift,
  },
  {
    title: "Loyalty Program",
    href: "/loyalty",
    icon: Award,
  },
  {
    title: "Reviews",
    href: "/reviews",
    icon: MessageSquare,
  },
  {
    title: "Analytics",
    href: "/analytics",
    icon: TrendingUp,
    permission: "view_analytics",
  },
  {
    title: "Settings",
    href: "/settings",
    icon: Settings,
    permission: "manage_settings",
  },
]

interface SidebarProps {
  restaurant: Restaurant
  role: string
  permissions: string[]
}

export function Sidebar({ restaurant, role, permissions }: any) {
  const pathname = usePathname()

  // Filter nav items based on permissions
  const filteredNavItems = navItems.filter((item) => {
    if (!item.permission) return true
    if (role === "owner") return true
    return permissions.includes(item.permission)
  })

  return (
    <div className="flex flex-col bg-card border-r">
      {/* Restaurant Info */}
      <div className="flex h-16 items-center px-6 border-b">
        <div className="flex items-center gap-3">
          {restaurant.main_image_url && (
            <img
              src={restaurant.main_image_url}
              alt={restaurant.name}
              className="h-8 w-8 rounded-full object-cover"
            />
          )}
          <div>
            <h2 className="text-sm font-semibold">{restaurant.name}</h2>
            <p className="text-xs text-muted-foreground capitalize">{role}</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 px-3 py-4">
        {filteredNavItems.map((item) => {
          const Icon = item.icon
          const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`)
          
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <Icon className="h-4 w-4" />
              {item.title}
            </Link>
          )
        })}
      </nav>

      {/* Restaurant Status */}
      <div className="border-t p-4">
        <div className="rounded-lg bg-muted p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium">Restaurant Status</span>
            <span className={cn(
              "text-xs font-medium",
              restaurant.is_active ? "text-green-600" : "text-red-600"
            )}>
              {restaurant.is_active ? "Open" : "Closed"}
            </span>
          </div>
          <div className="text-xs text-muted-foreground">
            {restaurant.opening_time} - {restaurant.closing_time}
          </div>
        </div>
      </div>
    </div>
  )
}