// components/layout/sidebar.tsx

'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useSidebar } from '@/lib/contexts/sidebar-context'
import { ChevronLeft, ChevronRight, LogOut } from 'lucide-react'
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

  const filteredNavItems = NAV_ITEMS.filter(item => 
    !item.permission || restaurantAuth.hasPermission(permissions, item.permission, role)
  )

  const filteredBottomItems = BOTTOM_NAV_ITEMS.filter(item => 
    !item.permission || restaurantAuth.hasPermission(permissions, item.permission, role)
  )

  return (
    <>
      {/* Enhanced backdrop with glassmorphism */}
      {!isCollapsed && (
        <div
          className="fixed inset-0 bg-black/20 backdrop-blur-md z-[50] transition-all duration-300 ease-out animate-fade-in"
          onClick={() => setIsCollapsed(true)}
          onTouchEnd={() => setIsCollapsed(true)} // Better touch support
          role="button"
          tabIndex={-1}
          aria-label="Close sidebar"
        />
      )}
      
      <aside
        className={cn(
          "flex flex-col h-screen bg-glass-bg/90 backdrop-blur-xl border-r border-glass-border transition-all duration-300 ease-out group fixed inset-y-0 left-0 overflow-hidden hover:shadow-lg hover:translate-y-[-2px]",
          // Enhanced glassmorphism effects
          // Collapsed: narrow width with subtle shadow
          // Expanded: wider width with enhanced glassmorphism
          isCollapsed
            ? "w-16 z-30 shadow-glass"
            : "w-72 z-[60] shadow-glass border-r border-glass-border/50"
        )}
        role="complementary"
        aria-label="Navigation sidebar"
      >
      {/* Enhanced Header with glassmorphism */}
      <div className="flex items-center justify-between p-4 border-b border-glass-border/30 bg-white/5 backdrop-blur-sm">
        <div className={cn(
          "transition-all duration-300 ease-out overflow-hidden",
          isCollapsed ? "w-0 opacity-0" : "w-auto opacity-100"
        )}>
          <h2 className="text-lg font-bold truncate whitespace-nowrap bg-gradient-to-r from-primary to-primary/90 bg-clip-text text-transparent">{restaurant.name}</h2>
          <p className="text-sm text-sidebar-foreground/70 capitalize whitespace-nowrap font-medium">{role}</p>
        </div>

        <Button
          variant="ghost"
          size="icon"
          onClick={toggleSidebar}
                      className={cn(
            "h-9 w-9 shrink-0 transition-all duration-200 ease-out hover:bg-accent/20 hover:scale-105 active:scale-95 rounded-xl focus:outline-none focus:ring-2 focus:ring-ring/50 focus:ring-offset-2",
            isCollapsed ? "" : "ml-auto"
          )}
        >
          {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
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
                  "flex items-center px-3 py-3 rounded-xl text-sm font-medium transition-all duration-200 ease-out touch-manipulation group relative overflow-hidden",
                  isActive
                    ? "bg-primary/10 text-primary shadow-sm border border-primary/20"
                    : "text-sidebar-foreground hover:bg-accent/20 hover:text-accent-foreground hover:shadow-sm hover:shadow-lg hover:translate-y-[-2px]",
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

      {/* Enhanced Bottom Section with glassmorphism */}
      <div className="border-t border-glass-border/30 p-2 space-y-1 bg-white/5 backdrop-blur-sm">
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
                "flex items-center px-3 py-3 rounded-xl text-sm font-medium transition-all duration-200 ease-out touch-manipulation relative group overflow-hidden",
                isActive
                  ? "bg-accent/30 text-accent-foreground shadow-sm border border-accent/30"
                  : "text-sidebar-foreground hover:bg-accent/20 hover:text-accent-foreground hover:shadow-sm hover:shadow-lg hover:translate-y-[-2px]",
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
            "w-full justify-start text-sidebar-foreground hover:bg-destructive/10 hover:text-destructive py-3 h-auto touch-manipulation transition-all duration-200 ease-out px-3 rounded-xl hover:shadow-lg hover:translate-y-[-2px] active:scale-95 focus:outline-none focus:ring-2 focus:ring-destructive/50 focus:ring-offset-2",
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