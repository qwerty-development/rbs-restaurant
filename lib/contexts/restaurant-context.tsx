// lib/contexts/restaurant-context.tsx
"use client"

import { createContext, useContext, useState, useEffect, ReactNode } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useUserRestaurants, type RestaurantStaffInfo } from "@/lib/hooks/use-restaurants"

interface RestaurantContextType {
  restaurants: RestaurantStaffInfo[]
  currentRestaurant: RestaurantStaffInfo | null
  isLoading: boolean
  isMultiRestaurant: boolean
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
        return
      }
    }

    // Check localStorage for last selected restaurant
    const savedRestaurantId = localStorage.getItem('selected-restaurant-id')
    if (savedRestaurantId) {
      const restaurant = restaurants.find(r => r.restaurant.id === savedRestaurantId)
      if (restaurant) {
        setCurrentRestaurant(restaurant)
        return
      }
    }

    // If single restaurant, auto-select it
    if (restaurants.length === 1) {
      setCurrentRestaurant(restaurants[0])
      return
    }

    // Multiple restaurants and no selection - stay in overview mode
    setCurrentRestaurant(null)
  }, [restaurants, isLoading, searchParams, forcedRestaurantId])

  const switchRestaurant = (restaurantId: string) => {
    const restaurant = restaurants.find(r => r.restaurant.id === restaurantId)
    if (restaurant) {
      setCurrentRestaurant(restaurant)
      localStorage.setItem('selected-restaurant-id', restaurantId)
      
      // Update URL to include restaurant parameter
      const currentUrl = new URL(window.location.href)
      currentUrl.searchParams.set('restaurant', restaurantId)
      router.replace(currentUrl.pathname + currentUrl.search)
    }
  }

  const goToOverview = () => {
    setCurrentRestaurant(null)
    localStorage.removeItem('selected-restaurant-id')
    
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