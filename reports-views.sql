-- ============================================
-- COMPREHENSIVE REPORTS VIEWS FOR ADMIN
-- ============================================
-- These views pre-compute analytics for fast reporting
-- Restaurant ID: 48176058-02a7-40f4-a6da-4b7cc50dfb59 is excluded from all views

-- Drop existing views if they exist (to avoid column rename conflicts)
DROP VIEW IF EXISTS vw_user_summary_stats CASCADE;
DROP VIEW IF EXISTS vw_most_booked_users CASCADE;
DROP VIEW IF EXISTS vw_user_activity_by_date CASCADE;
DROP VIEW IF EXISTS vw_recurring_users CASCADE;
DROP VIEW IF EXISTS vw_booking_summary_stats CASCADE;
DROP VIEW IF EXISTS vw_bookings_by_status CASCADE;
DROP VIEW IF EXISTS vw_bookings_by_date CASCADE;
DROP VIEW IF EXISTS vw_bookings_by_hour CASCADE;
DROP VIEW IF EXISTS vw_booking_funnel CASCADE;
DROP VIEW IF EXISTS vw_avg_waiting_time CASCADE;
DROP VIEW IF EXISTS vw_restaurant_revenue_estimate CASCADE;
DROP VIEW IF EXISTS vw_platform_revenue CASCADE;
DROP VIEW IF EXISTS vw_platform_revenue_summary CASCADE;
DROP VIEW IF EXISTS vw_customer_demographics CASCADE;
DROP VIEW IF EXISTS vw_customer_lifetime_value CASCADE;
DROP VIEW IF EXISTS vw_booking_rates CASCADE;
DROP VIEW IF EXISTS vw_restaurant_performance CASCADE;
DROP VIEW IF EXISTS vw_restaurant_growth_trend CASCADE;
DROP VIEW IF EXISTS vw_top_restaurants CASCADE;
DROP VIEW IF EXISTS vw_daily_snapshot CASCADE;
DROP VIEW IF EXISTS vw_booking_export CASCADE;
DROP VIEW IF EXISTS vw_user_export CASCADE;

-- ============================================
-- USER ANALYTICS VIEWS
-- ============================================

-- Helper function to get last_sign_in_at from auth.users
CREATE OR REPLACE FUNCTION get_user_last_sign_in(user_id uuid)
RETURNS timestamp with time zone
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN (SELECT last_sign_in_at FROM auth.users WHERE id = user_id);
END;
$$;

-- View: User Summary Stats
CREATE OR REPLACE VIEW vw_user_summary_stats AS
SELECT 
  COUNT(DISTINCT p.id) as total_users,
  COUNT(DISTINCT CASE WHEN p.created_at >= NOW() - INTERVAL '7 days' THEN p.id END) as new_users_7d,
  COUNT(DISTINCT CASE WHEN p.created_at >= CURRENT_DATE THEN p.id END) as new_users_today,
  COUNT(DISTINCT CASE WHEN p.created_at >= CURRENT_DATE - INTERVAL '1 day' AND p.created_at < CURRENT_DATE THEN p.id END) as new_users_yesterday,
  -- Active users: signed in within daily/weekly/monthly
  COUNT(DISTINCT CASE WHEN get_user_last_sign_in(p.id) >= CURRENT_DATE THEN p.id END) as active_users_daily,
  COUNT(DISTINCT CASE WHEN get_user_last_sign_in(p.id) >= NOW() - INTERVAL '7 days' THEN p.id END) as active_users_weekly,
  COUNT(DISTINCT CASE WHEN get_user_last_sign_in(p.id) >= NOW() - INTERVAL '30 days' THEN p.id END) as active_users_monthly,
  COUNT(DISTINCT b.user_id) as users_with_bookings
FROM profiles p
LEFT JOIN bookings b ON p.id = b.user_id AND (b.restaurant_id != '48176058-02a7-40f4-a6da-4b7cc50dfb59'::uuid OR b.restaurant_id IS NULL);

