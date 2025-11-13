#!/usr/bin/env node
/**
 * Script to delete all data for test restaurant
 * Restaurant ID: 48176058-02a7-40f4-a6da-4b7cc50dfb59
 *
 * This script deletes data in the correct order respecting foreign key constraints
 */

import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

// Load environment variables
dotenv.config({ path: '.env.local' })

const RESTAURANT_ID = '48176058-02a7-40f4-a6da-4b7cc50dfb59'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing required environment variables')
  console.error('Please ensure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set in .env.local')
  process.exit(1)
}

// Initialize Supabase client with service role for admin operations
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

interface TableCount {
  table_name: string
  count: number
}

async function checkRestaurantData(): Promise<TableCount[]> {
  console.log(`\n🔍 Checking data for restaurant ${RESTAURANT_ID}...\n`)

  const tables = [
    'bookings',
    'customer_tags',
    'favorites',
    'floor_plans',
    'kitchen_display_settings',
    'kitchen_stations',
    'loyalty_rewards',
    'menu_categories',
    'menu_items',
    'notification_history',
    'orders',
    'playlist_items',
    'posts',
    'push_subscriptions',
    'restaurant_availability',
    'restaurant_closures',
    'restaurant_customers',
    'restaurant_hours',
    'restaurant_loyalty_balance',
    'restaurant_loyalty_rules',
    'restaurant_loyalty_transactions',
    'restaurant_notification_preferences',
    'restaurant_open_hours',
    'restaurant_rating_requirements',
    'restaurant_sections',
    'restaurant_special_hours',
    'restaurant_staff',
    'restaurant_tables',
    'restaurant_turn_times',
    'restaurant_vip_users',
    'restaurant_waitlist_schedules',
    'review_replies',
    'security_audit_log',
    'special_offers',
    'staff_availability',
    'staff_positions',
    'staff_schedules',
    'staff_shifts',
    'table_combinations',
    'time_clock_entries',
    'time_off_requests',
    'user_restaurant_blacklist',
    'waitlist'
  ]

  const counts: TableCount[] = []

  for (const table of tables) {
    const { count, error } = await supabase
      .from(table)
      .select('*', { count: 'exact', head: true })
      .eq('restaurant_id', RESTAURANT_ID)

    if (error) {
      console.log(`⚠️  Error checking ${table}: ${error.message}`)
    } else {
      counts.push({ table_name: table, count: count || 0 })
    }
  }

  // Sort by count descending
  counts.sort((a, b) => b.count - a.count)

  // Display results
  console.log('Tables with data:')
  counts.forEach(({ table_name, count }) => {
    if (count > 0) {
      console.log(`  ${table_name}: ${count} records`)
    }
  })

  const totalRecords = counts.reduce((sum, { count }) => sum + count, 0)
  console.log(`\nTotal records to delete: ${totalRecords}\n`)

  return counts.filter(({ count }) => count > 0)
}

