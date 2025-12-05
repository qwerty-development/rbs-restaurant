// lib/utils/tier.ts

export type RestaurantTier = 'basic' | 'pro'

/**
 * Check if a restaurant has Pro tier features
 */
export function isProTier(tier: RestaurantTier): boolean {
  return tier === 'pro'
}

/**
 * Check if a restaurant has Basic tier features
 */
export function isBasicTier(tier: RestaurantTier): boolean {
  return tier === 'basic'
}

/**
 * Get the tier from a restaurant object, defaulting to 'pro' for backward compatibility
 */
export function getRestaurantTier(restaurant: { tier?: RestaurantTier }): RestaurantTier {
  return restaurant.tier ?? 'pro'
}

/**
 * Feature flags based on tier
 */
export const TIER_FEATURES = {
  basic: {
    // Core booking features (only in dashboard)
    booking_management: true,
    booking_accept_decline: true,
    booking_history: true,
    booking_analytics: true,
    
    // Basic restaurant features
    menu_management: true,
    review_management: true,
    profile_management: true,
    settings_basic: true,
    section_management: true, // Basic section management for organizing bookings
    
    // Disabled features
    bookings_advanced: false, // No separate bookings page
    table_management: false,
    floor_plan: false,
    table_assignment: false,
    customer_management: false,
    staff_management: true, // Enable staff management for basic tier
    advanced_analytics: false,
    kitchen_management: false,
    waitlist: true, // Enable waitlist for basic tier
    loyalty_management: false,
    offers_management: false,
    orders_management: false,
    schedules_management: true, // Enable schedules management for basic tier
    complex_booking_status: false,
    manual_booking_creation: false,
    notifications_advanced: false,
  },
  pro: {
    // All features enabled for Pro tier
    booking_management: true,
    bookings_advanced: true, // Separate bookings page
    booking_accept_decline: true,
    booking_history: true,
    booking_analytics: true,
    table_management: true,
    floor_plan: true,
    table_assignment: true,
    customer_management: true,
    staff_management: true,
    advanced_analytics: true,
    kitchen_management: true,
    waitlist: true,
    loyalty_management: true,
    offers_management: true,
    orders_management: true,
    schedules_management: true,
    complex_booking_status: true,
    manual_booking_creation: true,
    menu_management: true,
    review_management: true,
    profile_management: true,
    settings_basic: true,
    section_management: false, // Pro tier uses advanced section management via tables page
    notifications_advanced: true,
  }
} as const

export const GUEST_CRM_ADDON = 'guest_crm'

/**
 * Check if a feature is enabled for the given tier and addons
 */
export function hasFeature(
  tier: RestaurantTier, 
  feature: keyof typeof TIER_FEATURES.basic,
  addons: string[] = []
): boolean {
  // Check if feature is enabled by tier
  if (TIER_FEATURES[tier][feature]) {
    return true
  }

  // Check if feature is enabled by addon
  if (feature === 'customer_management' && addons.includes(GUEST_CRM_ADDON)) {
    return true
  }

  return false
}

/**
 * Get simplified booking statuses for Basic tier
 */
export const BASIC_TIER_BOOKING_STATUSES = ['pending', 'confirmed', 'declined_by_restaurant'] as const
export const PRO_TIER_BOOKING_STATUSES = [
  'pending', 'confirmed', 'cancelled_by_user', 'declined_by_restaurant', 
  'auto_declined', 'completed', 'no_show', 'arrived', 'seated', 
  'ordered', 'appetizers', 'main_course', 'dessert', 'payment', 
  'cancelled_by_restaurant'
] as const

export type BasicTierBookingStatus = typeof BASIC_TIER_BOOKING_STATUSES[number]
export type ProTierBookingStatus = typeof PRO_TIER_BOOKING_STATUSES[number]

/**
 * Get allowed booking statuses based on tier
 */
export function getAllowedBookingStatuses(tier: RestaurantTier) {
  return isBasicTier(tier) ? BASIC_TIER_BOOKING_STATUSES : PRO_TIER_BOOKING_STATUSES
}

/**
 * Check if a booking status is valid for the given tier
 */
export function isValidBookingStatus(tier: RestaurantTier, status: string): boolean {
  const allowedStatuses = getAllowedBookingStatuses(tier)
  return allowedStatuses.includes(status as any)
}

/**
 * Get navigation items based on tier and addons
 */
export function getNavigationItems(tier: RestaurantTier, addons: string[] = []) {
  const baseItems = [
    { href: '/dashboard', label: 'Dashboard', feature: 'booking_management' },
    { href: '/menu', label: 'Menu', feature: 'menu_management' },
    { href: '/waitlist', label: 'Waiting List', feature: 'waitlist' },
    { href: '/reviews', label: 'Reviews', feature: 'review_management' },
    { href: '/staff', label: 'Staff', feature: 'staff_management' },
    { href: '/schedules', label: 'Schedules', feature: 'schedules_management' },
    { href: '/profile', label: 'Profile', feature: 'profile_management' },
    { href: '/settings', label: 'Settings', feature: 'settings_basic' },
  ]

  const basicOnlyItems = [
    { href: '/basic-dashboard/sections', label: 'Sections', feature: 'section_management' },
  ]

  const proOnlyItems = [
    { href: '/customers', label: 'Customers', feature: 'customer_management' },
    { href: '/vip', label: 'VIP Customers', feature: 'customer_management' },
    { href: '/tables', label: 'Tables', feature: 'table_management' },
    { href: '/analytics', label: 'Analytics', feature: 'advanced_analytics' },
    { href: '/loyalty', label: 'Loyalty', feature: 'loyalty_management' },
    { href: '/offers', label: 'Offers', feature: 'offers_management' },
    { href: '/orders', label: 'Orders', feature: 'orders_management' },
    { href: '/kitchen', label: 'Kitchen', feature: 'kitchen_management' },
    { href: '/notifications', label: 'Notifications', feature: 'notifications_advanced' },
  ]

  // Filter items based on tier features
  const tierSpecificItems = tier === 'basic' ? basicOnlyItems : proOnlyItems
  const allItems = [...baseItems, ...tierSpecificItems]
  return allItems.filter(item => hasFeature(tier, item.feature as keyof typeof TIER_FEATURES.basic, addons))
}