-- View: Most Booked Users
CREATE OR REPLACE VIEW vw_most_booked_users AS
SELECT 
  p.id,
  p.full_name,
  p.email,
  p.phone_number,
  COUNT(b.id) as total_bookings,
  SUM(b.party_size) as total_covers,
  MAX(b.created_at) as last_booking_date,
  AVG(CASE WHEN b.status IN ('completed', 'seated', 'ordered', 'appetizers', 'main_course', 'dessert', 'payment') THEN b.party_size END) as avg_party_size,
  COUNT(CASE WHEN b.status IN ('completed', 'seated', 'ordered', 'appetizers', 'main_course', 'dessert', 'payment') THEN 1 END) as completed_bookings
FROM profiles p
JOIN bookings b ON p.id = b.user_id
WHERE b.restaurant_id != '48176058-02a7-40f4-a6da-4b7cc50dfb59'::uuid
GROUP BY p.id, p.full_name, p.email, p.phone_number
HAVING COUNT(b.id) > 0
ORDER BY total_bookings DESC
LIMIT 100;

-- View: User Activity by Date Range
CREATE OR REPLACE VIEW vw_user_activity_by_date AS
SELECT 
  DATE(p.created_at) as signup_date,
  COUNT(DISTINCT p.id) as new_signups,
  COUNT(DISTINCT b.user_id) as active_bookers,
  COUNT(b.id) as total_bookings_made
FROM profiles p
LEFT JOIN bookings b ON p.id = b.user_id
  AND b.restaurant_id != '48176058-02a7-40f4-a6da-4b7cc50dfb59'::uuid
GROUP BY DATE(p.created_at)
ORDER BY signup_date DESC;

-- View: Recurring Users (2+ COMPLETED bookings in past 20 days)
CREATE OR REPLACE VIEW vw_recurring_users AS
SELECT 
  p.id as user_id,
  p.full_name,
  p.email,
  COUNT(b.id) as bookings_past_20d,
  SUM(b.party_size) as covers_past_20d,
  MAX(b.created_at) as last_booking
FROM profiles p
JOIN bookings b ON p.id = b.user_id
WHERE b.restaurant_id != '48176058-02a7-40f4-a6da-4b7cc50dfb59'::uuid
  AND b.created_at >= NOW() - INTERVAL '20 days'
  AND b.status = 'completed'
GROUP BY p.id, p.full_name, p.email
HAVING COUNT(b.id) >= 2
ORDER BY bookings_past_20d DESC;

-- ============================================
-- BOOKING ANALYTICS VIEWS
-- ============================================

-- View: Booking Summary Stats
CREATE OR REPLACE VIEW vw_booking_summary_stats AS
SELECT 
  COUNT(b.id) as total_bookings,
  COUNT(CASE WHEN b.created_at >= NOW() - INTERVAL '7 days' THEN b.id END) as bookings_7d,
  COUNT(CASE WHEN b.created_at >= CURRENT_DATE THEN b.id END) as bookings_today,
  COUNT(CASE WHEN b.status = 'completed' THEN b.id END) as completed_bookings,
  COUNT(CASE WHEN b.status = 'cancelled_by_user' OR b.status = 'cancelled_by_restaurant' THEN b.id END) as cancelled_bookings,
  COUNT(CASE WHEN b.status = 'no_show' THEN b.id END) as no_show_bookings,
  SUM(b.party_size) as total_covers,
  AVG(b.party_size) as avg_party_size,
  SUM(CASE WHEN b.status IN ('completed', 'seated', 'ordered', 'appetizers', 'main_course', 'dessert', 'payment') THEN b.party_size ELSE 0 END) as completed_covers
FROM bookings b
WHERE b.restaurant_id != '48176058-02a7-40f4-a6da-4b7cc50dfb59'::uuid;

-- View: Bookings by Status
CREATE OR REPLACE VIEW vw_bookings_by_status AS
SELECT 
  b.status,
  COUNT(*) as count,
  SUM(b.party_size) as total_covers,
  ROUND(AVG(b.party_size), 2) as avg_party_size
FROM bookings b
WHERE b.restaurant_id != '48176058-02a7-40f4-a6da-4b7cc50dfb59'::uuid
GROUP BY b.status
ORDER BY count DESC;

