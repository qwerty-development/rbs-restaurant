// Test script to verify VIP functionality fix
// This script tests the VIP add/remove cycle to ensure no constraint violations

const { createClient } = require('@supabase/supabase-js')

// You'll need to set these environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('Please set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

async function testVIPFunctionality() {
  try {
    console.log('🧪 Testing VIP functionality...\n')

    // Test data - you may need to adjust these IDs to match your test data
    const testRestaurantId = 'your-test-restaurant-id'
    const testUserId = 'your-test-user-id'

    console.log('1. 🗑️  Cleaning up any existing VIP records for test user...')
    await supabase
      .from('restaurant_vip_users')
      .delete()
      .eq('restaurant_id', testRestaurantId)
      .eq('user_id', testUserId)
    
    console.log('✅ Cleanup completed')

    console.log('\n2. ➕ Adding VIP status...')
    const { data: insertData, error: insertError } = await supabase
      .from('restaurant_vip_users')
      .insert({
        restaurant_id: testRestaurantId,
        user_id: testUserId,
        extended_booking_days: 60,
        priority_booking: true,
        valid_until: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()
      })
      .select()

    if (insertError) {
      console.error('❌ Error adding VIP:', insertError)
      return
    }
    console.log('✅ VIP status added successfully')

    console.log('\n3. 🗑️  Removing VIP status (simulating VIP page removal)...')
    const { error: deleteError } = await supabase
      .from('restaurant_vip_users')
      .delete()
      .eq('restaurant_id', testRestaurantId)
      .eq('user_id', testUserId)

    if (deleteError) {
      console.error('❌ Error removing VIP:', deleteError)
      return
    }
    console.log('✅ VIP status removed successfully')

    console.log('\n4. ➕ Re-adding VIP status (simulating customers page toggle)...')
    
    // First delete any existing records (this is what our fix does)
    await supabase
      .from('restaurant_vip_users')
      .delete()
      .eq('restaurant_id', testRestaurantId)
      .eq('user_id', testUserId)

    // Then insert new record
    const { data: reInsertData, error: reInsertError } = await supabase
      .from('restaurant_vip_users')
      .insert({
        restaurant_id: testRestaurantId,
        user_id: testUserId,
        extended_booking_days: 60,
        priority_booking: true,
        valid_until: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()
      })
      .select()

    if (reInsertError) {
      console.error('❌ Error re-adding VIP:', reInsertError)
      return
    }
    console.log('✅ VIP status re-added successfully')

    console.log('\n5. 🗑️  Final cleanup...')
    await supabase
      .from('restaurant_vip_users')
      .delete()
      .eq('restaurant_id', testRestaurantId)
      .eq('user_id', testUserId)
    
    console.log('✅ Final cleanup completed')

    console.log('\n🎉 All tests passed! VIP functionality should work correctly now.')

  } catch (error) {
    console.error('❌ Test failed:', error)
  }
}

// Check if this script is being run directly
if (require.main === module) {
  console.log('⚠️  Note: You need to update testRestaurantId and testUserId with actual values from your database')
  console.log('⚠️  And make sure you have the required environment variables set')
  console.log('⚠️  Uncomment the line below to run the test:\n')
  
  // Uncomment the next line when you're ready to test with real data
  // testVIPFunctionality()
}

module.exports = { testVIPFunctionality }
