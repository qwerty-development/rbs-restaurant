// app/(dashboard)/analytics/page.tsx
"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { useQuery } from "@tanstack/react-query"
import { useRestaurantContext } from "@/lib/contexts/restaurant-context"
import { restaurantAuth } from "@/lib/restaurant-auth"
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
import { Badge } from "@/components/ui/badge"
import { RevenueDashboard } from "@/components/analytics/revenue-dashboard"
import { BusinessIntelligenceDashboard } from "@/components/analytics/business-intelligence-dashboard"
import { BookingAnalyticsDashboard } from "@/components/analytics/booking-analytics-dashboard"
import { CustomerAnalyticsDashboard } from "@/components/analytics/customer-analytics-dashboard"
import { OperationalAnalyticsDashboard } from "@/components/analytics/operational-analytics-dashboard"
import { FinancialAnalyticsDashboard } from "@/components/analytics/financial-analytics-dashboard"
import {
  TrendingUp,
  Users,
  Calendar,
  DollarSign,
  Star,
  Clock,
  AlertCircle,
  ArrowRight,
  ChefHat,
  Table2,
  Activity,
  Target,
  TrendingDown,
  BarChart3,
  PieChart,
  LineChart
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
  conversionRate: number
  averageSpend: number
}

type OperationalStats = {
  tableUtilization: number
  averageWaitTime: number
  turnoverRate: number
  capacityUtilization: number
  peakHours: Array<{ hour: string; bookings: number }>
}

type MenuPerformance = {
  topItems: Array<{ name: string; orders: number; revenue: number }>
  categoryPerformance: Array<{ category: string; orders: number; revenue: number }>
  profitMargins: Array<{ item: string; margin: number; revenue: number }>
}

type StaffMetrics = {
  activeStaff: number
  shiftEfficiency: number
  orderProcessingTime: number
  customerServiceRating: number
}

type TimeStats = {
  busiestDay: string
  busiestHour: string
  averagePartySize: number
  averageTurnTime: number
  hourlyTrends: Array<{ hour: string; bookings: number; revenue: number }>
  dailyTrends: Array<{ day: string; bookings: number; revenue: number }>
}

type ReviewStats = {
  averageRating: number
  totalReviews: number
  recentReviews: number
  recentAverage: number
  ratingDistribution: Array<{ rating: number; count: number }>
  sentimentTrend: Array<{ date: string; sentiment: number }>
}