-- View: Bookings by Date
CREATE OR REPLACE VIEW vw_bookings_by_date AS
SELECT 
  DATE(b.booking_time) as booking_date,
  COUNT(*) as bookings_count,
  COUNT(CASE WHEN b.status = 'confirmed' THEN 1 END) as confirmed_count,
  COUNT(CASE WHEN b.status IN ('completed', 'seated', 'ordered', 'appetizers', 'main_course', 'dessert', 'payment') THEN 1 END) as completed_count,
  COUNT(CASE WHEN b.status IN ('cancelled_by_user', 'cancelled_by_restaurant') THEN 1 END) as cancelled_count,
  COUNT(CASE WHEN b.status = 'no_show' THEN 1 END) as no_show_count,
  SUM(b.party_size) as total_covers,
  ROUND(AVG(b.party_size), 2) as avg_party_size
FROM bookings b
WHERE b.restaurant_id != '48176058-02a7-40f4-a6da-4b7cc50dfb59'::uuid
GROUP BY DATE(b.booking_time)
ORDER BY booking_date DESC;

-- View: Bookings by Hour (Peak Hours)
CREATE OR REPLACE VIEW vw_bookings_by_hour AS
SELECT 
  EXTRACT(HOUR FROM b.booking_time) as hour_of_day,
  COUNT(*) as booking_count,
  SUM(b.party_size) as total_covers,
  COUNT(DISTINCT DATE(b.booking_time)) as days_with_bookings
FROM bookings b
WHERE b.restaurant_id != '48176058-02a7-40f4-a6da-4b7cc50dfb59'::uuid
GROUP BY EXTRACT(HOUR FROM b.booking_time)
ORDER BY hour_of_day;

-- View: Booking Conversion Funnel
CREATE OR REPLACE VIEW vw_booking_funnel AS
WITH status_counts AS (
  SELECT 
    CASE 
      WHEN b.status IN ('pending') THEN 'Pending'
      WHEN b.status IN ('confirmed') THEN 'Confirmed'
      WHEN b.status IN ('seated', 'arrived') THEN 'Seated'
      WHEN b.status IN ('completed', 'seated', 'ordered', 'appetizers', 'main_course', 'dessert', 'payment') THEN 'Completed'
      WHEN b.status IN ('cancelled_by_user', 'cancelled_by_restaurant') THEN 'Cancelled'
      WHEN b.status = 'no_show' THEN 'No Show'
      ELSE 'Other'
    END as stage,
    COUNT(*) as count,
    SUM(b.party_size) as covers
  FROM bookings b
  WHERE b.restaurant_id != '48176058-02a7-40f4-a6da-4b7cc50dfb59'::uuid
  GROUP BY stage
)
SELECT 
  stage,
  count,
  covers,
  ROUND((count::numeric / SUM(count) OVER ()) * 100, 2) as percentage
FROM status_counts
ORDER BY 
  CASE stage
    WHEN 'Pending' THEN 1
    WHEN 'Confirmed' THEN 2
    WHEN 'Seated' THEN 3
    WHEN 'Completed' THEN 4
    WHEN 'Cancelled' THEN 5
    WHEN 'No Show' THEN 6
    ELSE 7
  END;

-- View: Average Waiting Time (time from pending to confirmed/declined)
-- Only count bookings that received a response (not pending, auto-declined, or no-show)
CREATE OR REPLACE VIEW vw_avg_waiting_time AS
SELECT 
  AVG(EXTRACT(EPOCH FROM (b.updated_at - b.created_at))/60)::integer as avg_response_time_minutes,
  AVG(EXTRACT(EPOCH FROM (b.updated_at - b.created_at))/3600)::numeric(10,2) as avg_response_time_hours,
  COUNT(*) as bookings_count,
  COUNT(CASE WHEN b.status = 'confirmed' THEN 1 END) as confirmed_count,
  COUNT(CASE WHEN b.status IN ('cancelled_by_restaurant', 'declined_by_restaurant') THEN 1 END) as declined_count,
  MIN(EXTRACT(EPOCH FROM (b.updated_at - b.created_at))/60)::integer as min_response_minutes,
  MAX(EXTRACT(EPOCH FROM (b.updated_at - b.created_at))/60)::integer as max_response_minutes
