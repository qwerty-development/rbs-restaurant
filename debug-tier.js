// Quick debug script to test tier switching
// Run this in the browser console

async function setBasicTier() {
  try {
    const { createClient } = await import('./node_modules/@supabase/supabase-js/dist/module/index.js')
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    )

    // Get current user
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      console.log('❌ No user found')
      return
    }

    // Get user's restaurant
    const { data: staffData } = await supabase
      .from("restaurant_staff")
      .select("restaurant_id, restaurant:restaurants(id, name, tier)")
      .eq("user_id", user.id)
      .single()

    if (!staffData) {
      console.log('❌ No restaurant found for user')
      return
    }

    console.log('🏪 Current restaurant:', staffData.restaurant)
    
    // Set to basic tier
    const { error } = await supabase
      .from('restaurants')
      .update({ tier: 'basic' })
      .eq('id', staffData.restaurant_id)

    if (error) {
      console.error('❌ Error updating tier:', error)
      return
    }

    console.log('✅ Restaurant set to BASIC tier!')
    console.log('🔄 Please refresh the page to see changes')
    
  } catch (error) {
    console.error('❌ Error:', error)
  }
}

async function setProTier() {
  try {
    const { createClient } = await import('./node_modules/@supabase/supabase-js/dist/module/index.js')
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    )

    // Get current user
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      console.log('❌ No user found')
      return
    }

    // Get user's restaurant
    const { data: staffData } = await supabase
      .from("restaurant_staff")
      .select("restaurant_id")
      .eq("user_id", user.id)
      .single()

    if (!staffData) {
      console.log('❌ No restaurant found for user')
      return
    }
    
    // Set to pro tier
    const { error } = await supabase
      .from('restaurants')
      .update({ tier: 'pro' })
      .eq('id', staffData.restaurant_id)

    if (error) {
      console.error('❌ Error updating tier:', error)
      return
    }

    console.log('✅ Restaurant set to PRO tier!')
    console.log('🔄 Please refresh the page to see changes')
    
  } catch (error) {
    console.error('❌ Error:', error)
  }
}

// Make functions global
window.setBasicTier = setBasicTier
window.setProTier = setProTier

console.log('🎯 TIER DEBUG FUNCTIONS LOADED!')
console.log('💡 Usage:')
console.log('  setBasicTier() - Set to Basic tier')
console.log('  setProTier() - Set to Pro tier')
console.log('  Then refresh the page')
