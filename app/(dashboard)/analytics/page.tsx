// app/(dashboard)/analytics/page.tsx
"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { useQuery } from "@tanstack/react-query"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { 
  TrendingUp, 
  Users, 
  Calendar,
  DollarSign,
  Star,
  Clock,
  AlertCircle,
  Award
} from "lucide-react"
import { format, subDays, startOfMonth, endOfMonth, startOfWeek, endOfWeek } from "date-fns"

// Type definitions
type BookingStats = {
  total: number
  confirmed: number
  completed: number
  cancelled: number
  noShow: number
  revenue: number
}

type CustomerStats = {
  uniqueCustomers: number
  repeatCustomers: number
  newCustomers: number
  vipCustomers: number
}

type TimeStats = {
  busiestDay: string
  busiestHour: string
  averagePartySize: number
  averageTurnTime: number
}

export default function AnalyticsPage() {
  const supabase = createClient()
  const [restaurantId, setRestaurantId] = useState<string>("")
  const [dateRange, setDateRange] = useState<string>("7days")

  // Get restaurant ID
  useEffect(() => {
    async function getRestaurantId() {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: staffData } = await supabase
          .from("restaurant_staff")
          .select("restaurant_id")
          .eq("user_id", user.id)
          .single()
        
        if (staffData) {
          setRestaurantId(staffData.restaurant_id)
        }
      }
    }
    getRestaurantId()
  }, [supabase])

  // Calculate date range
  const getDateRange = () => {
    const now = new Date()
    switch (dateRange) {
      case "7days":
        return { start: subDays(now, 7), end: now }
      case "30days":
        return { start: subDays(now, 30), end: now }
      case "thisMonth":
        return { start: startOfMonth(now), end: endOfMonth(now) }
      case "thisWeek":
        return { start: startOfWeek(now), end: endOfWeek(now) }
      default:
        return { start: subDays(now, 7), end: now }
    }
  }

  const { start, end } = getDateRange()

  // Fetch booking statistics
  const { data: bookingStats, isLoading: bookingStatsLoading } = useQuery({
    queryKey: ["booking-stats", restaurantId, dateRange],
    queryFn: async () => {
      if (!restaurantId) return null

      const { data: bookings, error } = await supabase
        .from("bookings")
        .select("*")
        .eq("restaurant_id", restaurantId)
        .gte("created_at", start.toISOString())
        .lte("created_at", end.toISOString())

      if (error) throw error

      const stats: BookingStats = {
        total: bookings.length,
        confirmed: bookings.filter(b => b.status === "confirmed").length,
        completed: bookings.filter(b => b.status === "completed").length,
        cancelled: bookings.filter(b => b.status === "cancelled_by_user" || b.status === "declined_by_restaurant").length,
        noShow: bookings.filter(b => b.status === "no_show").length,
        revenue: 0, // Would need actual revenue data
      }

      return stats
    },
    enabled: !!restaurantId,
  })

  // Fetch customer statistics
  const { data: customerStats, isLoading: customerStatsLoading } = useQuery({
    queryKey: ["customer-stats", restaurantId, dateRange],
    queryFn: async () => {
      if (!restaurantId) return null

      const { data: bookings, error } = await supabase
        .from("bookings")
        .select("user_id, created_at")
        .eq("restaurant_id", restaurantId)
        .gte("created_at", start.toISOString())
        .lte("created_at", end.toISOString())

      if (error) throw error

      // Get unique customers
      const uniqueCustomers = new Set(bookings.map(b => b.user_id)).size

      // Get repeat customers (those who booked more than once)
      const customerBookingCounts = bookings.reduce((acc, booking) => {
        acc[booking.user_id] = (acc[booking.user_id] || 0) + 1
        return acc
      }, {} as Record<string, number>)

      const repeatCustomers = Object.values(customerBookingCounts).filter(count => count > 1).length

      // Get VIP customers
      const { data: vipData, error: vipError } = await supabase
        .from("restaurant_vip_users")
        .select("user_id")
        .eq("restaurant_id", restaurantId)
        .gte("valid_until", new Date().toISOString())

      if (vipError) throw vipError

      const stats: CustomerStats = {
        uniqueCustomers,
        repeatCustomers,
        newCustomers: uniqueCustomers - repeatCustomers,
        vipCustomers: vipData?.length || 0,
      }

      return stats
    },
    enabled: !!restaurantId,
  })

  // Fetch time-based statistics
  const { data: timeStats, isLoading: timeStatsLoading } = useQuery({
    queryKey: ["time-stats", restaurantId, dateRange],
    queryFn: async () => {
      if (!restaurantId) return null

      const { data: bookings, error } = await supabase
        .from("bookings")
        .select("booking_time, party_size, turn_time_minutes")
        .eq("restaurant_id", restaurantId)
        .gte("booking_time", start.toISOString())
        .lte("booking_time", end.toISOString())
        .eq("status", "completed")

      if (error) throw error

      // Calculate busiest day
      const dayCount: Record<string, number> = {}
      bookings.forEach(booking => {
        const day = format(new Date(booking.booking_time), "EEEE")
        dayCount[day] = (dayCount[day] || 0) + 1
      })
      const busiestDay = Object.entries(dayCount).sort(([,a], [,b]) => b - a)[0]?.[0] || "N/A"

      // Calculate busiest hour
      const hourCount: Record<string, number> = {}
      bookings.forEach(booking => {
        const hour = format(new Date(booking.booking_time), "ha")
        hourCount[hour] = (hourCount[hour] || 0) + 1
      })
      const busiestHour = Object.entries(hourCount).sort(([,a], [,b]) => b - a)[0]?.[0] || "N/A"

      // Calculate averages
      const averagePartySize = bookings.length > 0 
        ? bookings.reduce((sum, b) => sum + b.party_size, 0) / bookings.length 
        : 0

      const averageTurnTime = bookings.length > 0
        ? bookings.reduce((sum, b) => sum + (b.turn_time_minutes || 120), 0) / bookings.length
        : 0

      const stats: TimeStats = {
        busiestDay,
        busiestHour,
        averagePartySize: Math.round(averagePartySize * 10) / 10,
        averageTurnTime: Math.round(averageTurnTime),
      }

      return stats
    },
    enabled: !!restaurantId,
  })

  // Fetch review statistics
  const { data: reviewStats, isLoading: reviewStatsLoading } = useQuery({
    queryKey: ["review-stats", restaurantId],
    queryFn: async () => {
      if (!restaurantId) return null

      const { data: restaurant, error } = await supabase
        .from("restaurants")
        .select("average_rating, total_reviews")
        .eq("id", restaurantId)
        .single()

      if (error) throw error

      const { data: recentReviews, error: reviewError } = await supabase
        .from("reviews")
        .select("rating")
        .eq("restaurant_id", restaurantId)
        .gte("created_at", start.toISOString())
        .lte("created_at", end.toISOString())

      if (reviewError) throw reviewError

      return {
        averageRating: restaurant.average_rating || 0,
        totalReviews: restaurant.total_reviews || 0,
        recentReviews: recentReviews?.length || 0,
        recentAverage: recentReviews && recentReviews.length > 0
          ? recentReviews.reduce((sum, r) => sum + r.rating, 0) / recentReviews.length
          : 0,
      }
    },
    enabled: !!restaurantId,
  })

  const isLoading = bookingStatsLoading || customerStatsLoading || timeStatsLoading || reviewStatsLoading

  if (isLoading) {
    return <div className="flex items-center justify-center h-screen">Loading analytics...</div>
  }

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Analytics</h1>
          <p className="text-muted-foreground">
            Track your restaurant's performance and insights
          </p>
        </div>
        <Select value={dateRange} onValueChange={setDateRange}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Select period" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7days">Last 7 days</SelectItem>
            <SelectItem value="30days">Last 30 days</SelectItem>
            <SelectItem value="thisWeek">This week</SelectItem>
            <SelectItem value="thisMonth">This month</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Key Metrics */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Bookings</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{bookingStats?.total || 0}</div>
            <p className="text-xs text-muted-foreground">
              {bookingStats?.confirmed || 0} confirmed
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Unique Customers</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{customerStats?.uniqueCustomers || 0}</div>
            <p className="text-xs text-muted-foreground">
              {customerStats?.repeatCustomers || 0} repeat
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Average Rating</CardTitle>
            <Star className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {reviewStats?.averageRating ? reviewStats.averageRating.toFixed(1) : "0.0"}
            </div>
            <p className="text-xs text-muted-foreground">
              {reviewStats?.recentReviews || 0} new reviews
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completion Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {bookingStats && bookingStats.total > 0
                ? Math.round((bookingStats.completed / bookingStats.total) * 100)
                : 0}%
            </div>
            <p className="text-xs text-muted-foreground">
              {bookingStats?.noShow || 0} no-shows
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="bookings" className="space-y-4">
        <TabsList>
          <TabsTrigger value="bookings">Bookings</TabsTrigger>
          <TabsTrigger value="customers">Customers</TabsTrigger>
          <TabsTrigger value="operations">Operations</TabsTrigger>
        </TabsList>

        <TabsContent value="bookings" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Booking Status Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Confirmed</span>
                    <span className="text-sm text-muted-foreground">
                      {bookingStats?.confirmed || 0} ({bookingStats && bookingStats.total > 0
                        ? Math.round((bookingStats.confirmed / bookingStats.total) * 100)
                        : 0}%)
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Completed</span>
                    <span className="text-sm text-muted-foreground">
                      {bookingStats?.completed || 0} ({bookingStats && bookingStats.total > 0
                        ? Math.round((bookingStats.completed / bookingStats.total) * 100)
                        : 0}%)
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Cancelled</span>
                    <span className="text-sm text-muted-foreground">
                      {bookingStats?.cancelled || 0} ({bookingStats && bookingStats.total > 0
                        ? Math.round((bookingStats.cancelled / bookingStats.total) * 100)
                        : 0}%)
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">No Show</span>
                    <span className="text-sm text-muted-foreground">
                      {bookingStats?.noShow || 0} ({bookingStats && bookingStats.total > 0
                        ? Math.round((bookingStats.noShow / bookingStats.total) * 100)
                        : 0}%)
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Peak Times</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Busiest Day</span>
                    <span className="text-sm text-muted-foreground">
                      {timeStats?.busiestDay || "N/A"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Busiest Hour</span>
                    <span className="text-sm text-muted-foreground">
                      {timeStats?.busiestHour || "N/A"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Avg Party Size</span>
                    <span className="text-sm text-muted-foreground">
                      {timeStats?.averagePartySize || 0} guests
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Avg Turn Time</span>
                    <span className="text-sm text-muted-foreground">
                      {timeStats?.averageTurnTime || 0} minutes
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="customers" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">New Customers</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{customerStats?.newCustomers || 0}</div>
                <p className="text-xs text-muted-foreground">
                  First-time visitors
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Repeat Customers</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{customerStats?.repeatCustomers || 0}</div>
                <p className="text-xs text-muted-foreground">
                  Returning customers
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">VIP Customers</CardTitle>
                <Award className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{customerStats?.vipCustomers || 0}</div>
                <p className="text-xs text-muted-foreground">
                  Active VIP members
                </p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="operations" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Operational Insights</CardTitle>
              <CardDescription>
                Key metrics to optimize your restaurant operations
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="p-4 border rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">Table Turnover</span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Average table turnover time is {timeStats?.averageTurnTime || 0} minutes
                  </p>
                </div>
                <div className="p-4 border rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">Party Size Trends</span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Average party size is {timeStats?.averagePartySize || 0} guests
                  </p>
                </div>
                <div className="p-4 border rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertCircle className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">No-Show Rate</span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {bookingStats && bookingStats.total > 0
                      ? Math.round((bookingStats.noShow / bookingStats.total) * 100)
                      : 0}% of bookings result in no-shows
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}