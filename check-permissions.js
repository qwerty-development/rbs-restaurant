#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseServiceKey || !supabaseAnonKey) {
  console.error('Missing required environment variables')
  process.exit(1)
}

async function checkRLSandPermissions() {
  console.log('🔒 Checking RLS and permissions...')
  
  const restaurantId = '660e8400-e29b-41d4-a716-446655440005'
  
  // Test with service role (should work)
  console.log('\n1️⃣ Testing with SERVICE ROLE key...')
  const serviceClient = createClient(supabaseUrl, supabaseServiceKey)
  
  try {
    const { data, error } = await serviceClient
      .from('restaurant_staff')
      .select('id, role, user_id')
      .eq('restaurant_id', restaurantId)
      .limit(1)
    
    if (error) {
      console.error('❌ Service role error:', error)
    } else {
      console.log(`✅ Service role works: Found ${data?.length || 0} records`)
    }
  } catch (err) {
    console.error('❌ Service role exception:', err.message)
  }
  
  // Test with anonymous key (this is what browser uses)
  console.log('\n2️⃣ Testing with ANONYMOUS key (browser simulation)...')
  const anonClient = createClient(supabaseUrl, supabaseAnonKey)
  
  try {
    const { data, error } = await anonClient
      .from('restaurant_staff')
      .select('id, role, user_id')
      .eq('restaurant_id', restaurantId)
      .limit(1)
    
    if (error) {
      console.error('❌ Anonymous error:', error)
    } else {
      console.log(`✅ Anonymous works: Found ${data?.length || 0} records`)
    }
  } catch (err) {
    console.error('❌ Anonymous exception:', err.message)
  }
  
  // Check if RLS is enabled
  console.log('\n3️⃣ Checking RLS status...')
  try {
    const { data: tables, error } = await serviceClient
      .from('information_schema.tables')
      .select('table_name, row_security')
      .eq('table_schema', 'public')
      .in('table_name', ['restaurant_staff', 'staff_shifts', 'time_clock_entries'])
    
    if (error) {
      console.error('❌ RLS check error:', error)
    } else {
      console.log('📋 RLS Status:', tables)
    }
  } catch (err) {
    console.error('❌ RLS check exception:', err.message)
  }
  
  // Test creating a user session and trying again
  console.log('\n4️⃣ Testing with mock user session...')
  try {
    // Get a user ID from the staff data
    const { data: staffData } = await serviceClient
      .from('restaurant_staff')
      .select('user_id')
      .eq('restaurant_id', restaurantId)
      .limit(1)
    
    if (staffData && staffData.length > 0) {
      const userId = staffData[0].user_id
      console.log(`🧪 Using user ID: ${userId}`)
      
      // Try to manually set the user context (this might not work but let's see)
      const userClient = createClient(supabaseUrl, supabaseAnonKey)
      
      // First try to get user info
      const { data: userData, error: userError } = await serviceClient
        .from('profiles')
        .select('id, email, full_name')
        .eq('id', userId)
        .single()
      
      if (userError) {
        console.error('❌ User lookup error:', userError)
      } else {
        console.log('👤 User data:', userData)
      }
    }
  } catch (err) {
    console.error('❌ User session test exception:', err.message)
  }
}

checkRLSandPermissions().then(() => {
  console.log('\n🏁 Check completed!')
  process.exit(0)
})
