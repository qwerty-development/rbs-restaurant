// components/layout/sidebar.tsx

'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useSidebar } from '@/lib/contexts/sidebar-context'
import { useRestaurantContext } from '@/lib/contexts/restaurant-context'
import { ChevronLeft, ChevronRight, LogOut, Building2, Grid3X3, ArrowLeft } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { restaurantAuth } from '@/lib/restaurant-auth'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Role } from '@/lib/restaurant-auth'
import { NAV_ITEMS, BOTTOM_NAV_ITEMS } from '@/components/layout/nav-config'

interface SidebarProps {
  restaurant: {
    id: string
    name: string
    main_image_url?: string
  }
  role: Role
  permissions: string[]
}

// Navigation items sourced from centralized config

export function Sidebar({ restaurant, role, permissions }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()
  const { isCollapsed, setIsCollapsed, toggleSidebar } = useSidebar()
  const { currentRestaurant, hasFeature, tier } = useRestaurantContext()
  const [openGroups, setOpenGroups] = useState<string[]>([])

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

  const filteredNavItems = NAV_ITEMS.filter(item => {
    // Check permission first
    if (item.permission && !restaurantAuth.hasPermission(permissions, item.permission, role)) {
      return false
    }
    
    // Check tier feature
    if (item.tierFeature && !hasFeature(item.tierFeature)) {
      return false
    }
    
    return true
  }).map(item => {
    // Transform Dashboard href based on tier
    if (item.title === 'Dashboard' && tier === 'basic') {
      return { ...item, href: '/basic-dashboard' }
    }
    // Transform Sections href based on tier
    if (item.title === 'Sections' && tier === 'basic') {
      return { ...item, href: '/basic-dashboard/sections' }
    }
    return item
  })

  const filteredBottomItems = BOTTOM_NAV_ITEMS.filter(item => {
    // Check permission first
    if (item.permission && !restaurantAuth.hasPermission(permissions, item.permission, role)) {
      return false
    }
    
    // Check tier feature (skip if no tierFeature specified - like Help)
    if (item.tierFeature && !hasFeature(item.tierFeature)) {
      return false
    }
    
    return true
  })

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
        <RestaurantHeader 
          restaurant={restaurant}
          role={role}
          isCollapsed={isCollapsed}
        />

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

// Restaurant Header Component
interface RestaurantHeaderProps {
  restaurant: {
    id: string
    name: string
    main_image_url?: string
  }
  role: Role
  isCollapsed: boolean
}

function RestaurantHeader({ restaurant, role, isCollapsed }: RestaurantHeaderProps) {


  // For now, just return the basic header without multi-restaurant features
  // This will be enhanced when the context is properly integrated
  return (
    <div className="transition-all duration-200 ease-out overflow-hidden w-auto opacity-100">
      <h2 className="text-base md:text-lg font-semibold truncate whitespace-nowrap">{restaurant.name}</h2>
      <p className="text-xs md:text-sm text-sidebar-foreground/60 capitalize whitespace-nowrap">{role}</p>
    </div>
  )
}