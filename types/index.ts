// types/index.ts
export interface Restaurant {
    id: string;
    name: string;
    description: string;
    address: string;
    location: {
      type: "Point";
      coordinates: [number, number];
    };
    main_image_url: string;
    image_urls?: string[];
    cuisine_type: string;
    tags?: string[];
    opening_time: string;
    closing_time: string;
    booking_policy: "instant" | "request";
    price_range: number;
    average_rating: number;
    total_reviews: number;
    phone_number?: string;
    whatsapp_number?: string;
    instagram_handle?: string;
    website_url?: string;
    menu_url?: string;
    dietary_options?: string[];
    ambiance_tags?: string[];
    parking_available: boolean;
    valet_parking: boolean;
    outdoor_seating: boolean;
    shisha_available: boolean;
    live_music_schedule?: Record<string, boolean>;
    happy_hour_times?: { start: string; end: string };
    booking_window_days: number;
    cancellation_window_hours: number;
    table_turnover_minutes: number;
    featured: boolean;
    created_at: string;
    updated_at: string;
  }
  
  export interface RestaurantTable {
    id: string;
    restaurant_id: string;
    table_number: string;
    table_type: "booth" | "window" | "patio" | "standard" | "bar" | "private";
    capacity: number;
    x_position: number;
    y_position: number;
    shape: "rectangle" | "circle" | "square";
    width: number;
    height: number;
    is_active: boolean;
    features?: string[];
    min_capacity: number;
    max_capacity: number;
    is_combinable: boolean;
    combinable_with?: string[];
    priority_score: number;
    created_at: string;
  }
  
  export interface Booking {
    id: string;
    user_id: string;
    restaurant_id: string;
    booking_time: string;
    party_size: number;
    status: "pending" | "confirmed" | "cancelled_by_user" | "declined_by_restaurant" | "completed" | "no_show";
    special_requests?: string;
    occasion?: string;
    dietary_notes?: string[];
    confirmation_code: string;
    table_preferences?: string[];
    reminder_sent: boolean;
    checked_in_at?: string;
    loyalty_points_earned: number;
    created_at: string;
    updated_at: string;
    applied_offer_id?: string;
    expected_loyalty_points: number;
    guest_name?: string;
    guest_email?: string;
    guest_phone?: string;
    is_group_booking: boolean;
    organizer_id?: string;
    attendees: number;
    turn_time_minutes: number;
    applied_loyalty_rule_id?: string;
    // Relations
    user?: Profile;
    restaurant?: Restaurant;
    tables?: RestaurantTable[];
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
    id: string;
    restaurant_id: string;
    category_id: string;
    name: string;
    description?: string;
    price: number;
    image_url?: string;
    dietary_tags?: string[];
    allergens?: string[];
    calories?: number;
    preparation_time?: number;
    is_available: boolean;
    is_featured: boolean;
    display_order: number;
    created_at: string;
    updated_at: string;
    // Relations
    category?: MenuCategory;
  }
  
  export interface MenuCategory {
    id: string;
    restaurant_id: string;
    name: string;
    description?: string;
    display_order: number;
    is_active: boolean;
    created_at: string;
    updated_at: string;
    // Relations
    items?: MenuItem[];
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
  }
  
  export interface FloorPlan {
    id: string;
    restaurant_id: string;
    name: string;
    svg_layout?: string;
    width: number;
    height: number;
    is_default: boolean;
    created_at: string;
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