FROM bookings b
WHERE b.restaurant_id != '48176058-02a7-40f4-a6da-4b7cc50dfb59'::uuid
  AND b.status IN ('confirmed', 'declined_by_restaurant', 'cancelled_by_restaurant')
  AND b.created_at IS NOT NULL
  AND b.updated_at IS NOT NULL
  AND b.created_at != b.updated_at
  AND EXTRACT(EPOCH FROM (b.updated_at - b.created_at))/60 < 1440; -- Filter out responses longer than 24 hours

-- ============================================
-- REVENUE METRICS VIEWS
-- ============================================

-- View: Restaurant Revenue Estimation
-- Revenue = price_range * party_size (direct calculation)
-- price_range: 1=$20, 2=$40, 3=$60, 4=$100
CREATE OR REPLACE VIEW vw_restaurant_revenue_estimate AS
SELECT 
  r.id as restaurant_id,
  r.name as restaurant_name,
  r.tier,
  r.price_range,
  COUNT(b.id) as completed_bookings,
  SUM(b.party_size) as completed_covers,
  -- Calculate estimated revenue: price_range directly * party_size
  SUM((r.price_range * 20) * b.party_size) as estimated_revenue_usd,
  AVG((r.price_range * 20) * b.party_size) as avg_revenue_per_booking
FROM bookings b
JOIN restaurants r ON b.restaurant_id = r.id
WHERE b.restaurant_id != '48176058-02a7-40f4-a6da-4b7cc50dfb59'::uuid
  AND b.status IN ('completed', 'seated', 'ordered', 'appetizers', 'main_course', 'dessert', 'payment')
  AND r.price_range IS NOT NULL
GROUP BY r.id, r.name, r.tier, r.price_range
ORDER BY estimated_revenue_usd DESC;

-- View: Platform Revenue (Plate Fees)
CREATE OR REPLACE VIEW vw_platform_revenue AS
WITH completed_covers AS (
  SELECT 
    r.tier,
    COUNT(b.id) as completed_bookings,
    SUM(b.party_size) as completed_covers
  FROM bookings b
  JOIN restaurants r ON b.restaurant_id = r.id
  WHERE b.restaurant_id != '48176058-02a7-40f4-a6da-4b7cc50dfb59'::uuid
    AND b.status IN ('completed', 'seated', 'ordered', 'appetizers', 'main_course', 'dessert', 'payment')
  GROUP BY r.tier
)
SELECT 
  tier,
  completed_bookings,
  completed_covers,
  CASE 
    WHEN tier = 'basic' THEN 50 + (completed_covers * 1.0)
    WHEN tier = 'pro' THEN 150 + (completed_covers * 0.5)
    ELSE 0
  END as monthly_revenue_usd
FROM completed_covers;

-- View: Total Platform Revenue Summary
-- Plate Revenue = (Basic Restaurants × $50) + (Pro Restaurants × $150) + (Total Covers × per-cover fee)
-- Per-cover fees: Basic = $1/cover, Pro = $0.5/cover
CREATE OR REPLACE VIEW vw_platform_revenue_summary AS
WITH restaurant_counts AS (
  SELECT 
    COUNT(DISTINCT CASE WHEN r.tier = 'basic' THEN r.id END) as basic_restaurants,
    COUNT(DISTINCT CASE WHEN r.tier = 'pro' THEN r.id END) as pro_restaurants
  FROM restaurants r
  WHERE r.id != '48176058-02a7-40f4-a6da-4b7cc50dfb59'::uuid
),
cover_breakdown AS (
  SELECT 
    COUNT(b.id) as total_completed_bookings,
    SUM(b.party_size) as total_completed_covers,
    SUM(CASE WHEN r.tier = 'basic' THEN b.party_size ELSE 0 END) as basic_covers,
    SUM(CASE WHEN r.tier = 'pro' THEN b.party_size ELSE 0 END) as pro_covers
  FROM bookings b
  JOIN restaurants r ON b.restaurant_id = r.id
  WHERE b.restaurant_id != '48176058-02a7-40f4-a6da-4b7cc50dfb59'::uuid
    AND b.status IN ('completed', 'seated', 'ordered', 'appetizers', 'main_course', 'dessert', 'payment')
)
SELECT 
  rc.basic_restaurants,
  rc.pro_restaurants,
  cb.total_completed_bookings,
  cb.total_completed_covers,
  cb.basic_covers,
  cb.pro_covers,
  -- Calculate Plate revenue: subscriptions + per-cover fees
  (rc.basic_restaurants * 50) + (rc.pro_restaurants * 150) + (cb.basic_covers * 1.0) + (cb.pro_covers * 0.5) as total_estimated_revenue_usd
