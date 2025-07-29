// app/(dashboard)/dashboard/page.tsx
import { createClient } from "@/lib/supabase/server"
import { StatsCards } from "@/components/dashboard/stats-cards"
import { BookingChart } from "@/components/dashboard/booking-chart"
import { RecentBookings } from "@/components/dashboard/recent-bookings"
import { TopCustomers } from "@/components/dashboard/top-customers"
import { format, startOfDay, endOfDay, subDays } from "date-fns"

export default async function DashboardPage() {
  const supabase = createClient()
  const today = new Date()
  const todayStart = startOfDay(today)
  const todayEnd = endOfDay(today)
  const last30Days = subDays(today, 30)

  // Get user's restaurant
  const { data: { user } } = await supabase.auth.getUser()
  const { data: staffData } = await supabase
    .from("restaurant_staff")
    .select("restaurant_id")
    .eq("user_id", user?.id)
    .single()

  if (!staffData) {
    return <div>No restaurant access</div>
  }

  const restaurantId = staffData.restaurant_id

  // Fetch today's bookings
  const { data: todayBookings } = await supabase
    .from("bookings")
    .select("*")
    .eq("restaurant_id", restaurantId)
    .gte("booking_time", todayStart.toISOString())
    .lte("booking_time", todayEnd.toISOString())

  // Fetch this month's revenue (estimated based on party size)
  const { data: monthBookings } = await supabase
    .from("bookings")
    .select("party_size, status")
    .eq("restaurant_id", restaurantId)
    .gte("booking_time", startOfDay(new Date(today.getFullYear(), today.getMonth(), 1)).toISOString())
    .in("status", ["completed", "confirmed"])

  // Fetch total customers
  const { data: totalCustomers }:any = await supabase
    .from("bookings")
    .select("user_id", { count: "exact", head: true })
    .eq("restaurant_id", restaurantId)
    .not("user_id", "is", null)

  // Fetch average rating
  const { data: reviews } = await supabase
    .from("reviews")
    .select("rating")
    .eq("restaurant_id", restaurantId)

  // Calculate stats
  const todayCount = todayBookings?.length || 0
  const monthRevenue = monthBookings?.reduce((sum, booking) => sum + (booking.party_size * 50), 0) || 0 // Estimated $50 per person
  const totalCustomersCount = totalCustomers?.count || 0
  const avgRating = reviews?.length 
    ? (reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(1)
    : "0.0"

  // Fetch booking trends for chart (last 7 days)
  const chartData = []
  for (let i = 6; i >= 0; i--) {
    const date = subDays(today, i)
    const dayStart = startOfDay(date)
    const dayEnd = endOfDay(date)
    
    const { count } = await supabase
      .from("bookings")
      .select("*", { count: "exact", head: true })
      .eq("restaurant_id", restaurantId)
      .gte("booking_time", dayStart.toISOString())
      .lte("booking_time", dayEnd.toISOString())
      .in("status", ["confirmed", "completed"])

    chartData.push({
      date: format(date, "MMM dd"),
      bookings: count || 0,
    })
  }

  // Fetch recent bookings
  const { data: recentBookings } = await supabase
    .from("bookings")
    .select(`
      *,
      user:profiles(full_name, phone_number)
    `)
    .eq("restaurant_id", restaurantId)
    .order("created_at", { ascending: false })
    .limit(5)

  // Fetch top customers
  const { data: topCustomers }:any = await supabase
    .from("bookings")
    .select(`
      user_id,
      user:profiles(full_name, avatar_url),
      count:user_id.count()
    `)
    .eq("restaurant_id", restaurantId)
    .eq("status", "completed")
    .order("count", { ascending: false })
    .limit(5)

  const stats = [
    {
      title: "Today's Bookings",
      value: todayCount.toString(),
      description: `${todayBookings?.filter(b => b.status === 'pending').length || 0} pending`,
      trend: { value: 12, isPositive: true },
    },
    {
      title: "Monthly Revenue",
      value: `$${monthRevenue.toLocaleString()}`,
      description: "Estimated revenue",
      trend: { value: 8, isPositive: true },
    },
    {
      title: "Total Customers",
      value: totalCustomersCount.toLocaleString(),
      description: "Unique customers",
      trend: { value: 15, isPositive: true },
    },
    {
      title: "Average Rating",
      value: avgRating,
      description: `${reviews?.length || 0} reviews`,
      trend: { value: 0.2, isPositive: true },
    },
  ]

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">
          Welcome back! Here's what's happening at your restaurant today.
        </p>
      </div>

      {/* Stats Grid */}
      <StatsCards stats={stats} />

      {/* Charts and Lists */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        {/* Booking Trends Chart */}
        <div className="col-span-4">
          <BookingChart data={chartData} />
        </div>

        {/* Top Customers */}
        <div className="col-span-3">
          <TopCustomers customers={topCustomers || []} />
        </div>
      </div>

      {/* Recent Bookings */}
      <RecentBookings bookings={recentBookings || []} />
    </div>
  )
}