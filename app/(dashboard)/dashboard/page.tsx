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

  // Fetch today's bookings with proper status
  const { data: todayBookings } = await supabase
    .from("bookings")
    .select("*")
    .eq("restaurant_id", restaurantId)
    .gte("booking_time", todayStart.toISOString())
    .lte("booking_time", todayEnd.toISOString())
    .in("status", ["pending", "confirmed", "completed"])

  // Fetch total customers (unique users who have made bookings)
  const { data: uniqueCustomers } = await supabase
    .from("bookings")
    .select("user_id")
    .eq("restaurant_id", restaurantId)
    .not("user_id", "is", null)
    
  const uniqueUserIds = [...new Set(uniqueCustomers?.map(b => b.user_id) || [])]

  // Fetch average rating
  const { data: reviews } = await supabase
    .from("reviews")
    .select("rating")
    .eq("restaurant_id", restaurantId)

  // Calculate stats
  const todayCount = todayBookings?.length || 0
  const pendingCount = todayBookings?.filter(b => b.status === 'pending').length || 0
  const totalCustomersCount = uniqueUserIds.length
  const avgRating = reviews?.length 
    ? (reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(1)
    : "0.0"

  // Fetch booking trends for chart (last 7 days)
  const chartData = []
  for (let i = 6; i >= 0; i--) {
    const date = subDays(today, i)
    const dayStart = startOfDay(date)
    const dayEnd = endOfDay(date)
    
    const { data: dayBookings } = await supabase
      .from("bookings")
      .select("*")
      .eq("restaurant_id", restaurantId)
      .gte("booking_time", dayStart.toISOString())
      .lte("booking_time", dayEnd.toISOString())
      .in("status", ["confirmed", "completed"])

    chartData.push({
      date: format(date, "MMM dd"),
      bookings: dayBookings?.length || 0,
    })
  }

  // Fetch recent bookings with user info
  const { data: recentBookings } = await supabase
    .from("bookings")
    .select(`
      *,
      profiles!bookings_user_id_fkey(full_name, phone_number)
    `)
    .eq("restaurant_id", restaurantId)
    .order("created_at", { ascending: false })
    .limit(5)

  // Fetch top customers
  const { data: bookingsByUser } = await supabase
    .from("bookings")
    .select(`
      user_id,
      profiles!bookings_user_id_fkey(full_name, avatar_url)
    `)
    .eq("restaurant_id", restaurantId)
    .eq("status", "completed")
    .not("user_id", "is", null)

  // Count bookings per user
  const userCounts = bookingsByUser?.reduce((acc, booking) => {
    if (booking.user_id) {
      if (!acc[booking.user_id]) {
        acc[booking.user_id] = {
          user_id: booking.user_id,
          user: booking.profiles,
          count: 0
        }
      }
      acc[booking.user_id].count++
    }
    return acc
  }, {} as Record<string, { user_id: string; user: any; count: number }>) || {}

  const topCustomers = Object.values(userCounts)
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)

  const stats = [
    {
      title: "Today's Bookings",
      value: todayCount.toString(),
      description: `${pendingCount} pending`,
      trend: { value: 12, isPositive: true },
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
    {
      title: "Active Tables",
      value: "View Tables",
      description: "Manage floor plan",
      trend: undefined,
      link: "/dashboard/tables"
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
      <RecentBookings bookings={recentBookings?.map(b => ({
        ...b,
        user: b.profiles
      })) || []} />
    </div>
  )
}