// types/index.ts
export interface RestaurantTable {
  id: string
  restaurant_id: string
  table_number: string
  table_type: "booth" | "window" | "patio" | "standard" | "bar" | "private"
  capacity: number
  x_position: number
  y_position: number
  shape: "rectangle" | "circle" | "square"
  width: number
  height: number
  is_active: boolean
  features: string[] | null
  created_at: string
  min_capacity: number
  max_capacity: number
  is_combinable: boolean
  combinable_with: string[]
  priority_score: number
}

export interface Booking {
  id: string
  user_id: string | null
  restaurant_id: string
  booking_time: string
  party_size: number
  status: "pending" | "confirmed" | "cancelled_by_user" | "declined_by_restaurant" | "completed" | "no_show"
  special_requests: string | null
  occasion: string | null
  dietary_notes: string[] | null
  confirmation_code: string
  table_preferences: string[] | null
  reminder_sent: boolean
  checked_in_at: string | null
  loyalty_points_earned: number
  created_at: string
  updated_at: string
  applied_offer_id: string | null
  expected_loyalty_points: number
  guest_name: string | null
  guest_email: string | null
  guest_phone: string | null
  is_group_booking: boolean
  organizer_id: string | null
  attendees: number
  turn_time_minutes: number
  applied_loyalty_rule_id: string | null
  
  // Relations
  user?: {
    id: string
    full_name: string
    phone_number: string | null
    email?: string
    avatar_url?: string
  } | null
  profiles?: {
    id: string
    full_name: string
    phone_number: string | null
    avatar_url?: string
  } | null
  restaurant?: {
    id: string
    name: string
    address: string
    main_image_url: string | null
  }
  tables?: RestaurantTable[]
  booking_tables?: {
    table: RestaurantTable
  }[]
}

export interface MenuItem {
  id: string
  restaurant_id: string
  category_id: string
  name: string
  description: string | null
  price: number
  image_url: string | null
  dietary_tags: string[] | null
  allergens: string[] | null
  calories: number | null
  preparation_time: number | null
  is_available: boolean
  is_featured: boolean
  display_order: number
  created_at: string
  updated_at: string
  
  // Relations
  category?: MenuCategory
}

export interface MenuCategory {
  id: string
  restaurant_id: string
  name: string
  description: string | null
  display_order: number
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface FloorPlan {
  id: string
  restaurant_id: string
  name: string
  svg_layout: string | null
  width: number
  height: number
  is_default: boolean
  created_at: string
  updated_at: string
  tables?: RestaurantTable[]
}
export interface Restaurant {
  id: string
  name: string
  address: string
  phone_number: string | null
  email: string | null
  website: string | null
  main_image_url: string | null
  description: string | null
  cuisine_type: string[] | null
  opening_hours: {
    day: number // 0 = Sunday, 6 = Saturday
    open_time: string // HH:mm format
    close_time: string // HH:mm format
  }[]
  created_at: string
  updated_at: string
}
export interface RestaurantTableCombination {
  id: string
  primary_table_id: string
  secondary_table_id: string
  combined_capacity: number
  created_at: string
  updated_at: string
  
  // Relations
  primary_table?: RestaurantTable
  secondary_table?: RestaurantTable
}
export interface RestaurantTableCombinationWithTables {
  id: string
  primary_table: RestaurantTable
  secondary_table: RestaurantTable
  combined_capacity: number
  created_at: string
  updated_at: string
}