export default function AnalyticsPage() {
  const supabase = createClient()
  const router = useRouter()
  const { currentRestaurant, isLoading: contextLoading } = useRestaurantContext()
  const [dateRange, setDateRange] = useState<string>("7days")
  const restaurantId = currentRestaurant?.restaurant.id

  // Check permissions on mount - only after context has loaded and restaurant is selected
  useEffect(() => {
    if (!contextLoading && currentRestaurant) {
      const hasPermission = restaurantAuth.hasPermission(
        currentRestaurant.permissions,
        'analytics.view',
        currentRestaurant.role
      )
      
      if (!hasPermission) {
        router.push('/dashboard')
      }
    }
    // Don't redirect to overview immediately - let the context auto-select restaurant first
  }, [contextLoading, currentRestaurant, router])

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

  // Helper function to format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount)
  }

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

      const confirmedBookings = bookings.filter(b => 
        b.status === "confirmed" || b.status === "completed"
      ).length
      const conversionRate = bookings.length > 0 ? (confirmedBookings / bookings.length) * 100 : 0
      const averageSpend = completedBookings.length > 0 ? revenue / completedBookings.length : 0

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
        conversionRate,
        averageSpend,
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
      const dayRevenue: Record<string, number> = {}
      bookings.forEach(booking => {
        const day = format(new Date(booking.booking_time), "EEEE")
        dayCount[day] = (dayCount[day] || 0) + 1
        dayRevenue[day] = (dayRevenue[day] || 0) + (booking.party_size * 50)
      })
      const busiestDay = Object.entries(dayCount).sort(([,a], [,b]) => b - a)[0]?.[0] || "N/A"

      // Calculate busiest hour and hourly trends
      const hourCount: Record<string, number> = {}
      const hourRevenue: Record<string, number> = {}
      bookings.forEach(booking => {
        const hour = format(new Date(booking.booking_time), "ha")
        hourCount[hour] = (hourCount[hour] || 0) + 1
        hourRevenue[hour] = (hourRevenue[hour] || 0) + (booking.party_size * 50)
      })
      const busiestHour = Object.entries(hourCount).sort(([,a], [,b]) => b - a)[0]?.[0] || "N/A"

      // Create hourly trends
      const hourlyTrends = Object.entries(hourCount).map(([hour, bookings]) => ({
        hour,
        bookings,
        revenue: hourRevenue[hour] || 0
      })).sort((a, b) => parseInt(a.hour) - parseInt(b.hour))

      // Create daily trends
      const dailyTrends = Object.entries(dayCount).map(([day, bookings]) => ({
        day,
        bookings,
        revenue: dayRevenue[day] || 0
      }))

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
        hourlyTrends,
        dailyTrends,
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
        .select("rating, created_at")
        .eq("restaurant_id", restaurantId)
        .gte("created_at", start.toISOString())
        .lte("created_at", end.toISOString())

      if (reviewError) throw reviewError

      // Calculate rating distribution
      const ratingCounts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
      recentReviews?.forEach(review => {
        const rating = Math.round(review.rating) as 1 | 2 | 3 | 4 | 5
        if (rating >= 1 && rating <= 5) {
          ratingCounts[rating]++
        }
      })

      const ratingDistribution = Object.entries(ratingCounts).map(([rating, count]) => ({
        rating: parseInt(rating),
        count
      }))

      // Create sentiment trend (simplified - based on rating averages over time)
      const sentimentTrend = recentReviews ? 
        recentReviews.reduce((acc: Array<{ date: string; sentiment: number }>, review, index) => {
          if (index % Math.max(1, Math.floor(recentReviews.length / 7)) === 0) {
            acc.push({
              date: format(new Date(review.created_at), "MMM dd"),
              sentiment: review.rating
            })
          }
          return acc
        }, []) : []

      const stats: ReviewStats = {
        averageRating: restaurant.average_rating || 0,
        totalReviews: restaurant.total_reviews || 0,
        recentReviews: recentReviews?.length || 0,
        recentAverage: recentReviews && recentReviews.length > 0
          ? recentReviews.reduce((sum, r) => sum + r.rating, 0) / recentReviews.length
          : 0,
        ratingDistribution,
        sentimentTrend,
      }

      return stats
    },
    enabled: !!restaurantId,
  })

  // Fetch operational statistics
  const { data: operationalStats, isLoading: operationalStatsLoading } = useQuery({
    queryKey: ["operational-stats", restaurantId, dateRange],
    queryFn: async () => {
      if (!restaurantId) return null

      // Get table utilization data
      const { data: tables, error: tablesError } = await supabase
        .from("restaurant_tables")
        .select("id, capacity")
        .eq("restaurant_id", restaurantId)

      if (tablesError) throw tablesError

      const totalCapacity = tables.reduce((sum, table) => sum + table.capacity, 0)

      // Get booking table data for utilization
      const { data: bookingTables, error: bookingTablesError } = await supabase
        .from("booking_tables")
        .select(`
          *, 
          booking:bookings!inner(booking_time, status, turn_time_minutes),
          table:restaurant_tables!inner(capacity)
        `)
        .eq("booking.restaurant_id", restaurantId)
        .gte("booking.booking_time", start.toISOString())
        .lte("booking.booking_time", end.toISOString())
        .in("booking.status", ["completed", "confirmed", "seated"])

      if (bookingTablesError) throw bookingTablesError

      const totalSeatsUsed = bookingTables.reduce((sum, bt) => 
        sum + (bt.seats_occupied || bt.table.capacity), 0
      )
      const tableUtilization = totalCapacity > 0 ? (totalSeatsUsed / totalCapacity) * 100 : 0

      // Calculate average wait time (time between booking and seating)
      const { data: seatedBookings } = await supabase
        .from("bookings")
        .select("booking_time, seated_at")
        .eq("restaurant_id", restaurantId)
        .gte("booking_time", start.toISOString())
        .lte("booking_time", end.toISOString())
        .not("seated_at", "is", null)

      const averageWaitTime = seatedBookings && seatedBookings.length > 0
        ? seatedBookings.reduce((sum, booking) => {
            const waitTime = new Date(booking.seated_at!).getTime() - new Date(booking.booking_time).getTime()
            return sum + (waitTime / (1000 * 60)) // Convert to minutes
          }, 0) / seatedBookings.length
        : 0

      // Calculate turnover rate
      const hoursInPeriod = (end.getTime() - start.getTime()) / (1000 * 60 * 60)
      const turnoverRate = tables.length > 0 ? (bookingTables.length / tables.length) / hoursInPeriod : 0

      // Get peak hours data
      const hourlyBookings: Record<string, number> = {}
      bookingTables.forEach(bt => {
        const hour = format(new Date(bt.booking.booking_time), "HH:mm")
        hourlyBookings[hour] = (hourlyBookings[hour] || 0) + 1
      })

      const peakHours = Object.entries(hourlyBookings)
        .map(([hour, bookings]) => ({ hour, bookings }))
        .sort((a, b) => b.bookings - a.bookings)
        .slice(0, 5)

      const stats: OperationalStats = {
        tableUtilization: Math.round(tableUtilization * 10) / 10,
        averageWaitTime: Math.round(averageWaitTime),
        turnoverRate: Math.round(turnoverRate * 100) / 100,
        capacityUtilization: Math.round((totalSeatsUsed / (totalCapacity * hoursInPeriod)) * 100 * 10) / 10,
        peakHours,
      }

      return stats
    },
    enabled: !!restaurantId,
  })

  // Fetch menu performance data
  const { data: menuPerformance, isLoading: menuPerformanceLoading } = useQuery({
    queryKey: ["menu-performance", restaurantId, dateRange],
    queryFn: async () => {
      if (!restaurantId) return null

      // Get order items with menu item details
      const { data: orderItems, error } = await supabase
        .from("order_items")
        .select(`
          *, 
          menu_item:menu_items!inner(name, price, category:menu_categories(name)),
          order:orders!inner(created_at)
        `)
        .eq("order.restaurant_id", restaurantId)
        .gte("order.created_at", start.toISOString())
        .lte("order.created_at", end.toISOString())

      if (error) throw error

      // Calculate top items
      const itemStats: Record<string, { orders: number; revenue: number; cost: number }> = {}
      orderItems?.forEach(item => {
        const name = item.menu_item.name
        if (!itemStats[name]) {
          itemStats[name] = { orders: 0, revenue: 0, cost: 0 }
        }
        itemStats[name].orders += item.quantity
        itemStats[name].revenue += item.quantity * item.unit_price
        itemStats[name].cost += item.quantity * (item.unit_price * 0.3) // Assume 30% cost ratio
      })

      const topItems = Object.entries(itemStats)
        .map(([name, stats]) => ({ name, ...stats }))
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 10)

      // Calculate category performance
      const categoryStats: Record<string, { orders: number; revenue: number }> = {}
      orderItems?.forEach(item => {
        const category = item.menu_item.category?.name || "Other"
        if (!categoryStats[category]) {
          categoryStats[category] = { orders: 0, revenue: 0 }
        }
        categoryStats[category].orders += item.quantity
        categoryStats[category].revenue += item.quantity * item.unit_price
      })

      const categoryPerformance = Object.entries(categoryStats)
        .map(([category, stats]) => ({ category, ...stats }))
        .sort((a, b) => b.revenue - a.revenue)

      // Calculate profit margins
      const profitMargins = topItems.map(item => ({
        item: item.name,
        margin: item.revenue > 0 ? ((item.revenue - item.cost) / item.revenue) * 100 : 0,
        revenue: item.revenue
      })).sort((a, b) => b.margin - a.margin)

      const stats: MenuPerformance = {
        topItems,
        categoryPerformance,
        profitMargins,
      }

      return stats
    },
    enabled: !!restaurantId,
  })

  // Fetch staff metrics
  const { data: staffMetrics, isLoading: staffMetricsLoading } = useQuery({
    queryKey: ["staff-metrics", restaurantId, dateRange],
    queryFn: async () => {
      if (!restaurantId) return null

      // Get active staff count
      const { data: activeStaff, error: staffError } = await supabase
        .from("restaurant_staff")
        .select("id")
        .eq("restaurant_id", restaurantId)
        .eq("is_active", true)

      if (staffError) throw staffError

      // Get staff shifts for efficiency calculation
      const { data: shifts, error: shiftsError } = await supabase
        .from("staff_shifts")
        .select(`
          *, 
          staff:restaurant_staff!inner(restaurant_id)
        `)
        .eq("staff.restaurant_id", restaurantId)
        .gte("start_time", start.toISOString())
        .lte("end_time", end.toISOString())

      if (shiftsError) throw shiftsError

      // Calculate average shift efficiency (simplified metric)
      const totalShiftHours = shifts?.reduce((sum, shift) => {
        const hours = (new Date(shift.end_time).getTime() - new Date(shift.start_time).getTime()) / (1000 * 60 * 60)
        return sum + hours
      }, 0) || 0

      const shiftEfficiency = shifts && shifts.length > 0 ? (totalShiftHours / shifts.length) : 0

      // Get order processing times
      const { data: orders, error: ordersError } = await supabase
        .from("orders")
        .select("created_at, confirmed_at, ready_at")
        .eq("restaurant_id", restaurantId)
        .gte("created_at", start.toISOString())
        .lte("created_at", end.toISOString())
        .not("ready_at", "is", null)

      if (ordersError) throw ordersError

      const orderProcessingTime = orders && orders.length > 0
        ? orders.reduce((sum, order) => {
            const processingTime = new Date(order.ready_at!).getTime() - new Date(order.created_at).getTime()
            return sum + (processingTime / (1000 * 60)) // Convert to minutes
          }, 0) / orders.length
        : 0

      const stats: StaffMetrics = {
        activeStaff: activeStaff?.length || 0,
        shiftEfficiency: Math.round(shiftEfficiency * 10) / 10,
        orderProcessingTime: Math.round(orderProcessingTime),
        customerServiceRating: 4.2, // This would come from customer feedback
      }

      return stats
    },
    enabled: !!restaurantId,
  })

  const isDataLoading = bookingStatsLoading || timeStatsLoading || reviewStatsLoading || 
                        operationalStatsLoading || menuPerformanceLoading || staffMetricsLoading

  // Show loading while context is loading or while we have a restaurant but data is loading
  if (contextLoading || (currentRestaurant && isDataLoading)) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
          <p className="mt-4">Loading analytics...</p>
        </div>
      </div>
    )
  }

  // Only show "no restaurant selected" if context has loaded and there's still no restaurant
  if (!contextLoading && (!currentRestaurant || !restaurantId)) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <p className="text-gray-600">No restaurant selected.</p>
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
      <div className="grid gap-4 md:grid-cols-4 lg:grid-cols-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Bookings</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{bookingStats?.total || 0}</div>
            <p className="text-xs text-muted-foreground">
              {bookingStats?.conversionRate ? `${bookingStats.conversionRate.toFixed(1)}% conversion` : "No data"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${bookingStats?.revenue?.toLocaleString() || 0}</div>
            <p className="text-xs text-muted-foreground">
              Avg: ${bookingStats?.averageSpend ? bookingStats.averageSpend.toFixed(0) : 0} per booking
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Table Utilization</CardTitle>
            <Table2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{operationalStats?.tableUtilization || 0}%</div>
            <p className="text-xs text-muted-foreground">
              {operationalStats?.averageWaitTime || 0}min avg wait
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
            <CardTitle className="text-sm font-medium">Active Staff</CardTitle>
            <ChefHat className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{staffMetrics?.activeStaff || 0}</div>
            <p className="text-xs text-muted-foreground">
              {staffMetrics?.orderProcessingTime || 0}min avg order time
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Efficiency Score</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{operationalStats?.turnoverRate ? (operationalStats.turnoverRate * 100).toFixed(0) : 0}%</div>
            <p className="text-xs text-muted-foreground">
              Table turnover rate
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <div className="grid gap-4 md:grid-cols-4">
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
          onClick={() => router.push("/menu")} 
          variant="outline" 
          className="h-20 flex-col gap-2"
        >
          <ChefHat className="h-6 w-6" />
          <span>Menu Performance</span>
          <ArrowRight className="h-4 w-4" />
        </Button>
        
        <Button 
          onClick={() => router.push("/staff")} 
          variant="outline" 
          className="h-20 flex-col gap-2"
        >
          <Activity className="h-6 w-6" />
          <span>Staff Analytics</span>
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

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Live Overview</TabsTrigger>
          <TabsTrigger value="revenue">Revenue</TabsTrigger>
          <TabsTrigger value="bookings">Bookings</TabsTrigger>
          <TabsTrigger value="customers">Customers</TabsTrigger>
          <TabsTrigger value="menu">Menu Performance</TabsTrigger>
          <TabsTrigger value="staff">Staff Efficiency</TabsTrigger>
          <TabsTrigger value="operations">Operations</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <BusinessIntelligenceDashboard />
          
          {/* Real-time Metrics Overview */}
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  Peak Hours Analysis
                </CardTitle>
                <CardDescription>Busiest times and capacity utilization</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium">Busiest Day:</span>
                    <span className="text-sm text-muted-foreground">{timeStats?.busiestDay || "N/A"}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium">Peak Hour:</span>
                    <span className="text-sm text-muted-foreground">{timeStats?.busiestHour || "N/A"}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium">Capacity Utilization:</span>
                    <span className="text-sm text-muted-foreground">{operationalStats?.capacityUtilization || 0}%</span>
                  </div>
                  <div className="space-y-2">
                    <span className="text-sm font-medium">Top Peak Hours:</span>
                    {operationalStats?.peakHours?.slice(0, 3).map((hour, index) => (
                      <div key={index} className="flex justify-between text-sm">
                        <span>{hour.hour}</span>
                        <span>{hour.bookings} bookings</span>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="h-5 w-5" />
                  Performance Indicators
                </CardTitle>
                <CardDescription>Key operational metrics</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm font-medium">Booking Conversion Rate</span>
                      <span className="text-sm">{bookingStats?.conversionRate?.toFixed(1) || 0}%</span>
                    </div>
                    <div className="w-full bg-secondary rounded-full h-2">
                      <div 
                        className="bg-primary h-2 rounded-full" 
                        style={{ width: `${Math.min(bookingStats?.conversionRate || 0, 100)}%` }}
                      ></div>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm font-medium">Table Utilization</span>
                      <span className="text-sm">{operationalStats?.tableUtilization || 0}%</span>
                    </div>
                    <div className="w-full bg-secondary rounded-full h-2">
                      <div 
                        className="bg-green-500 h-2 rounded-full" 
                        style={{ width: `${Math.min(operationalStats?.tableUtilization || 0, 100)}%` }}
                      ></div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm font-medium">Staff Efficiency</span>
                      <span className="text-sm">{staffMetrics?.customerServiceRating ? (staffMetrics.customerServiceRating * 20).toFixed(0) : 0}%</span>
                    </div>
                    <div className="w-full bg-secondary rounded-full h-2">
                      <div 
                        className="bg-blue-500 h-2 rounded-full" 
                        style={{ width: `${Math.min((staffMetrics?.customerServiceRating || 0) * 20, 100)}%` }}
                      ></div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="revenue" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Revenue Analytics</CardTitle>
              <CardDescription>Detailed revenue analysis and trends</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="text-center">
                    <div className="text-2xl font-bold">{bookingStats ? formatCurrency(bookingStats.revenue) : '$0'}</div>
                    <p className="text-sm text-muted-foreground">Total Revenue</p>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold">{bookingStats ? formatCurrency(bookingStats.averageSpend) : '$0'}</div>
                    <p className="text-sm text-muted-foreground">Average Spend</p>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold">{bookingStats?.completed || 0}</div>
                    <p className="text-sm text-muted-foreground">Completed Bookings</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="bookings" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Booking Analytics</CardTitle>
              <CardDescription>Booking patterns and performance metrics</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <h4 className="font-medium mb-2">Booking Status</h4>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span>Total</span>
                        <Badge variant="outline">{bookingStats?.total || 0}</Badge>
                      </div>
                      <div className="flex justify-between">
                        <span>Confirmed</span>
                        <Badge variant="default">{bookingStats?.confirmed || 0}</Badge>
                      </div>
                      <div className="flex justify-between">
                        <span>Completed</span>
                        <Badge variant="default">{bookingStats?.completed || 0}</Badge>
                      </div>
                      <div className="flex justify-between">
                        <span>Cancelled</span>
                        <Badge variant="destructive">{bookingStats?.cancelled || 0}</Badge>
                      </div>
                    </div>
                  </div>
                  <div>
                    <h4 className="font-medium mb-2">Performance</h4>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span>Conversion Rate</span>
                        <span>{bookingStats?.conversionRate?.toFixed(1) || 0}%</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Busiest Day</span>
                        <span>{timeStats?.busiestDay || 'N/A'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Peak Hour</span>
                        <span>{timeStats?.busiestHour || 'N/A'}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="customers" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Customer Analytics</CardTitle>
              <CardDescription>Customer insights and behavior patterns</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <h4 className="font-medium mb-2">Customer Metrics</h4>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span>Average Party Size</span>
                        <span>{timeStats?.averagePartySize || 0} guests</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Average Rating</span>
                        <span className="flex items-center gap-1">
                          {reviewStats?.averageRating?.toFixed(1) || '0.0'}
                          <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Recent Reviews</span>
                        <span>{reviewStats?.recentReviews || 0}</span>
                      </div>
                    </div>
                  </div>
                  <div>
                    <h4 className="font-medium mb-2">Engagement</h4>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span>Total Reviews</span>
                        <span>{reviewStats?.totalReviews || 0}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Recent Average</span>
                        <span>{reviewStats?.recentAverage?.toFixed(1) || '0.0'}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="menu" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
                  Top Performing Items
                </CardTitle>
                <CardDescription>Best selling menu items by revenue</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {menuPerformance?.topItems?.slice(0, 5).map((item, index) => (
                    <div key={index} className="flex justify-between items-center">
                      <div>
                        <p className="font-medium">{item.name}</p>
                        <p className="text-sm text-muted-foreground">{item.orders} orders</p>
                      </div>
                      <div className="text-right">
                        <p className="font-medium">${item.revenue.toFixed(0)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <PieChart className="h-5 w-5" />
                  Category Performance
                </CardTitle>
                <CardDescription>Revenue by menu category</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {menuPerformance?.categoryPerformance?.map((category, index) => (
                    <div key={index} className="flex justify-between items-center">
                      <div>
                        <p className="font-medium">{category.category}</p>
                        <p className="text-sm text-muted-foreground">{category.orders} orders</p>
                      </div>
                      <div className="text-right">
                        <p className="font-medium">${category.revenue.toFixed(0)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  Profit Margin Analysis
                </CardTitle>
                <CardDescription>Most profitable items by margin percentage</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {menuPerformance?.profitMargins?.slice(0, 8).map((item, index) => (
                    <div key={index} className="flex justify-between items-center">
                      <div className="flex-1">
                        <p className="font-medium">{item.item}</p>
                        <div className="w-full bg-secondary rounded-full h-2 mt-1">
                          <div 
                            className="bg-green-500 h-2 rounded-full" 
                            style={{ width: `${Math.min(item.margin, 100)}%` }}
                          ></div>
                        </div>
                      </div>
                      <div className="text-right ml-4">
                        <p className="font-medium">{item.margin.toFixed(1)}%</p>
                        <p className="text-sm text-muted-foreground">${item.revenue.toFixed(0)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="staff" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Staff Overview
                </CardTitle>
                <CardDescription>Current staff metrics and performance</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium">Active Staff Members:</span>
                    <span className="text-lg font-bold">{staffMetrics?.activeStaff || 0}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium">Avg Shift Efficiency:</span>
                    <span className="text-lg font-bold">{staffMetrics?.shiftEfficiency || 0}h</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium">Order Processing Time:</span>
                    <span className="text-lg font-bold">{staffMetrics?.orderProcessingTime || 0}min</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium">Service Rating:</span>
                    <span className="text-lg font-bold flex items-center gap-1">
                      {staffMetrics?.customerServiceRating || 0}
                      <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  Efficiency Metrics
                </CardTitle>
                <CardDescription>Performance indicators and optimization areas</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm font-medium">Order Processing Efficiency</span>
                      <span className="text-sm">
                        {staffMetrics?.orderProcessingTime && staffMetrics.orderProcessingTime < 15 ? "Excellent" : 
                         staffMetrics?.orderProcessingTime && staffMetrics.orderProcessingTime < 25 ? "Good" : "Needs Improvement"}
                      </span>
                    </div>
                    <div className="w-full bg-secondary rounded-full h-2">
                      <div 
                        className={`h-2 rounded-full ${
                          staffMetrics?.orderProcessingTime && staffMetrics.orderProcessingTime < 15 ? "bg-green-500" :
                          staffMetrics?.orderProcessingTime && staffMetrics.orderProcessingTime < 25 ? "bg-yellow-500" : "bg-red-500"
                        }`}
                        style={{ width: `${Math.max(20, Math.min(100 - (staffMetrics?.orderProcessingTime || 30), 100))}%` }}
                      ></div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm font-medium">Customer Satisfaction</span>
                      <span className="text-sm">{((staffMetrics?.customerServiceRating || 0) * 20).toFixed(0)}%</span>
                    </div>
                    <div className="w-full bg-secondary rounded-full h-2">
                      <div 
                        className="bg-blue-500 h-2 rounded-full" 
                        style={{ width: `${Math.min((staffMetrics?.customerServiceRating || 0) * 20, 100)}%` }}
                      ></div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="operations" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Operational Analytics</CardTitle>
              <CardDescription>
                Key metrics to optimize your restaurant operations
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <h4 className="font-medium mb-2">Table Operations</h4>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span>Table Utilization</span>
                        <span>{operationalStats?.tableUtilization || 0}%</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Average Wait Time</span>
                        <span>{operationalStats?.averageWaitTime || 0}min</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Turnover Rate</span>
                        <span>{operationalStats?.turnoverRate || 0}</span>
                      </div>
                    </div>
                  </div>
                  <div>
                    <h4 className="font-medium mb-2">Service Metrics</h4>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span>Average Turn Time</span>
                        <span>{timeStats?.averageTurnTime || 0}min</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Average Party Size</span>
                        <span>{timeStats?.averagePartySize || 0} guests</span>
                      </div>
                      <div className="flex justify-between">
                        <span>No-Show Rate</span>
                        <span>
                          {bookingStats && bookingStats.total > 0
                            ? Math.round((bookingStats.noShow / bookingStats.total) * 100)
                            : 0}%
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-4 mt-6">
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
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}