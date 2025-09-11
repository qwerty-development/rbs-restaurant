// Tier Testing Functions
// Include this script in your app or copy to browser console

const testBasicTier = async () => {
  try {
    // Get current user and their restaurant
    const { data: { user } } = await window.supabase.auth.getUser()
    if (!user) {
      console.log('No user found')
      return
    }

    // Get user's restaurant
    const { data: staffData } = await window.supabase
      .from("restaurant_staff")
      .select("restaurant_id, restaurant:restaurants(id, name, tier)")
      .eq("user_id", user.id)
      .single()

    if (!staffData) {
      console.log('No restaurant found for user')
      return
    }

    console.log('Current restaurant:', staffData.restaurant)
    
    // Set to basic tier
    const { error } = await window.supabase
      .from('restaurants')
      .update({ tier: 'basic' })
      .eq('id', staffData.restaurant_id)

    if (error) {
      console.error('Error updating tier:', error)
      return
    }

    console.log('✅ Restaurant set to basic tier! Refresh the page.')
    
    // Verify the change
    const { data: updatedRestaurant } = await window.supabase
      .from('restaurants')
      .select('id, name, tier')
      .eq('id', staffData.restaurant_id)
      .single()
    
    console.log('Updated restaurant:', updatedRestaurant)
    
  } catch (error) {
    console.error('Error:', error)
  }
}

const testProTier = async () => {
  try {
    // Get current user and their restaurant
    const { data: { user } } = await window.supabase.auth.getUser()
    if (!user) {
      console.log('No user found')
      return
    }

    // Get user's restaurant
    const { data: staffData } = await window.supabase
      .from("restaurant_staff")
      .select("restaurant_id")
      .eq("user_id", user.id)
      .single()

    if (!staffData) {
      console.log('No restaurant found for user')
      return
    }
    
    // Set to pro tier
    const { error } = await window.supabase
      .from('restaurants')
      .update({ tier: 'pro' })
      .eq('id', staffData.restaurant_id)

    if (error) {
      console.error('Error updating tier:', error)
      return
    }

    console.log('✅ Restaurant set to pro tier! Refresh the page.')
    
  } catch (error) {
    console.error('Error:', error)
  }
}

// Make functions globally available
window.testBasicTier = testBasicTier
window.testProTier = testProTier

console.log('🎯 TIER TEST FUNCTIONS LOADED!')
console.log('📋 Usage:')
console.log('  testBasicTier() - Set restaurant to Basic tier')
console.log('  testProTier() - Set restaurant to Pro tier')
console.log('')
console.log('💡 After running either function, refresh the page to see changes')
