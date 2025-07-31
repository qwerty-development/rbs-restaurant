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
import { Button } from "@/components/ui/button"
import { 
  TrendingUp, 
  Users, 
  Calendar,
  DollarSign,
  Star,
  Clock,
  AlertCircle,
  Award,
  UserCheck,
  ArrowRight,
  BarChart3,
  PieChart
} from "lucide-react"
import { format, subDays, startOfMonth, endOfMonth, startOfWeek, endOfWeek } from "date-fns"
import { useRouter } from "next/navigation"

// Type definitions
type BookingStats = {
  total: number
  confirmed: number
  completed: number
  cancelled: number
  noShow: number
  pending: number
  revenue: number
}

type CustomerStats = {
  uniqueCustomers: number
  repeatCustomers: number
  newCustomers: number
  frequentCustomers: number
}

type TimeStats = {
  busiestDay: string
  busiestHour: string
  averagePartySize: number
  averageTurnTime: number
}

type ReviewStats = {
  averageRating: number
  totalReviews: number
  recentReviews: number
  recentAverage: number
}

export default function AnalyticsPage() {
  const supabase = createClient()
  const router = useRouter()
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
        .gte("booking_time", start.toISOString())
        .lte("booking_time", end.toISOString())

      if (error) throw error

      // Calculate estimated revenue (assuming $50 per person average)
      const PRICE_PER_PERSON = 50
      const completedBookings = bookings.filter(b => b.status === "completed")
      const revenue = completedBookings.reduce((sum, booking) => 
        sum + (booking.party_size * PRICE_PER_PERSON), 0
      )

      const stats: BookingStats = {
        total: bookings.length,
        confirmed: bookings.filter(b => b.status === "confirmed").length,
        completed: completedBookings.length,
        cancelled: bookings.filter(b => 
          b.status === "cancelled_by_user" || b.status === "declined_by_restaurant"
        ).length,
        noShow: bookings.filter(b => b.status === "no_show").length,
        pending: bookings.filter(b => b.status === "pending").length,
        revenue,
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

      // Get bookings in the date range
      const { data: bookings, error } = await supabase
        .from("bookings")
        .select("user_id, booking_time")
        .eq("restaurant_id", restaurantId)
        .gte("booking_time", start.toISOString())
        .lte("booking_time", end.toISOString())
        .not("user_id", "is", null)

      if (error) throw error

      // Get unique customers in this period
      const uniqueCustomers = new Set(bookings.map(b => b.user_id)).size

      // Get all-time booking stats to determine repeat vs new customers
      const { data: allTimeBookings, error: allTimeError } = await supabase
        .from("bookings")
        .select("user_id, booking_time")
        .eq("restaurant_id", restaurantId)
        .not("user_id", "is", null)

      if (allTimeError) throw allTimeError

      // Analyze customers
      const customerBookingCounts = new Map()
      allTimeBookings.forEach(booking => {
        const userId = booking.user_id
        if (!customerBookingCounts.has(userId)) {
          customerBookingCounts.set(userId, {
            totalBookings: 0,
            firstBooking: booking.booking_time,
          })
        }
        customerBookingCounts.get(userId).totalBookings++
        
        // Update first booking if this is earlier
        if (new Date(booking.booking_time) < new Date(customerBookingCounts.get(userId).firstBooking)) {
          customerBookingCounts.get(userId).firstBooking = booking.booking_time
        }
      })

      // Count customers in current period
      const currentPeriodCustomers = new Set(bookings.map(b => b.user_id))
      let newCustomers = 0
      let repeatCustomers = 0
      let frequentCustomers = 0

      currentPeriodCustomers.forEach(userId => {
        const customerData = customerBookingCounts.get(userId)
        if (customerData) {
          const firstBookingInPeriod = new Date(customerData.firstBooking) >= start
          
          if (firstBookingInPeriod) {
            newCustomers++
          } else if (customerData.totalBookings >= 5) {
            frequentCustomers++
          } else {
            repeatCustomers++
          }
        }
      })

      const stats: CustomerStats = {
        uniqueCustomers,
        repeatCustomers,
        newCustomers,
        frequentCustomers,
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
        .in("status", ["completed", "confirmed"])

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
        ? bookings.reduce((sum, b) => sum + (b.party_size || 2), 0) / bookings.length 
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
    queryKey: ["review-stats", restaurantId, dateRange],
    queryFn: async () => {
      if (!restaurantId) return null

      // Get restaurant's overall stats
      const { data: restaurant, error } = await supabase
        .from("restaurants")
        .select("average_rating, total_reviews")
        .eq("id", restaurantId)
        .single()

      if (error) throw error

      // Get recent reviews in the date range
      const { data: recentReviews, error: reviewError } = await supabase
        .from("reviews")
        .select("rating")
        .eq("restaurant_id", restaurantId)
        .gte("created_at", start.toISOString())
        .lte("created_at", end.toISOString())

      if (reviewError) throw reviewError

      const stats: ReviewStats = {
        averageRating: restaurant.average_rating || 0,
        totalReviews: restaurant.total_reviews || 0,
        recentReviews: recentReviews?.length || 0,
        recentAverage: recentReviews && recentReviews.length > 0
          ? recentReviews.reduce((sum, r) => sum + r.rating, 0) / recentReviews.length
          : 0,
      }

      return stats
    },
    enabled: !!restaurantId,
  })

  const isLoading = bookingStatsLoading || customerStatsLoading || timeStatsLoading || reviewStatsLoading

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
          <p className="mt-4">Loading analytics...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Analytics Dashboard</h1>
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
              {bookingStats?.confirmed || 0} confirmed, {bookingStats?.pending || 0} pending
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
              {customerStats?.newCustomers || 0} new, {customerStats?.repeatCustomers || 0} returning
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Average Rating</CardTitle>
            <Star className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold flex items-center gap-1">
              {reviewStats?.averageRating ? reviewStats.averageRating.toFixed(1) : "0.0"}
              <Star className="h-5 w-5 fill-yellow-400 text-yellow-400" />
            </div>
            <p className="text-xs text-muted-foreground">
              {reviewStats?.recentReviews || 0} new reviews
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Est. Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${(bookingStats?.revenue || 0).toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">
              From completed bookings
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <div className="grid gap-4 md:grid-cols-3">
        <Button 
          onClick={() => router.push("/analytics/customers")} 
          variant="outline" 
          className="h-20 flex-col gap-2"
        >
          <Users className="h-6 w-6" />
          <span>Customer Analytics</span>
          <ArrowRight className="h-4 w-4" />
        </Button>
        
      
        
        <Button 
          onClick={() => router.push("/bookings")} 
          variant="outline" 
          className="h-20 flex-col gap-2"
        >
          <Calendar className="h-6 w-6" />
          <span>Booking Management</span>
          <ArrowRight className="h-4 w-4" />
        </Button>
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
                <CardDescription>
                  Breakdown of all bookings in the selected period
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Confirmed</span>
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-16 bg-green-200 rounded">
                        <div 
                          className="h-2 bg-green-500 rounded" 
                          style={{ 
                            width: `${bookingStats && bookingStats.total > 0 
                              ? (bookingStats.confirmed / bookingStats.total) * 100 
                              : 0}%` 
                          }}
                        />
                      </div>
                      <span className="text-sm text-muted-foreground">
                        {bookingStats?.confirmed || 0} ({bookingStats && bookingStats.total > 0
                          ? Math.round((bookingStats.confirmed / bookingStats.total) * 100)
                          : 0}%)
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Completed</span>
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-16 bg-blue-200 rounded">
                        <div 
                          className="h-2 bg-blue-500 rounded" 
                          style={{ 
                            width: `${bookingStats && bookingStats.total > 0 
                              ? (bookingStats.completed / bookingStats.total) * 100 
                              : 0}%` 
                          }}
                        />
                      </div>
                      <span className="text-sm text-muted-foreground">
                        {bookingStats?.completed || 0} ({bookingStats && bookingStats.total > 0
                          ? Math.round((bookingStats.completed / bookingStats.total) * 100)
                          : 0}%)
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Pending</span>
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-16 bg-yellow-200 rounded">
                        <div 
                          className="h-2 bg-yellow-500 rounded" 
                          style={{ 
                            width: `${bookingStats && bookingStats.total > 0 
                              ? (bookingStats.pending / bookingStats.total) * 100 
                              : 0}%` 
                          }}
                        />
                      </div>
                      <span className="text-sm text-muted-foreground">
                        {bookingStats?.pending || 0} ({bookingStats && bookingStats.total > 0
                          ? Math.round((bookingStats.pending / bookingStats.total) * 100)
                          : 0}%)
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Cancelled</span>
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-16 bg-red-200 rounded">
                        <div 
                          className="h-2 bg-red-500 rounded" 
                          style={{ 
                            width: `${bookingStats && bookingStats.total > 0 
                              ? (bookingStats.cancelled / bookingStats.total) * 100 
                              : 0}%` 
                          }}
                        />
                      </div>
                      <span className="text-sm text-muted-foreground">
                        {bookingStats?.cancelled || 0} ({bookingStats && bookingStats.total > 0
                          ? Math.round((bookingStats.cancelled / bookingStats.total) * 100)
                          : 0}%)
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">No Show</span>
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-16 bg-gray-200 rounded">
                        <div 
                          className="h-2 bg-gray-500 rounded" 
                          style={{ 
                            width: `${bookingStats && bookingStats.total > 0 
                              ? (bookingStats.noShow / bookingStats.total) * 100 
                              : 0}%` 
                          }}
                        />
                      </div>
                      <span className="text-sm text-muted-foreground">
                        {bookingStats?.noShow || 0} ({bookingStats && bookingStats.total > 0
                          ? Math.round((bookingStats.noShow / bookingStats.total) * 100)
                          : 0}%)
                      </span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Peak Times</CardTitle>
                <CardDescription>
                  Your busiest periods and averages
                </CardDescription>
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
                <CardTitle className="text-sm font-medium">Frequent Customers</CardTitle>
                <Award className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{customerStats?.frequentCustomers || 0}</div>
                <p className="text-xs text-muted-foreground">
                  5+ visits total
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
                    Average table turnover time is {timeStats?.averageTurnTime || 0} minutes. 
                    {(timeStats?.averageTurnTime || 0) > 150 && " Consider optimizing service flow to reduce wait times."}
                  </p>
                </div>

                <div className="p-4 border rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">Party Size Trends</span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Average party size is {timeStats?.averagePartySize || 0} guests. 
                    This helps with table allocation and menu planning.
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
                      : 0}% of bookings result in no-shows.
                    {bookingStats && (bookingStats.noShow / bookingStats.total) > 0.1 && " Consider implementing a confirmation system."}
                  </p>
                </div>

                <div className="p-4 border rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <TrendingUp className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">Completion Rate</span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {bookingStats && bookingStats.total > 0
                      ? Math.round((bookingStats.completed / bookingStats.total) * 100)
                      : 0}% of bookings are completed successfully.
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