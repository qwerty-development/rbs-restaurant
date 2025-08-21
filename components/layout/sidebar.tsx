// components/layout/sidebar.tsx

'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useSidebar } from '@/lib/contexts/sidebar-context'
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
  User,
  Clock,
  Bell,
  ChefHat,
  Receipt
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
    title: 'Waiting List',
    href: '/waitlist',
    icon: Clock,
    permission: 'bookings.view',
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
    title: 'Notifications',
    href: '/notifications',
    icon: Bell,
    permission: null, // Always visible
    badge: 3, // Notification count
  },
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
  const { isCollapsed, setIsCollapsed, toggleSidebar } = useSidebar()

  // Keyboard navigation support
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isCollapsed) {
        setIsCollapsed(true)
      }
    }

    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [isCollapsed, setIsCollapsed])

  // Prevent body scroll when sidebar is expanded
  useEffect(() => {
    if (!isCollapsed) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
    }

    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [isCollapsed])

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
    <>
      {/* Backdrop blur when expanded - covers everything */}
      {!isCollapsed && (
        <div 
          className="fixed inset-0 bg-black/30 backdrop-blur-sm z-[50] transition-all duration-200 ease-out"
          onClick={() => setIsCollapsed(true)}
          onTouchEnd={() => setIsCollapsed(true)} // Better touch support
          role="button"
          tabIndex={-1}
          aria-label="Close sidebar"
        />
      )}
      
      <aside 
        className={cn(
          "flex flex-col h-screen bg-sidebar/98 backdrop-blur-xl border-r border-sidebar-border transition-all duration-200 ease-out group fixed inset-y-0 left-0 overflow-hidden",
          // Always fixed position to prevent layout jumps
          // Collapsed: narrow width, normal z-index
          // Expanded: wider width, higher z-index
          isCollapsed 
            ? "w-16 z-30 shadow-sm" 
            : "w-72 z-[60] shadow-2xl"
        )}
        role="complementary"
        aria-label="Navigation sidebar"
      >
      {/* Header - Optimized for tablets */}
      <div className="flex items-center justify-between p-3 md:p-4 border-b border-sidebar-border">
        <div className={cn(
          "transition-all duration-200 ease-out overflow-hidden",
          isCollapsed ? "w-0 opacity-0" : "w-auto opacity-100"
        )}>
          <h2 className="text-base md:text-lg font-semibold truncate whitespace-nowrap">{restaurant.name}</h2>
          <p className="text-xs md:text-sm text-sidebar-foreground/60 capitalize whitespace-nowrap">{role}</p>
        </div>
        
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleSidebar}
          className={cn(
            "h-8 w-8 md:h-9 md:w-9 shrink-0 transition-all duration-150 ease-out hover:bg-sidebar-accent/30",
            isCollapsed ? "" : "ml-auto"
          )}
        >
          {isCollapsed ? <ChevronRight className="h-3 w-3 md:h-4 md:w-4" /> : <ChevronLeft className="h-3 w-3 md:h-4 md:w-4" />}
        </Button>
      </div>

      {/* Navigation - Optimized for tablets with proper scrolling */}
      <ScrollArea className="flex-1 px-1.5 md:px-2 py-3 md:py-4 overflow-y-auto">
        <nav className="space-y-0.5 md:space-y-1">
          {filteredNavItems.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`)
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => {
                  // Auto-collapse sidebar on navigation for better UX on tablets
                  if (window.innerWidth < 768 && !isCollapsed) {
                    setIsCollapsed(true)
                  }
                }}
                className={cn(
                  "flex items-center px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 ease-out touch-manipulation",
                  isActive
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground",
                  isCollapsed && "justify-center"
                )}
                title={isCollapsed ? item.title : undefined}
                data-tooltip={isCollapsed ? item.title : undefined}
              >
                <item.icon className="h-4 w-4 md:h-5 md:w-5 shrink-0" />
                <span className={cn(
                  "text-xs md:text-sm transition-all duration-200 ease-out whitespace-nowrap",
                  isCollapsed ? "opacity-0 w-0" : "opacity-100 w-auto ml-3"
                )}>
                  {item.title}
                </span>
              </Link>
            )
          })}
        </nav>
      </ScrollArea>

      {/* Bottom Section - Optimized for tablets */}
      <div className="border-t border-sidebar-border p-1.5 md:p-2 space-y-0.5 md:space-y-1">
        {filteredBottomItems.map((item) => {
          const isActive = pathname === item.href
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => {
                // Auto-collapse sidebar on navigation for better UX on tablets
                if (window.innerWidth < 768 && !isCollapsed) {
                  setIsCollapsed(true)
                }
              }}
              className={cn(
                "flex items-center px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 ease-out touch-manipulation relative",
                isActive
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground",
                isCollapsed && "justify-center"
              )}
              title={isCollapsed ? item.title : undefined}
            >
              <div className="relative">
                <item.icon className="h-4 w-4 md:h-5 md:w-5 shrink-0" />
                {(item as any).badge && (item as any).badge > 0 && (
                  <span className="absolute -right-1 -top-1 h-3 w-3 md:h-3.5 md:w-3.5 rounded-full bg-red-600 text-[8px] md:text-[9px] font-medium text-white flex items-center justify-center">
                    {(item as any).badge}
                  </span>
                )}
              </div>
              <span className={cn(
                "text-xs md:text-sm transition-all duration-200 ease-out whitespace-nowrap",
                isCollapsed ? "opacity-0 w-0" : "opacity-100 w-auto ml-3"
              )}>
                {item.title}
              </span>
            </Link>
          )
        })}
        
        <Button
          variant="ghost"
          onClick={handleSignOut}
          className={cn(
            "w-full justify-start text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground py-2.5 h-auto touch-manipulation transition-all duration-150 ease-out px-3",
            isCollapsed && "justify-center"
          )}
          title={isCollapsed ? "Sign Out" : undefined}
        >
          <LogOut className="h-4 w-4 md:h-5 md:w-5 shrink-0" />
          <span className={cn(
            "text-xs md:text-sm transition-all duration-200 ease-out whitespace-nowrap",
            isCollapsed ? "opacity-0 w-0" : "opacity-100 w-auto ml-3"
          )}>
            Sign Out
          </span>
        </Button>
      </div>
    </aside>
    </>
  )
}