FROM restaurant_counts rc, cover_breakdown cb;

-- ============================================
-- CUSTOMER INSIGHTS VIEWS
-- ============================================

-- View: Customer Demographics
CREATE OR REPLACE VIEW vw_customer_demographics AS
SELECT 
  COUNT(*) as total_customers,
  ROUND(AVG(EXTRACT(YEAR FROM AGE(CURRENT_DATE, p.date_of_birth))), 1) as avg_age,
  COUNT(CASE WHEN p.date_of_birth IS NOT NULL THEN 1 END) as customers_with_age_data,
  COUNT(DISTINCT b.user_id) as customers_with_bookings,
  ROUND(AVG(b.party_size), 2) as avg_party_size_per_booking
FROM profiles p
LEFT JOIN bookings b ON p.id = b.user_id
  AND b.restaurant_id != '48176058-02a7-40f4-a6da-4b7cc50dfb59'::uuid;

-- View: Customer Lifetime Value Estimate
CREATE OR REPLACE VIEW vw_customer_lifetime_value AS
SELECT 
  p.id as customer_id,
  p.full_name,
  p.email,
  COUNT(b.id) as total_bookings,
  SUM(b.party_size) as total_covers,
  MAX(b.created_at) as last_booking,
  MIN(b.created_at) as first_booking,
  COUNT(CASE WHEN b.status IN ('completed', 'seated', 'ordered', 'appetizers', 'main_course', 'dessert', 'payment') THEN 1 END) as completed_bookings,
  ROUND(AVG(b.party_size), 2) as avg_party_size,
  -- Estimate lifetime value (very rough - would need actual order data)
  SUM(b.party_size * 50) as estimated_lifetime_value
FROM profiles p
JOIN bookings b ON p.id = b.user_id
WHERE b.restaurant_id != '48176058-02a7-40f4-a6da-4b7cc50dfb59'::uuid
GROUP BY p.id, p.full_name, p.email
HAVING COUNT(b.id) >= 1
ORDER BY total_bookings DESC;

-- View: Booking Rates (Completion, Cancellation, No Show)
CREATE OR REPLACE VIEW vw_booking_rates AS
SELECT 
  COUNT(*) as total_bookings,
  COUNT(CASE WHEN b.status IN ('completed', 'seated', 'ordered', 'appetizers', 'main_course', 'dessert', 'payment') THEN 1 END) as completed_bookings,
  COUNT(CASE WHEN b.status IN ('cancelled_by_user', 'cancelled_by_restaurant') THEN 1 END) as cancelled_bookings,
  COUNT(CASE WHEN b.status = 'no_show' THEN 1 END) as no_show_bookings,
  ROUND(COUNT(CASE WHEN b.status IN ('completed', 'seated', 'ordered', 'appetizers', 'main_course', 'dessert', 'payment') THEN 1 END)::numeric / COUNT(*) * 100, 2) as completion_rate_pct,
  ROUND(COUNT(CASE WHEN b.status IN ('cancelled_by_user', 'cancelled_by_restaurant') THEN 1 END)::numeric / COUNT(*) * 100, 2) as cancellation_rate_pct,
  ROUND(COUNT(CASE WHEN b.status = 'no_show' THEN 1 END)::numeric / COUNT(*) * 100, 2) as no_show_rate_pct