async function deleteRestaurantData(): Promise<void> {
  console.log(`\n🗑️  Starting deletion for restaurant ${RESTAURANT_ID}...\n`)

  // Delete in correct order (child tables first, then parent tables)
  const deletionOrder = [
    // Level 1: Deep child tables (no other tables depend on these)
    { table: 'booking_invites', via: 'bookings' },
    { table: 'booking_status_history', via: 'bookings' },
    { table: 'customer_notes', via: 'restaurant_customers' },
    { table: 'customer_preferences', via: 'restaurant_customers' },
    { table: 'customer_relationships', via: 'restaurant_customers' },
    { table: 'customer_tag_assignments', via: 'customer_tags' },
    { table: 'kitchen_assignments', via: 'kitchen_stations' },
    { table: 'loyalty_activities', via: 'bookings' },
    { table: 'loyalty_redemptions', via: 'bookings' },
    { table: 'order_modifications', via: 'order_items' },
    { table: 'order_status_history', via: 'orders' },
    { table: 'post_comments', via: 'posts' },
    { table: 'post_images', via: 'posts' },
    { table: 'post_likes', via: 'posts' },
    { table: 'post_tags', via: 'posts' },
    { table: 'review_reports', via: 'reviews' },
    { table: 'staff_position_assignments', via: 'staff_positions' },
    { table: 'user_loyalty_rule_usage', via: 'restaurant_loyalty_rules' },
    { table: 'user_offers', via: 'special_offers' },

    // Level 2: Mid-level child tables
    { table: 'order_items', via: 'orders' },
    { table: 'booking_tables', via: 'bookings' },
    { table: 'reviews', via: 'bookings' },
    { table: 'review_replies', direct: true },

    // Level 3: Direct children of restaurant
    { table: 'orders', direct: true },
    { table: 'bookings', direct: true },
    { table: 'customer_tags', direct: true },
    { table: 'favorites', direct: true },
    { table: 'floor_plans', direct: true },
    { table: 'kitchen_display_settings', direct: true },
    { table: 'kitchen_stations', direct: true },
    { table: 'loyalty_rewards', direct: true },
    { table: 'menu_items', direct: true },
    { table: 'menu_categories', direct: true },
    { table: 'notification_history', direct: true },
    { table: 'playlist_items', direct: true },
    { table: 'posts', direct: true },
    { table: 'push_subscriptions', direct: true },
    { table: 'restaurant_availability', direct: true },
    { table: 'restaurant_closures', direct: true },
    { table: 'restaurant_customers', direct: true },
    { table: 'restaurant_hours', direct: true },
    { table: 'restaurant_loyalty_balance', direct: true },
    { table: 'restaurant_loyalty_rules', direct: true },
    { table: 'restaurant_loyalty_transactions', direct: true },
    { table: 'restaurant_notification_preferences', direct: true },
    { table: 'restaurant_open_hours', direct: true },
    { table: 'restaurant_rating_requirements', direct: true },
    { table: 'restaurant_sections', direct: true },
    { table: 'restaurant_special_hours', direct: true },
    { table: 'restaurant_tables', direct: true },
    { table: 'restaurant_turn_times', direct: true },
    { table: 'restaurant_vip_users', direct: true },
    { table: 'restaurant_waitlist_schedules', direct: true },
    { table: 'security_audit_log', direct: true },
    { table: 'special_offers', direct: true },
    { table: 'staff_availability', direct: true },
    { table: 'staff_positions', direct: true },
    { table: 'staff_schedules', direct: true },
    { table: 'staff_shifts', direct: true },
    { table: 'table_combinations', direct: true },
    { table: 'time_clock_entries', direct: true },
    { table: 'time_off_requests', direct: true },
    { table: 'user_restaurant_blacklist', direct: true },
    { table: 'waitlist', direct: true },
    { table: 'restaurant_staff', direct: true },
  ]

  let totalDeleted = 0

  for (const { table, via, direct } of deletionOrder) {
    if (direct) {
      // Direct deletion via restaurant_id
      const { data, error, count } = await supabase
        .from(table)
        .delete({ count: 'exact' })
        .eq('restaurant_id', RESTAURANT_ID)

      if (error) {
        console.log(`❌ Error deleting from ${table}: ${error.message}`)
      } else {
        const deleted = count || 0
        if (deleted > 0) {
          console.log(`✅ Deleted ${deleted} records from ${table}`)
          totalDeleted += deleted
        }
      }
    } else if (via) {
      // Delete via parent table
      // First get IDs from parent table
      const parentColumn = via === 'bookings' ? 'booking_id' :
                          via === 'restaurant_customers' ? 'customer_id' :
                          via === 'customer_tags' ? 'tag_id' :
                          via === 'kitchen_stations' ? 'station_id' :
                          via === 'order_items' ? 'order_item_id' :
                          via === 'orders' ? 'order_id' :
                          via === 'posts' ? 'post_id' :
                          via === 'reviews' ? 'review_id' :
                          via === 'staff_positions' ? 'position_id' :
                          via === 'restaurant_loyalty_rules' ? 'rule_id' :
                          via === 'special_offers' ? 'offer_id' : null

      if (!parentColumn) {
        console.log(`⚠️  Skipping ${table} (no parent column defined)`)
        continue
      }

      // Get parent IDs
      const { data: parentData, error: parentError } = await supabase
        .from(via)
        .select('id')
        .eq('restaurant_id', RESTAURANT_ID)

      if (parentError) {
        console.log(`❌ Error getting parent IDs from ${via}: ${parentError.message}`)
        continue
      }

      if (!parentData || parentData.length === 0) {
        continue
      }

      const parentIds = parentData.map((p: any) => p.id)

      // Delete child records
      const { data, error, count } = await supabase
        .from(table)
        .delete({ count: 'exact' })
        .in(parentColumn, parentIds)

      if (error) {
        console.log(`❌ Error deleting from ${table}: ${error.message}`)
      } else {
        const deleted = count || 0
        if (deleted > 0) {
          console.log(`✅ Deleted ${deleted} records from ${table} (via ${via})`)
          totalDeleted += deleted
        }
      }
    }
  }

  console.log(`\n✨ Total records deleted: ${totalDeleted}\n`)
}

async function main() {
  try {
    // Check what data exists
    const tablesWithData = await checkRestaurantData()

    if (tablesWithData.length === 0) {
      console.log('✅ No data found for this restaurant. Nothing to delete.')
      return
    }

    // Confirm deletion
    console.log('⚠️  WARNING: This will permanently delete all data for this restaurant!')
    console.log('Press Ctrl+C to cancel, or continue to proceed...\n')

    // Wait 3 seconds for user to cancel
    await new Promise(resolve => setTimeout(resolve, 3000))

    // Perform deletion
    await deleteRestaurantData()

    // Verify deletion
    console.log('🔍 Verifying deletion...\n')
    const remainingData = await checkRestaurantData()

    if (remainingData.length === 0) {
      console.log('✅ All data successfully deleted!')
    } else {
      console.log('⚠️  Some data remains:')
      remainingData.forEach(({ table_name, count }) => {
        console.log(`  ${table_name}: ${count} records`)
      })
    }
  } catch (error) {
    console.error('❌ Error:', error)
    process.exit(1)
  }
}

main()
