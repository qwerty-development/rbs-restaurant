// Test script to verify staff scheduling fixes
const { createClient } = require('@supabase/supabase-js')

// You'll need to add your Supabase credentials
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY environment variables')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function testStaffShiftsQuery() {
  console.log('Testing staff shifts query...')
  
  try {
    const { data, error } = await supabase
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
      .limit(1)

    if (error) {
      console.error('❌ Query failed:', error)
      return false
    }

    console.log('✅ Query successful! Sample data:', JSON.stringify(data, null, 2))
    return true
  } catch (err) {
    console.error('❌ Test failed:', err)
    return false
  }
}

async function testTimeClockQuery() {
  console.log('Testing time clock entries query...')
  
  try {
    const { data, error } = await supabase
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
        )
      `)
      .limit(1)

    if (error) {
      console.error('❌ Query failed:', error)
      return false
    }

    console.log('✅ Query successful! Sample data:', JSON.stringify(data, null, 2))
    return true
  } catch (err) {
    console.error('❌ Test failed:', err)
    return false
  }
}

async function runTests() {
  console.log('🔧 Testing Staff Scheduling Relationship Fixes\n')
  
  const results = await Promise.all([
    testStaffShiftsQuery(),
    testTimeClockQuery()
  ])
  
  const allPassed = results.every(result => result === true)
  
  console.log('\n' + '='.repeat(50))
  console.log(allPassed ? '✅ All tests passed!' : '❌ Some tests failed!')
  console.log('='.repeat(50))
}

runTests()