FROM bookings b
WHERE b.restaurant_id != '48176058-02a7-40f4-a6da-4b7cc50dfb59'::uuid;

-- ============================================
-- RESTAURANT-SPECIFIC ANALYTICS VIEWS
-- ============================================

-- View: Restaurant Performance Summary
CREATE OR REPLACE VIEW vw_restaurant_performance AS
SELECT 
  r.id,
  r.name,
  r.tier,
  r.price_range,
  COUNT(b.id) as total_bookings,
  COUNT(CASE WHEN b.status IN ('completed', 'seated', 'ordered', 'appetizers', 'main_course', 'dessert', 'payment') THEN b.id END) as completed_bookings,
  COUNT(CASE WHEN b.created_at >= NOW() - INTERVAL '30 days' THEN b.id END) as bookings_30d,
  COUNT(CASE WHEN b.created_at >= NOW() - INTERVAL '7 days' THEN b.id END) as bookings_7d,
  SUM(b.party_size) as total_covers,
  ROUND(AVG(b.party_size), 2) as avg_party_size,
  MAX(b.created_at) as last_booking_date
FROM restaurants r
LEFT JOIN bookings b ON r.id = b.restaurant_id
WHERE r.id != '48176058-02a7-40f4-a6da-4b7cc50dfb59'::uuid
GROUP BY r.id, r.name, r.tier, r.price_range
ORDER BY total_bookings DESC;

-- View: Restaurant Growth Trend
CREATE OR REPLACE VIEW vw_restaurant_growth_trend AS
SELECT 
  r.id as restaurant_id,
  r.name as restaurant_name,
  DATE(b.created_at) as booking_date,
  COUNT(*) as daily_bookings,
  SUM(b.party_size) as daily_covers,
  AVG(COUNT(*)) OVER (PARTITION BY r.id ORDER BY DATE(b.created_at) ROWS BETWEEN 6 PRECEDING AND CURRENT ROW) as rolling_7d_avg
FROM bookings b
JOIN restaurants r ON b.restaurant_id = r.id
WHERE b.restaurant_id != '48176058-02a7-40f4-a6da-4b7cc50dfb59'::uuid
GROUP BY r.id, r.name, DATE(b.created_at)
ORDER BY r.id, booking_date DESC;

-- View: Top Performing Restaurants
CREATE OR REPLACE VIEW vw_top_restaurants AS
SELECT 
  r.id,
  r.name,
  r.tier,
  r.cuisine_type,
  r.price_range,
  COUNT(b.id) as total_bookings,
  COUNT(CASE WHEN b.status IN ('completed', 'seated', 'ordered', 'appetizers', 'main_course', 'dessert', 'payment') THEN b.id END) as completed_bookings,
  SUM(b.party_size) as total_covers,
  SUM(CASE WHEN b.status IN ('completed', 'seated', 'ordered', 'appetizers', 'main_course', 'dessert', 'payment') THEN b.party_size ELSE 0 END) as completed_covers,
  ROUND(AVG(b.party_size), 2) as avg_party_size,
  COUNT(CASE WHEN b.created_at >= NOW() - INTERVAL '30 days' THEN b.id END) as bookings_last_30d,
  COUNT(CASE WHEN b.created_at >= NOW() - INTERVAL '7 days' THEN b.id END) as bookings_last_7d,
  -- Restaurant revenue from Plate (covers × average price based on price_range)
  SUM(CASE WHEN b.status IN ('completed', 'seated', 'ordered', 'appetizers', 'main_course', 'dessert', 'payment') 
            THEN (r.price_range * 20) * b.party_size ELSE 0 END) as restaurant_revenue_est,
  -- Growth rate calculation
  ROUND(
    ((COUNT(CASE WHEN b.created_at >= NOW() - INTERVAL '7 days' THEN b.id END)::numeric / 
      NULLIF(COUNT(CASE WHEN b.created_at >= NOW() - INTERVAL '14 days' AND b.created_at < NOW() - INTERVAL '7 days' THEN b.id END), 0) - 1) * 100), 
    2
  ) as week_over_week_growth_pct
