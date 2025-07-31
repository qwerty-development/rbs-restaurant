// components/layout/sidebar.tsx

'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { 
  LayoutDashboard, 
  Calendar, 
  Users, 
  Utensils, 
  TableIcon,
  BarChart3, 
  Settings,
  Star,
  DollarSign,
  Gift,
  Megaphone,
  HelpCircle,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Crown,
  User
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { restaurantAuth } from '@/lib/restaurant-auth'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Role } from '@/lib/restaurant-auth'

interface SidebarProps {
  restaurant: {
    id: string
    name: string
    main_image_url?: string
  }
  role: Role
  permissions: string[]
}

const navigationItems = [
  {
    title: 'Dashboard',
    href: '/dashboard',
    icon: LayoutDashboard,
    permission: null, // Always visible
  },
  {
    title: 'Bookings',
    href: '/bookings',
    icon: Calendar,
    permission: 'bookings.view',
  },
  {
    title: 'Customers',
    href: '/customers',
    icon: Users,
    permission: 'customers.view',
  },
  {
    title: 'VIP Customers',
    href: '/vip',
    icon: Crown,
    permission: 'vip.view',
  },
  {
    title: 'Menu',
    href: '/menu',
    icon: Utensils,
    permission: 'menu.view',
  },
  {
    title: 'Tables',
    href: '/tables',
    icon: TableIcon,
    permission: 'tables.view',
  },
  {
    title: 'Analytics',
    href: '/analytics',
    icon: BarChart3,
    permission: 'analytics.view',
  },
  {
    title: 'Reviews',
    href: '/reviews',
    icon: Star,
    permission: 'reviews.view',
  },
  {
    title: 'Loyalty',
    href: '/loyalty',
    icon: Gift,
    permission: 'loyalty.view',
  },
  {
    title: 'Offers',
    href: '/offers',
    icon: DollarSign,
    permission: 'offers.view',
  },
  {
    title: 'Staff',
    href: '/staff',
    icon: Users,
    permission: null,
  },
  {
    title: 'Profile',
    href: '/profile',
    icon: User,
    permission: null, // Always visible
  },
  {
    title: 'Settings',
    href: '/settings',
    icon: Settings,
    permission: 'settings.view',
  },
]

const bottomNavigationItems = [
  {
    title: 'Help & Support',
    href: '/help',
    icon: HelpCircle,
    permission: null, // Always visible
  },
]

export function Sidebar({ restaurant, role, permissions }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()
  const [isCollapsed, setIsCollapsed] = useState(false)

  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut()
      router.push('/login')
      toast.success('Signed out successfully')
    } catch (error) {
      console.error('Error signing out:', error)
      toast.error('Failed to sign out')
    }
  }

  const filteredNavItems = navigationItems.filter(item => 
    !item.permission || restaurantAuth.hasPermission(permissions, item.permission, role)
  )

  const filteredBottomItems = bottomNavigationItems.filter(item => 
    !item.permission || restaurantAuth.hasPermission(permissions, item.permission, role)
  )

  return (
    <aside className={cn(
      "flex flex-col h-full bg-sidebar border-r border-sidebar-border transition-all duration-300",
      isCollapsed ? "w-16" : "w-64"
    )}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-sidebar-border">
        {!isCollapsed && (
          <div>
            <h2 className="text-lg font-semibold truncate">{restaurant.name}</h2>
            <p className="text-sm text-sidebar-foreground/60 capitalize">{role}</p>
          </div>
        )}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="ml-auto"
        >
          {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </Button>
      </div>

      {/* Navigation */}
      <ScrollArea className="flex-1 px-2 py-4">
        <nav className="space-y-1">
          {filteredNavItems.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`)
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                  isActive
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground",
                  isCollapsed && "justify-center px-2"
                )}
                title={isCollapsed ? item.title : undefined}
              >
                <item.icon className="h-5 w-5 shrink-0" />
                {!isCollapsed && <span>{item.title}</span>}
              </Link>
            )
          })}
        </nav>
      </ScrollArea>

      {/* Bottom Section */}
      <div className="border-t border-sidebar-border p-2 space-y-1">
        {filteredBottomItems.map((item) => {
          const isActive = pathname === item.href
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                isActive
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground",
                isCollapsed && "justify-center px-2"
              )}
              title={isCollapsed ? item.title : undefined}
            >
              <item.icon className="h-5 w-5 shrink-0" />
              {!isCollapsed && <span>{item.title}</span>}
            </Link>
          )
        })}
        
        <Button
          variant="ghost"
          onClick={handleSignOut}
          className={cn(
            "w-full justify-start gap-3 text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground",
            isCollapsed && "justify-center px-2"
          )}
          title={isCollapsed ? "Sign Out" : undefined}
        >
          <LogOut className="h-5 w-5 shrink-0" />
          {!isCollapsed && <span>Sign Out</span>}
        </Button>
      </div>
    </aside>
  )
}