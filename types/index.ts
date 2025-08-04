// types/index.ts
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
  // Legacy fields for backward compatibility
  location?: {
    type: "Point";
    coordinates: [number, number];
  };
  image_urls?: string[];
  tags?: string[];
  opening_time?: string;
  closing_time?: string;
  booking_policy?: "instant" | "request";
  price_range?: number;
  average_rating?: number;
  total_reviews?: number;
  whatsapp_number?: string;
  instagram_handle?: string;
  website_url?: string;
  menu_url?: string;
  dietary_options?: string[];
  ambiance_tags?: string[];
  parking_available?: boolean;
  valet_parking?: boolean;
  outdoor_seating?: boolean;
  shisha_available?: boolean;
  live_music_schedule?: Record<string, boolean>;
  happy_hour_times?: { start: string; end: string };
  booking_window_days?: number;
  cancellation_window_hours?: number;
  table_turnover_minutes?: number;
  featured?: boolean;
}
  
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
  
  export interface Profile {
    email: any;
    id: string;
    full_name: string;
    phone_number?: string;
    avatar_url?: string;
    allergies?: string[];
    favorite_cuisines?: string[];
    dietary_restrictions?: string[];
    preferred_party_size: number;
    notification_preferences: {
      email: boolean;
      push: boolean;
      sms: boolean;
    };
    loyalty_points: number;
    membership_tier: "bronze" | "silver" | "gold" | "platinum";
    created_at: string;
    updated_at: string;
    privacy_settings: {
      profile_visibility: string;
      activity_sharing: boolean;
      location_sharing: boolean;
      friend_requests_allowed: boolean;
    };
    user_rating: number;
    total_bookings: number;
    completed_bookings: number;
    cancelled_bookings: number;
    no_show_bookings: number;
    rating_last_updated: string;
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
    // Relations
    items?: MenuItem[]
  }
  
  export interface SpecialOffer {
    id: string;
    restaurant_id: string;
    title: string;
    description?: string;
    discount_percentage: number;
    valid_from: string;
    valid_until: string;
    terms_conditions?: string[];
    minimum_party_size: number;
    applicable_days?: number[];
    created_at: string;
    img_url?: string;
  }
  
  export interface RestaurantVIPUser {
    id: string;
    restaurant_id: string;
    user_id: string;
    extended_booking_days: number;
    priority_booking: boolean;
    valid_until: string;
    created_at: string;
    // Relations
    user?: Profile;
  }
  
  export interface RestaurantLoyaltyRule {
    id: string;
    restaurant_id: string;
    rule_name: string;
    points_to_award: number;
    is_active: boolean;
    valid_from: string;
    valid_until?: string;
    applicable_days: number[];
    start_time_minutes?: number;
    end_time_minutes?: number;
    minimum_party_size: number;
    maximum_party_size?: number;
    max_uses_total?: number;
    current_uses: number;
    max_uses_per_user?: number;
    priority: number;
    created_at: string;
    updated_at: string;
  }
  
  export interface Review {
    id: string;
    booking_id: string;
    user_id: string;
    restaurant_id: string;
    rating: number;
    comment?: string;
    images?: string[];
    is_verified: boolean;
    helpful_count: number;
    created_at: string;
    updated_at: string;
    // Relations
    user?: Profile;
    booking?: Booking;
    reply?: ReviewReply;
  }

  export interface ReviewReply {
    id: string;
    review_id: string;
    restaurant_id: string;
    replied_by: string;
    reply_message: string;
    created_at: string;
    updated_at: string;
    // Relations
    staff_member?: Profile;
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
  
  export interface RestaurantStaff {
    id: string;
    restaurant_id: string;
    user_id: string;
    role: "owner" | "manager" | "staff";
    permissions: string[];
    is_active: boolean;
    created_at: string;
    // Relations
    user?: Profile;
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

  // Restaurant Availability Types
  export interface RestaurantHours {
    id: string
    restaurant_id: string
    day_of_week: 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday'
    is_open: boolean
    open_time: string | null
    close_time: string | null
    created_at: string
    updated_at: string
  }

  export interface RestaurantSpecialHours {
    id: string
    restaurant_id: string
    date: string
    is_closed: boolean
    open_time: string | null
    close_time: string | null
    reason: string | null
    created_at: string
    created_by: string
    // Relations
    created_by_user?: Profile
  }

  export interface RestaurantClosure {
    id: string
    restaurant_id: string
    start_date: string
    end_date: string
    reason: string
    created_at: string
    created_by: string
    // Relations
    created_by_user?: Profile
  }