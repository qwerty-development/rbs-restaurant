import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { startOfDay, endOfDay } from 'date-fns'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const restaurantId = searchParams.get('restaurantId')
    const lastSync = searchParams.get('lastSync')

    if (!restaurantId) {
      return NextResponse.json({ error: 'Restaurant ID required' }, { status: 400 })
    }

    const supabase = await createClient()

    // Get current user session for security
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify user has access to this restaurant
    const { data: staffData, error: staffError } = await supabase
      .from('restaurant_staff')
      .select('id, role')
      .eq('user_id', user.id)
      .eq('restaurant_id', restaurantId)
      .eq('is_active', true)
      .single()

    if (staffError || !staffData) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    const today = new Date()
    const todayStart = startOfDay(today)
    const todayEnd = endOfDay(today)
    const lastSyncTime = lastSync ? new Date(lastSync) : new Date(Date.now() - 5 * 60 * 1000) // Default to 5 minutes ago

    // Fetch today's bookings AND all pending requests
    const [todaysData, pendingData] = await Promise.all([
      // Today's confirmed/active bookings
      supabase
        .from('bookings')
        .select(`
          *,
          user:profiles!bookings_user_id_fkey(
            id,
            full_name,
            phone_number,
            email
          ),
          booking_tables(
            table:restaurant_tables(*)
          ),
          special_offers!bookings_applied_offer_id_fkey(
            id,
            title,
            description,
            discount_percentage
          )
        `)
        .eq('restaurant_id', restaurantId)
        .gte('booking_time', todayStart.toISOString())
        .lte('booking_time', todayEnd.toISOString())
        .neq('status', 'pending')
        .order('booking_time', { ascending: true }),

      // All pending requests (regardless of date)
      supabase
        .from('bookings')
        .select(`
          *,
          user:profiles!bookings_user_id_fkey(
            id,
            full_name,
            phone_number,
            email
          ),
          booking_tables(
            table:restaurant_tables(*)
          ),
          special_offers!bookings_applied_offer_id_fkey(
            id,
            title,
            description,
            discount_percentage
          )
        `)
        .eq('restaurant_id', restaurantId)
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
    ])

    if (todaysData.error) {
      console.error('Error fetching today\'s bookings:', todaysData.error)
      return NextResponse.json({ error: 'Failed to fetch bookings' }, { status: 500 })
    }

    if (pendingData.error) {
      console.error('Error fetching pending bookings:', pendingData.error)
      return NextResponse.json({ error: 'Failed to fetch pending bookings' }, { status: 500 })
    }

    // Combine and deduplicate
    const combined = [...(todaysData.data || []), ...(pendingData.data || [])]
    const uniqueBookings = combined.reduce((acc, booking) => {
      if (!acc.find(b => b.id === booking.id)) {
        acc.push(booking)
      }
      return acc
    }, [] as any[])

    // Transform booking tables
    const transformedBookings = uniqueBookings.map((booking: any) => ({
      ...booking,
      tables: booking.booking_tables?.map((bt: { table: any }) => bt.table).filter(Boolean) || []
    }))

    // Sort: pending first, then by creation date
    transformedBookings.sort((a, b) => {
      if (a.status === 'pending' && b.status !== 'pending') return -1
      if (a.status !== 'pending' && b.status === 'pending') return 1
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    })

    // Find new bookings since last sync
    const newBookings = transformedBookings.filter(booking =>
      new Date(booking.created_at) > lastSyncTime
    )

    const response = {
      bookings: transformedBookings,
      newBookings,
      newBookingsCount: newBookings.length,
      syncTimestamp: Date.now(),
      stats: {
        total: transformedBookings.length,
        pending: transformedBookings.filter(b => b.status === 'pending').length,
        confirmed: transformedBookings.filter(b => b.status === 'confirmed').length,
        today: todaysData.data?.length || 0
      }
    }

    console.log(`[Background Sync] Fetched ${transformedBookings.length} bookings, ${newBookings.length} new since last sync`)

    return NextResponse.json(response)

  } catch (error) {
    console.error('Background sync error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}