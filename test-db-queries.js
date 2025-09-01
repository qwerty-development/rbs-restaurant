#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing required environment variables')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function testQueries() {
  console.log('🔍 Testing database queries...')
  
  const restaurantId = '660e8400-e29b-41d4-a716-446655440005'
  
  try {
    // Test 1: Restaurant staff
    console.log('\n1️⃣ Testing restaurant staff query...')
    const { data: staffData, error: staffError } = await supabase
      .from('restaurant_staff')
      .select(`
        id,
        restaurant_id,
        user_id,
        role,
        permissions,
        is_active,
        created_at,
        user:profiles!restaurant_staff_user_id_fkey(
          id,
          full_name,
          email,
          phone_number,
          avatar_url
        )
      `)
      .eq('restaurant_id', restaurantId)
      .eq('is_active', true)
      .order('created_at', { ascending: true })
    
    if (staffError) {
      console.error('❌ Staff query error:', staffError)
    } else {
      console.log(`✅ Found ${staffData?.length || 0} staff members`)
      if (staffData && staffData.length > 0) {
        console.log('Sample staff:', staffData[0])
      }
    }
    
    // Test 2: Time clock entries
    console.log('\n2️⃣ Testing time clock entries query...')
    const { data: timeClockData, error: timeClockError } = await supabase
      .from('time_clock_entries')
      .select(`
        *,
        staff:restaurant_staff(
          id,
          user_id,
          role,
          user:profiles!restaurant_staff_user_id_fkey(
            id,
            full_name,
            email,
            phone_number,
            avatar_url
          )
        ),
        shift:staff_shifts(
          id,
          shift_date,
          start_time,
          end_time,
          role,
          station
        ),
        approved_by_user:profiles!time_clock_entries_approved_by_fkey(
          id,
          full_name,
          email
        )
      `)
      .eq('restaurant_id', restaurantId)
      .gte('clock_in_time', '2025-09-01')
      .lte('clock_in_time', '2025-09-02')
    
    if (timeClockError) {
      console.error('❌ Time clock query error:', timeClockError)
    } else {
      console.log(`✅ Found ${timeClockData?.length || 0} time clock entries`)
      if (timeClockData && timeClockData.length > 0) {
        console.log('Sample time clock entry:', timeClockData[0])
        const activeEntries = timeClockData.filter(entry => entry.status === 'active')
        console.log(`📊 Active entries: ${activeEntries.length}`)
      }
    }
    
    // Test 3: Staff shifts
    console.log('\n3️⃣ Testing staff shifts query...')
    const { data: shiftsData, error: shiftsError } = await supabase
      .from('staff_shifts')
      .select(`
        *,
        staff:restaurant_staff(
          id,
          user_id,
          role,
          user:profiles!restaurant_staff_user_id_fkey(
            id,
            full_name,
            email,
            phone_number,
            avatar_url
          )
        ),
        schedule:staff_schedules(
          id,
          name,
          schedule_type
        ),
        created_by_user:profiles!staff_shifts_created_by_fkey(
          id,
          full_name,
          email
        )
      `)
      .eq('restaurant_id', restaurantId)
      .gte('shift_date', '2025-08-25')
      .lte('shift_date', '2025-09-08')
    
    if (shiftsError) {
      console.error('❌ Shifts query error:', shiftsError)
    } else {
      console.log(`✅ Found ${shiftsData?.length || 0} shifts`)
      if (shiftsData && shiftsData.length > 0) {
        console.log('Sample shift:', shiftsData[0])
        const todaysShifts = shiftsData.filter(shift => shift.shift_date === '2025-09-01')
        console.log(`📅 Today's shifts: ${todaysShifts.length}`)
      }
    }
    
  } catch (error) {
    console.error('💥 Test failed:', error)
  }
}

testQueries().then(() => {
  console.log('\n🏁 Test completed!')
  process.exit(0)
})
