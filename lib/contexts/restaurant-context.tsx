// lib/contexts/restaurant-context.tsx
"use client"

import { createContext, useContext, useState, useEffect, ReactNode } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useUserRestaurants, type RestaurantStaffInfo } from "@/lib/hooks/use-restaurants"
import { getRestaurantTier, hasFeature, getNavigationItems, type RestaurantTier } from "@/lib/utils/tier"

interface RestaurantContextType {
  restaurants: RestaurantStaffInfo[]
  currentRestaurant: RestaurantStaffInfo | null
  isLoading: boolean
  isMultiRestaurant: boolean
  tier: RestaurantTier | null
  hasFeature: (feature: string) => boolean
  switchRestaurant: (restaurantId: string) => void
  goToOverview: () => void
}

const RestaurantContext = createContext<RestaurantContextType | undefined>(undefined)

interface RestaurantProviderProps {
  children: ReactNode
  forcedRestaurantId?: string // For single restaurant mode
}

export function RestaurantProvider({ children, forcedRestaurantId }: RestaurantProviderProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { data: restaurants = [], isLoading } = useUserRestaurants()
  const [currentRestaurant, setCurrentRestaurant] = useState<RestaurantStaffInfo | null>(null)
  
  const isMultiRestaurant = restaurants.length > 1
  
  // Get current restaurant tier - be defensive about loading state
  const getTier = () => {
    if (currentRestaurant) {
      return getRestaurantTier(currentRestaurant.restaurant)
    }
    
    // During loading, check localStorage for cached tier (only on client side)
    if (isLoading && typeof window !== 'undefined') {
      const cachedTier = localStorage.getItem('restaurant-tier')
      return cachedTier === 'basic' ? 'basic' : (cachedTier === 'pro' ? 'pro' : null)
    }
    
    return 'pro'
  }
  
  const tier = getTier()
  
  
  
  // Feature checker function
  const checkFeature = (feature: string) => {
    if (!tier) return false // During loading, deny all features
    return hasFeature(tier, feature as any)
  }
  
  useEffect(() => {
    if (isLoading || restaurants.length === 0) return

    // If we have a forced restaurant ID (single restaurant mode), use it
    if (forcedRestaurantId) {
      const restaurant = restaurants.find(r => r.restaurant.id === forcedRestaurantId)
      if (restaurant) {
        setCurrentRestaurant(restaurant)
      }
      return
    }

    // Check for restaurant ID in URL params first
    const urlRestaurantId = searchParams.get('restaurant')
    if (urlRestaurantId) {
      const restaurant = restaurants.find(r => r.restaurant.id === urlRestaurantId)
      if (restaurant) {
        setCurrentRestaurant(restaurant)
        // Also save to localStorage for future sessions
        if (typeof window !== 'undefined') {
          localStorage.setItem('selected-restaurant-id', urlRestaurantId)
          localStorage.setItem('restaurant-tier', restaurant.restaurant.tier || 'pro')
        }
        return
      }
    }

    // Check localStorage for last selected restaurant (only on client side)
    if (typeof window !== 'undefined') {
      const savedRestaurantId = localStorage.getItem('selected-restaurant-id')
      if (savedRestaurantId) {
        const restaurant = restaurants.find(r => r.restaurant.id === savedRestaurantId)
        if (restaurant) {
          setCurrentRestaurant(restaurant)
          // Cache tier for immediate access on refresh
          localStorage.setItem('restaurant-tier', restaurant.restaurant.tier || 'pro')
          return
        }
      }
    }

    // If single restaurant, auto-select it
    if (restaurants.length === 1) {
      setCurrentRestaurant(restaurants[0])
      // Cache tier for immediate access on refresh (only on client side)
      if (typeof window !== 'undefined') {
        localStorage.setItem('selected-restaurant-id', restaurants[0].restaurant.id)
        localStorage.setItem('restaurant-tier', restaurants[0].restaurant.tier || 'pro')
        // Also set cookie for middleware access
        document.cookie = `selected-restaurant-id=${restaurants[0].restaurant.id}; path=/; max-age=${30 * 24 * 60 * 60}` // 30 days
      }
      return
    }

    // Multiple restaurants and no selection - for non-overview pages, try to pick the first one
    // This prevents multi-restaurant users from being stuck without a restaurant context
    if (typeof window !== 'undefined') {
      const currentPath = window.location.pathname
      const isOverviewPage = currentPath === '/dashboard/overview'
      
      // If not on overview page and we have multiple restaurants but no selection,
      // auto-select the first restaurant to prevent data loading issues
      if (!isOverviewPage && restaurants.length > 1) {
        const firstRestaurant = restaurants[0]
        setCurrentRestaurant(firstRestaurant)
        localStorage.setItem('selected-restaurant-id', firstRestaurant.restaurant.id)
        localStorage.setItem('restaurant-tier', firstRestaurant.restaurant.tier || 'pro')
        // Also set cookie for middleware access
        document.cookie = `selected-restaurant-id=${firstRestaurant.restaurant.id}; path=/; max-age=${30 * 24 * 60 * 60}` // 30 days
        return
      }
    }

    // Multiple restaurants and no selection - stay in overview mode only if on overview page
    setCurrentRestaurant(null)
  }, [restaurants, isLoading, searchParams, forcedRestaurantId])

  const switchRestaurant = (restaurantId: string) => {
    const restaurant = restaurants.find(r => r.restaurant.id === restaurantId)
    if (restaurant) {
      setCurrentRestaurant(restaurant)
      
      // Cache selections (only on client side)
      if (typeof window !== 'undefined') {
        localStorage.setItem('selected-restaurant-id', restaurantId)
        // Cache tier for immediate access on refresh
        localStorage.setItem('restaurant-tier', restaurant.restaurant.tier || 'pro')
        
        // Also set cookie for middleware access
        document.cookie = `selected-restaurant-id=${restaurantId}; path=/; max-age=${30 * 24 * 60 * 60}` // 30 days
      }
      
      // Smart routing based on restaurant tier and current route
      const currentPath = typeof window !== 'undefined' ? window.location.pathname : ''
      const restaurantTier = getRestaurantTier(restaurant.restaurant)
      const availableRoutes = getNavigationItems(restaurantTier).map(item => item.href)
      
      // Define route mapping for tier-specific redirects
      const routeRedirects: Record<string, string> = {
        // Basic tier gets redirected to basic dashboard
        '/dashboard': restaurantTier === 'basic' ? '/basic-dashboard' : '/dashboard',
        '/basic-dashboard': restaurantTier === 'pro' ? '/dashboard' : '/basic-dashboard',
      }
      
      // Pro-tier only routes that should redirect Basic tier users to basic dashboard
      const proOnlyRoutes = [
        '/analytics', '/tables', '/customers', '/vip', '/waitlist', 
        '/loyalty', '/offers', '/staff', '/schedules', '/orders', 
        '/kitchen', '/notifications'
      ]
      
      // Check if current route is available for the new restaurant's tier
      const isProOnlyRoute = proOnlyRoutes.some(route => currentPath.startsWith(route))
      const currentRouteAvailable = availableRoutes.some(route => currentPath.startsWith(route)) || 
                                   currentPath === '/basic-dashboard' || 
                                   currentPath.startsWith('/dashboard')
      
      if (typeof window !== 'undefined') {
        let targetPath = currentPath
        
        // If switching to Basic tier and on a Pro-only route, redirect to basic dashboard
        if (restaurantTier === 'basic' && isProOnlyRoute) {
          targetPath = '/basic-dashboard'
        }
        // If switching to Pro tier and on basic dashboard, redirect to main dashboard
        else if (restaurantTier === 'pro' && currentPath === '/basic-dashboard') {
          targetPath = '/dashboard'
        }
        // If current route is not available for new restaurant tier, redirect to appropriate homepage
        else if (!currentRouteAvailable) {
          targetPath = restaurantTier === 'basic' ? '/basic-dashboard' : '/dashboard'
        } else {
          // Apply tier-specific route redirects
          const redirectPath = routeRedirects[currentPath]
          if (redirectPath) {
            targetPath = redirectPath
          }
        }
        
        // Update URL with restaurant parameter and navigate to appropriate route
        const targetUrl = new URL(targetPath, window.location.origin)
        targetUrl.searchParams.set('restaurant', restaurantId)
        
        console.log(`🔄 Switching restaurant: ${restaurant.restaurant.name} (${restaurantTier} tier)`)
        console.log(`🔄 Current path: ${currentPath} → Target path: ${targetPath}`)
        
        router.replace(targetUrl.pathname + targetUrl.search)
      }
    }
  }

  const goToOverview = () => {
    setCurrentRestaurant(null)
    
    // Clear localStorage and cookies (only on client side)
    if (typeof window !== 'undefined') {
      localStorage.removeItem('selected-restaurant-id')
      localStorage.removeItem('restaurant-tier')
      // Clear cookie
      document.cookie = 'selected-restaurant-id=; path=/; max-age=0'
    }
    
    // Remove restaurant parameter from URL
    const currentUrl = new URL(window.location.href)
    currentUrl.searchParams.delete('restaurant')
    router.replace('/dashboard/overview')
  }

  return (
    <RestaurantContext.Provider
      value={{
        restaurants,
        currentRestaurant,
        isLoading,
        isMultiRestaurant,
        tier,
        hasFeature: checkFeature,
        switchRestaurant,
        goToOverview,
      }}
    >
      {children}
    </RestaurantContext.Provider>
  )
}

export function useRestaurantContext() {
  const context = useContext(RestaurantContext)
  if (context === undefined) {
    throw new Error('useRestaurantContext must be used within a RestaurantProvider')
  }
  return context
}