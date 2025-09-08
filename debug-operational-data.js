// Debug script to test operational data queries
const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

async function testOperationalQueries() {
  const restaurantId = "660e8400-e29b-41d4-a716-446655440001"
  
  console.log("🔍 Testing operational data queries...")
  
  // Test 1: Check restaurant_tables
  console.log("\n1. Testing restaurant_tables...")
  const { data: tables, error: tablesError } = await supabase
    .from("restaurant_tables")
    .select("id, capacity, status")
    .eq("restaurant_id", restaurantId)
  
  if (tablesError) {
    console.error("❌ restaurant_tables error:", tablesError)
  } else {
    console.log("✅ restaurant_tables:", tables?.length, "tables found")
    console.log("   Total capacity:", tables?.reduce((sum, t) => sum + t.capacity, 0))
  }
  
  // Test 2: Check bookings with booking_tables
  console.log("\n2. Testing bookings with booking_tables...")
  const { data: bookings, error: bookingsError } = await supabase
    .from("bookings")
    .select(`
      id,
      party_size,
      status,
      booking_time,
      seated_at,
      booking_tables(
        table_id,
        seats_occupied,
        table:restaurant_tables(capacity)
      )
    `)
    .eq("restaurant_id", restaurantId)
    .gte("booking_time", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
    .in("status", ["completed", "confirmed", "seated", "arrived"])
    .limit(5)
  
  if (bookingsError) {
    console.error("❌ bookings with booking_tables error:", bookingsError)
  } else {
    console.log("✅ bookings with relations:", bookings?.length, "bookings found")
    bookings?.forEach((booking, i) => {
      console.log(`   Booking ${i+1}:`, {
        id: booking.id,
        party_size: booking.party_size,
        status: booking.status,
        booking_tables_count: booking.booking_tables?.length || 0
      })
    })
  }
  
  // Test 3: Check orders table
  console.log("\n3. Testing orders...")
  const { data: orders, error: ordersError } = await supabase
    .from("orders")
    .select("id, created_at, confirmed_at, ready_at, served_at, status")
    .eq("restaurant_id", restaurantId)
    .gte("created_at", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
    .limit(5)
  
  if (ordersError) {
    console.error("❌ orders error:", ordersError)
  } else {
    console.log("✅ orders:", orders?.length, "orders found")
  }
  
  // Test 4: Check staff_shifts (known to fail)
  console.log("\n4. Testing staff_shifts...")
  const { data: shifts, error: shiftsError } = await supabase
    .from("staff_shifts")
    .select(`
      *,
      staff:restaurant_staff!inner(restaurant_id)
    `)
    .eq("staff.restaurant_id", restaurantId)
    .gte("start_time", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
    .limit(5)
  
  if (shiftsError) {
    console.error("❌ staff_shifts error:", shiftsError)
  } else {
    console.log("✅ staff_shifts:", shifts?.length, "shifts found")
  }
}

testOperationalQueries().catch(console.error)