FROM restaurants r
LEFT JOIN bookings b ON r.id = b.restaurant_id
WHERE r.id != '48176058-02a7-40f4-a6da-4b7cc50dfb59'::uuid
GROUP BY r.id, r.name, r.tier, r.cuisine_type, r.price_range
ORDER BY completed_bookings DESC
LIMIT 50;

-- ============================================
-- COMPREHENSIVE DAILY SNAPSHOT VIEW
-- ============================================

-- View: Daily Snapshot (Key Metrics)
CREATE OR REPLACE VIEW vw_daily_snapshot AS
SELECT 
  CURRENT_DATE as report_date,
  (SELECT COUNT(*) FROM profiles) as total_users,
  (SELECT COUNT(*) FROM profiles WHERE created_at >= CURRENT_DATE) as new_users_today,
  (SELECT COUNT(*) FROM profiles WHERE created_at >= NOW() - INTERVAL '7 days') as new_users_7d,
  (SELECT COUNT(*) FROM bookings WHERE restaurant_id != '48176058-02a7-40f4-a6da-4b7cc50dfb59'::uuid) as total_bookings,
  (SELECT COUNT(*) FROM bookings WHERE restaurant_id != '48176058-02a7-40f4-a6da-4b7cc50dfb59'::uuid AND created_at >= CURRENT_DATE) as bookings_today,
  (SELECT COUNT(*) FROM bookings WHERE restaurant_id != '48176058-02a7-40f4-a6da-4b7cc50dfb59'::uuid AND created_at >= NOW() - INTERVAL '7 days') as bookings_7d,
  (SELECT SUM(party_size) FROM bookings WHERE restaurant_id != '48176058-02a7-40f4-a6da-4b7cc50dfb59'::uuid) as total_covers,
  (SELECT COUNT(*) FROM restaurants WHERE id != '48176058-02a7-40f4-a6da-4b7cc50dfb59'::uuid) as total_restaurants;

-- ============================================
-- CUSTOM EXPORT VIEWS
-- ============================================

-- View: Comprehensive Booking Export
CREATE OR REPLACE VIEW vw_booking_export AS
SELECT 
  b.id as booking_id,
  b.restaurant_id,
  r.name as restaurant_name,
  r.tier as restaurant_tier,
  r.price_range,
  b.user_id,
  p.full_name as user_name,
  p.email as user_email,
  p.phone_number as user_phone,
  b.guest_name,
  b.guest_email,
  b.guest_phone,
  b.status,
  b.booking_time,
  b.party_size,
  b.confirmation_code,
  b.special_requests,
  b.occasion,
  b.table_preferences,
  b.checked_in_at,
  b.seated_at,
  b.created_at,
  b.updated_at
FROM bookings b
LEFT JOIN restaurants r ON b.restaurant_id = r.id
LEFT JOIN profiles p ON b.user_id = p.id
WHERE b.restaurant_id != '48176058-02a7-40f4-a6da-4b7cc50dfb59'::uuid;

-- View: User Export
CREATE OR REPLACE VIEW vw_user_export AS
SELECT 
  p.id as user_id,
  p.full_name,
  p.email,
  p.phone_number,
  p.date_of_birth,
  EXTRACT(YEAR FROM AGE(CURRENT_DATE, p.date_of_birth)) as age,
  p.created_at as signup_date,
  COUNT(b.id) as total_bookings,
  COUNT(CASE WHEN b.status IN ('completed', 'seated', 'ordered', 'appetizers', 'main_course', 'dessert', 'payment') THEN b.id END) as completed_bookings,
  SUM(CASE WHEN b.status IN ('completed', 'seated', 'ordered', 'appetizers', 'main_course', 'dessert', 'payment') THEN b.party_size ELSE 0 END) as total_covers,
  MAX(b.created_at) as last_booking_date
FROM profiles p
LEFT JOIN bookings b ON p.id = b.user_id AND b.restaurant_id != '48176058-02a7-40f4-a6da-4b7cc50dfb59'::uuid
GROUP BY p.id, p.full_name, p.email, p.phone_number, p.date_of_birth, p.created_at;

-- ============================================
-- END OF VIEWS
-- ============================================

