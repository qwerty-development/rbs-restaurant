-- Delete all data for test restaurant 48176058-02a7-40f4-a6da-4b7cc50dfb59
-- Run this in Supabase SQL Editor: https://supabase.com/dashboard/project/xsovqvbigdettnpeisjs/sql/new
--
-- IMPORTANT: This will permanently delete all data for this restaurant!
-- Make sure you have a backup if needed.

BEGIN;

-- Set the restaurant ID variable
DO $$
DECLARE
    target_restaurant_id UUID := '48176058-02a7-40f4-a6da-4b7cc50dfb59';
    deleted_count INTEGER;
BEGIN
    RAISE NOTICE 'Starting deletion for restaurant: %', target_restaurant_id;

    -- Level 1: Deep child tables (tables that depend on child tables of restaurant)

    -- Delete booking-related child tables
    DELETE FROM booking_invites WHERE booking_id IN (SELECT id FROM bookings WHERE restaurant_id = target_restaurant_id);
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RAISE NOTICE 'Deleted % records from booking_invites', deleted_count;

    DELETE FROM booking_status_history WHERE booking_id IN (SELECT id FROM bookings WHERE restaurant_id = target_restaurant_id);
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RAISE NOTICE 'Deleted % records from booking_status_history', deleted_count;

    DELETE FROM booking_tables WHERE booking_id IN (SELECT id FROM bookings WHERE restaurant_id = target_restaurant_id);
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RAISE NOTICE 'Deleted % records from booking_tables', deleted_count;

    DELETE FROM loyalty_activities WHERE related_booking_id IN (SELECT id FROM bookings WHERE restaurant_id = target_restaurant_id);
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RAISE NOTICE 'Deleted % records from loyalty_activities', deleted_count;

    DELETE FROM loyalty_redemptions WHERE booking_id IN (SELECT id FROM bookings WHERE restaurant_id = target_restaurant_id);
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RAISE NOTICE 'Deleted % records from loyalty_redemptions', deleted_count;

    DELETE FROM user_loyalty_rule_usage WHERE booking_id IN (SELECT id FROM bookings WHERE restaurant_id = target_restaurant_id);
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RAISE NOTICE 'Deleted % records from user_loyalty_rule_usage', deleted_count;

    -- Delete review-related tables
    DELETE FROM review_reports WHERE review_id IN (SELECT id FROM reviews WHERE restaurant_id = target_restaurant_id);
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RAISE NOTICE 'Deleted % records from review_reports', deleted_count;

    DELETE FROM review_replies WHERE restaurant_id = target_restaurant_id;
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RAISE NOTICE 'Deleted % records from review_replies', deleted_count;

    DELETE FROM reviews WHERE restaurant_id = target_restaurant_id;
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RAISE NOTICE 'Deleted % records from reviews', deleted_count;

    -- Delete customer-related child tables
    DELETE FROM customer_notes WHERE customer_id IN (SELECT id FROM restaurant_customers WHERE restaurant_id = target_restaurant_id);
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RAISE NOTICE 'Deleted % records from customer_notes', deleted_count;

    DELETE FROM customer_preferences WHERE customer_id IN (SELECT id FROM restaurant_customers WHERE restaurant_id = target_restaurant_id);
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RAISE NOTICE 'Deleted % records from customer_preferences', deleted_count;

    DELETE FROM customer_relationships WHERE customer_id IN (SELECT id FROM restaurant_customers WHERE restaurant_id = target_restaurant_id);
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RAISE NOTICE 'Deleted % records from customer_relationships', deleted_count;

    DELETE FROM customer_tag_assignments WHERE tag_id IN (SELECT id FROM customer_tags WHERE restaurant_id = target_restaurant_id);
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RAISE NOTICE 'Deleted % records from customer_tag_assignments', deleted_count;

    -- Delete order-related child tables
    DELETE FROM order_modifications WHERE order_item_id IN (
        SELECT id FROM order_items WHERE order_id IN (
            SELECT id FROM orders WHERE restaurant_id = target_restaurant_id
        )
    );
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RAISE NOTICE 'Deleted % records from order_modifications', deleted_count;

    DELETE FROM kitchen_assignments WHERE order_item_id IN (
        SELECT id FROM order_items WHERE order_id IN (
            SELECT id FROM orders WHERE restaurant_id = target_restaurant_id
        )
    );
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RAISE NOTICE 'Deleted % records from kitchen_assignments', deleted_count;

    DELETE FROM order_status_history WHERE order_id IN (SELECT id FROM orders WHERE restaurant_id = target_restaurant_id);
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RAISE NOTICE 'Deleted % records from order_status_history', deleted_count;

    DELETE FROM order_items WHERE order_id IN (SELECT id FROM orders WHERE restaurant_id = target_restaurant_id);
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RAISE NOTICE 'Deleted % records from order_items', deleted_count;

    DELETE FROM orders WHERE restaurant_id = target_restaurant_id;
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RAISE NOTICE 'Deleted % records from orders', deleted_count;

    -- Delete post-related child tables
    DELETE FROM post_comments WHERE post_id IN (SELECT id FROM posts WHERE restaurant_id = target_restaurant_id);
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RAISE NOTICE 'Deleted % records from post_comments', deleted_count;

    DELETE FROM post_images WHERE post_id IN (SELECT id FROM posts WHERE restaurant_id = target_restaurant_id);
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RAISE NOTICE 'Deleted % records from post_images', deleted_count;

    DELETE FROM post_likes WHERE post_id IN (SELECT id FROM posts WHERE restaurant_id = target_restaurant_id);
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RAISE NOTICE 'Deleted % records from post_likes', deleted_count;

    DELETE FROM post_tags WHERE post_id IN (SELECT id FROM posts WHERE restaurant_id = target_restaurant_id);
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RAISE NOTICE 'Deleted % records from post_tags', deleted_count;

    DELETE FROM posts WHERE restaurant_id = target_restaurant_id;
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RAISE NOTICE 'Deleted % records from posts', deleted_count;

    -- Delete staff-related child tables
    DELETE FROM staff_position_assignments WHERE staff_id IN (SELECT id FROM restaurant_staff WHERE restaurant_id = target_restaurant_id);
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RAISE NOTICE 'Deleted % records from staff_position_assignments', deleted_count;

    DELETE FROM staff_availability WHERE restaurant_id = target_restaurant_id;
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RAISE NOTICE 'Deleted % records from staff_availability', deleted_count;

    DELETE FROM staff_shifts WHERE restaurant_id = target_restaurant_id;
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RAISE NOTICE 'Deleted % records from staff_shifts', deleted_count;

    DELETE FROM staff_schedules WHERE restaurant_id = target_restaurant_id;
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RAISE NOTICE 'Deleted % records from staff_schedules', deleted_count;

    DELETE FROM time_clock_entries WHERE restaurant_id = target_restaurant_id;
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RAISE NOTICE 'Deleted % records from time_clock_entries', deleted_count;

    DELETE FROM time_off_requests WHERE restaurant_id = target_restaurant_id;
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RAISE NOTICE 'Deleted % records from time_off_requests', deleted_count;

    DELETE FROM staff_positions WHERE restaurant_id = target_restaurant_id;
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RAISE NOTICE 'Deleted % records from staff_positions', deleted_count;

    -- Delete special offer related
    DELETE FROM user_offers WHERE offer_id IN (SELECT id FROM special_offers WHERE restaurant_id = target_restaurant_id);
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RAISE NOTICE 'Deleted % records from user_offers', deleted_count;

    DELETE FROM special_offers WHERE restaurant_id = target_restaurant_id;
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RAISE NOTICE 'Deleted % records from special_offers', deleted_count;

    -- Delete loyalty rule related
    DELETE FROM user_loyalty_rule_usage WHERE rule_id IN (SELECT id FROM restaurant_loyalty_rules WHERE restaurant_id = target_restaurant_id);
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RAISE NOTICE 'Deleted % records from user_loyalty_rule_usage (via rules)', deleted_count;

    DELETE FROM restaurant_loyalty_rules WHERE restaurant_id = target_restaurant_id;
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RAISE NOTICE 'Deleted % records from restaurant_loyalty_rules', deleted_count;

    -- Level 2: Direct children of restaurant

    DELETE FROM bookings WHERE restaurant_id = target_restaurant_id;
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RAISE NOTICE 'Deleted % records from bookings', deleted_count;

    DELETE FROM customer_tags WHERE restaurant_id = target_restaurant_id;
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RAISE NOTICE 'Deleted % records from customer_tags', deleted_count;

    DELETE FROM customer_tag_assignments WHERE customer_id IN (SELECT id FROM restaurant_customers WHERE restaurant_id = target_restaurant_id);
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RAISE NOTICE 'Deleted % records from customer_tag_assignments (via customers)', deleted_count;

    DELETE FROM restaurant_customers WHERE restaurant_id = target_restaurant_id;
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RAISE NOTICE 'Deleted % records from restaurant_customers', deleted_count;

    DELETE FROM favorites WHERE restaurant_id = target_restaurant_id;
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RAISE NOTICE 'Deleted % records from favorites', deleted_count;

    DELETE FROM floor_plans WHERE restaurant_id = target_restaurant_id;
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RAISE NOTICE 'Deleted % records from floor_plans', deleted_count;

    DELETE FROM kitchen_display_settings WHERE restaurant_id = target_restaurant_id;
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RAISE NOTICE 'Deleted % records from kitchen_display_settings', deleted_count;

    DELETE FROM kitchen_stations WHERE restaurant_id = target_restaurant_id;
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RAISE NOTICE 'Deleted % records from kitchen_stations', deleted_count;

    DELETE FROM loyalty_rewards WHERE restaurant_id = target_restaurant_id;
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RAISE NOTICE 'Deleted % records from loyalty_rewards', deleted_count;

    DELETE FROM menu_items WHERE restaurant_id = target_restaurant_id;
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RAISE NOTICE 'Deleted % records from menu_items', deleted_count;

    DELETE FROM menu_categories WHERE restaurant_id = target_restaurant_id;
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RAISE NOTICE 'Deleted % records from menu_categories', deleted_count;

    DELETE FROM notification_history WHERE restaurant_id = target_restaurant_id;
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RAISE NOTICE 'Deleted % records from notification_history', deleted_count;

    DELETE FROM playlist_items WHERE restaurant_id = target_restaurant_id;
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RAISE NOTICE 'Deleted % records from playlist_items', deleted_count;

    DELETE FROM push_subscriptions WHERE restaurant_id = target_restaurant_id;
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RAISE NOTICE 'Deleted % records from push_subscriptions', deleted_count;

    DELETE FROM restaurant_availability WHERE restaurant_id = target_restaurant_id;
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RAISE NOTICE 'Deleted % records from restaurant_availability', deleted_count;

    DELETE FROM restaurant_closures WHERE restaurant_id = target_restaurant_id;
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RAISE NOTICE 'Deleted % records from restaurant_closures', deleted_count;

    DELETE FROM restaurant_hours WHERE restaurant_id = target_restaurant_id;
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RAISE NOTICE 'Deleted % records from restaurant_hours', deleted_count;

    DELETE FROM restaurant_loyalty_balance WHERE restaurant_id = target_restaurant_id;
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RAISE NOTICE 'Deleted % records from restaurant_loyalty_balance', deleted_count;

    DELETE FROM restaurant_loyalty_transactions WHERE restaurant_id = target_restaurant_id;
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RAISE NOTICE 'Deleted % records from restaurant_loyalty_transactions', deleted_count;

    DELETE FROM restaurant_notification_preferences WHERE restaurant_id = target_restaurant_id;
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RAISE NOTICE 'Deleted % records from restaurant_notification_preferences', deleted_count;

    DELETE FROM restaurant_open_hours WHERE restaurant_id = target_restaurant_id;
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RAISE NOTICE 'Deleted % records from restaurant_open_hours', deleted_count;

    DELETE FROM restaurant_rating_requirements WHERE restaurant_id = target_restaurant_id;
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RAISE NOTICE 'Deleted % records from restaurant_rating_requirements', deleted_count;

    DELETE FROM restaurant_sections WHERE restaurant_id = target_restaurant_id;
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RAISE NOTICE 'Deleted % records from restaurant_sections', deleted_count;

    DELETE FROM restaurant_special_hours WHERE restaurant_id = target_restaurant_id;
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RAISE NOTICE 'Deleted % records from restaurant_special_hours', deleted_count;

    DELETE FROM restaurant_tables WHERE restaurant_id = target_restaurant_id;
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RAISE NOTICE 'Deleted % records from restaurant_tables', deleted_count;

    DELETE FROM restaurant_turn_times WHERE restaurant_id = target_restaurant_id;
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RAISE NOTICE 'Deleted % records from restaurant_turn_times', deleted_count;

    DELETE FROM restaurant_vip_users WHERE restaurant_id = target_restaurant_id;
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RAISE NOTICE 'Deleted % records from restaurant_vip_users', deleted_count;

    DELETE FROM restaurant_waitlist_schedules WHERE restaurant_id = target_restaurant_id;
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RAISE NOTICE 'Deleted % records from restaurant_waitlist_schedules', deleted_count;

    DELETE FROM security_audit_log WHERE restaurant_id = target_restaurant_id;
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RAISE NOTICE 'Deleted % records from security_audit_log', deleted_count;

    DELETE FROM table_combinations WHERE restaurant_id = target_restaurant_id;
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RAISE NOTICE 'Deleted % records from table_combinations', deleted_count;

    DELETE FROM user_restaurant_blacklist WHERE restaurant_id = target_restaurant_id;
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RAISE NOTICE 'Deleted % records from user_restaurant_blacklist', deleted_count;

    DELETE FROM waitlist WHERE restaurant_id = target_restaurant_id;
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RAISE NOTICE 'Deleted % records from waitlist', deleted_count;

    -- Delete restaurant staff LAST (as it may be referenced by other tables)
    DELETE FROM restaurant_staff WHERE restaurant_id = target_restaurant_id;
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RAISE NOTICE 'Deleted % records from restaurant_staff', deleted_count;

    RAISE NOTICE 'All data for restaurant % has been deleted successfully!', target_restaurant_id;
END $$;

-- If everything looks good, commit the transaction
COMMIT;

-- To rollback instead, uncomment the line below and comment out COMMIT above
-- ROLLBACK;
