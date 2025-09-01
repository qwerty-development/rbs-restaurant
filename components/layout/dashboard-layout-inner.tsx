// components/layout/dashboard-layout-inner.tsx
"use client"

import { useEffect } from "react"
import { useRouter, usePathname, useSearchParams } from "next/navigation"
import { useRestaurantContext } from "@/lib/contexts/restaurant-context"
import { useSidebar } from "@/lib/contexts/sidebar-context"
import { Sidebar } from "@/components/layout/sidebar"
import { MobileNav } from "@/components/layout/mobile-nav"
import { StaffChatProvider } from "@/lib/contexts/staff-chat-context"
import StaffChatToggle from "@/components/chat/chat-toggle"
import StaffChatPanel from "@/components/chat/staff-chat-panel"
import { RestaurantSelector } from "@/components/layout/restaurant-selector"

interface DashboardLayoutInnerProps {
  children: React.ReactNode
  staffData: any[]
}

export function DashboardLayoutInner({ children, staffData }: DashboardLayoutInnerProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { restaurants, currentRestaurant, isLoading, isMultiRestaurant } = useRestaurantContext()
  const { isCollapsed } = useSidebar()

  // If we're on the overview page, don't enforce restaurant selection
  const isOverviewPage = pathname === '/dashboard/overview'

  useEffect(() => {
    if (isLoading) return

    // If single restaurant, auto-redirect to main dashboard with restaurant param
    if (restaurants.length === 1 && !searchParams.get('restaurant') && pathname === '/dashboard') {
      const restaurantId = restaurants[0].restaurant.id
      router.replace(`/dashboard?restaurant=${restaurantId}`)
      return
    }

    // If multi-restaurant and no current selection and not on overview, redirect to overview
    if (isMultiRestaurant && !currentRestaurant && pathname === '/dashboard' && !searchParams.get('restaurant')) {
      router.replace('/dashboard/overview')
      return
    }
  }, [
    restaurants.length, 
    currentRestaurant, 
    isLoading, 
    isMultiRestaurant, 
    router, 
    pathname, 
    searchParams
  ])

  // Show loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background to-card flex items-center justify-center">
        <div className="text-center">
          <div className="relative">
            <div className="animate-spin rounded-full h-16 w-16 border-4 border-border mx-auto mb-4" />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="h-10 w-10 rounded-full bg-gradient-to-br from-primary to-primary/80 animate-pulse" />
            </div>
          </div>
          <p className="text-lg font-medium text-foreground">Setting up your dashboard...</p>
          <p className="text-sm text-muted-foreground mt-1">Loading restaurant data</p>
        </div>
      </div>
    )
  }

  // For overview page, render without restaurant-specific layout
  if (isOverviewPage) {
    return (
      <div className="min-h-screen bg-background relative\">
        <main className="min-h-screen">
          {children}
        </main>
      </div>
    )
  }

  // Render restaurant-specific layout - only if we need a restaurant but don't have one
  if (!currentRestaurant && !isOverviewPage) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background to-card flex items-center justify-center">
        <div className="text-center">
          <p className="text-lg font-medium text-foreground">No restaurant selected</p>
          <p className="text-sm text-muted-foreground mt-1">Redirecting to overview...</p>
        </div>
      </div>
    )
  }

  // If we have a current restaurant, render the restaurant-specific layout
  if (currentRestaurant) {
    return (
      <div className="min-h-screen bg-background relative">
        {/* Sidebar Container - Show on tablets and up */}
        <div className="hidden sm:block fixed inset-y-0 left-0 z-30">
          <Sidebar 
            restaurant={{
              id: currentRestaurant.restaurant.id,
              name: currentRestaurant.restaurant.name,
              main_image_url: currentRestaurant.restaurant.main_image_url || undefined
            }}
            role={currentRestaurant.role}
            permissions={currentRestaurant.permissions}
          />
        </div>

        {/* Mobile Navigation - Show on phones only */}
        <div className="sm:hidden">
          <MobileNav 
            restaurant={{
              id: currentRestaurant.restaurant.id,
              name: currentRestaurant.restaurant.name,
              main_image_url: currentRestaurant.restaurant.main_image_url || undefined
            }}
            role={currentRestaurant.role}
            permissions={currentRestaurant.permissions}
          />
        </div>

        {/* Restaurant Selector - Show when multiple restaurants */}
        {isMultiRestaurant && (
          <div className={`transition-all duration-200 ease-out ${isCollapsed ? 'sm:ml-16' : 'sm:ml-72'}`}>
            <RestaurantSelector />
          </div>
        )}

        {/* Main Content - Full height optimization without header */}
        <div className={`transition-all duration-200 ease-out ${isCollapsed ? 'sm:ml-16' : 'sm:ml-72'} ${isMultiRestaurant ? 'pt-14' : ''}`}>
          <StaffChatProvider restaurantId={currentRestaurant.restaurant.id}>
            <main className="min-h-screen">
              {children}
            </main>
            <StaffChatToggle />
            <StaffChatPanel />
          </StaffChatProvider>
        </div>
      </div>
    )
  }

  // Fallback - this shouldn't normally be reached
  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-card flex items-center justify-center">
      <div className="text-center">
        <p className="text-lg font-medium text-foreground">Loading dashboard...</p>
      </div>
    </div>
  )
}