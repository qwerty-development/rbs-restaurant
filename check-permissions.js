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

  
  const restaurantId = '660e8400-e29b-41d4-a716-446655440005'
  
  // Test with service role (should work)

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

    }
  } catch (err) {
    console.error('❌ Service role exception:', err.message)
  }
  
  // Test with anonymous key (this is what browser uses)

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

    }
  } catch (err) {
    console.error('❌ Anonymous exception:', err.message)
  }
  
  // Check if RLS is enabled

  try {
    const { data: tables, error } = await serviceClient
      .from('information_schema.tables')
      .select('table_name, row_security')
      .eq('table_schema', 'public')
      .in('table_name', ['restaurant_staff', 'staff_shifts', 'time_clock_entries'])
    
    if (error) {
      console.error('❌ RLS check error:', error)
    } else {

    }
  } catch (err) {
    console.error('❌ RLS check exception:', err.message)
  }
  
  // Test creating a user session and trying again

  try {
    // Get a user ID from the staff data
    const { data: staffData } = await serviceClient
      .from('restaurant_staff')
      .select('user_id')
      .eq('restaurant_id', restaurantId)
      .limit(1)
    
    if (staffData && staffData.length > 0) {
      const userId = staffData[0].user_id
    
      
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

      }
    }
  } catch (err) {
    console.error('❌ User session test exception:', err.message)
  }
}

checkRLSandPermissions().then(() => {

  process.exit(0)
})
