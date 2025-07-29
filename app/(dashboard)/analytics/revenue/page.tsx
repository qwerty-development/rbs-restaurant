// app/(dashboard)/analytics/revenue/page.tsx
"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { useQuery } from "@tanstack/react-query"
import { 
  startOfMonth, 
  endOfMonth, 
  subMonths,
  eachDayOfInterval,
  format,
  startOfYear,
  eachMonthOfInterval
} from "date-fns"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ComposedChart,
} from "recharts"
import { 
  DollarSign,
  TrendingUp,
  TrendingDown,
  Calendar,
  Download,
  ArrowUpRight,
  ArrowDownRight,
  CreditCard,
  Percent,
  Users,
  ArrowLeft,
  Clock
} from "lucide-react"

type TimeRange = "month" | "quarter" | "year" | "all"

export default function RevenueAnalyticsPage() {
  const router = useRouter()
  const supabase = createClient()
  const [timeRange, setTimeRange] = useState<TimeRange>("quarter")
  const [comparisonEnabled, setComparisonEnabled] = useState(true)
  const [restaurantId, setRestaurantId] = useState<string>("")

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

  // Get date range
  const getDateRange = () => {
    const now = new Date()
    switch (timeRange) {
      case "month":
        return {
          start: startOfMonth(now),
          end: endOfMonth(now),
          compareStart: startOfMonth(subMonths(now, 1)),
          compareEnd: endOfMonth(subMonths(now, 1)),
        }
      case "quarter":
        return {
          start: startOfMonth(subMonths(now, 2)),
          end: endOfMonth(now),
          compareStart: startOfMonth(subMonths(now, 5)),
          compareEnd: endOfMonth(subMonths(now, 3)),
        }
      case "year":
        return {
          start: startOfYear(now),
          end: now,
          compareStart: startOfYear(subMonths(now, 12)),
          compareEnd: subMonths(now, 12),
        }
      case "all":
        return {
          start: new Date("2020-01-01"),
          end: now,
          compareStart: null,
          compareEnd: null,
        }
    }
  }

  const dateRange = getDateRange()

  // Fetch revenue data
  const { data: revenueData, isLoading } = useQuery({
    queryKey: ["revenue-analytics", restaurantId, timeRange],
    queryFn: async () => {
      if (!restaurantId) return null

      // Fetch bookings for current period
      const { data: currentBookings, error: currentError } = await supabase
        .from("bookings")
        .select(`
          *,
          offer:special_offers(discount_percentage),
          loyalty_redemption:loyalty_transactions!booking_id(points)
        `)
        .eq("restaurant_id", restaurantId)
        .in("status", ["completed", "confirmed"])
        .gte("booking_time", dateRange.start.toISOString())
        .lte("booking_time", dateRange.end.toISOString())

      if (currentError) throw currentError

      // Fetch bookings for comparison period
      let compareBookings = null
      if (dateRange.compareStart && dateRange.compareEnd && comparisonEnabled) {
        const { data, error } = await supabase
          .from("bookings")
          .select(`
            *,
            offer:special_offers(discount_percentage)
          `)
          .eq("restaurant_id", restaurantId)
          .in("status", ["completed", "confirmed"])
          .gte("booking_time", dateRange.compareStart.toISOString())
          .lte("booking_time", dateRange.compareEnd.toISOString())

        if (!error) compareBookings = data
      }

      return {
        current: currentBookings || [],
        compare: compareBookings || [],
      }
    },
    enabled: !!restaurantId,
  })

  // Calculate metrics
  const calculateMetrics = () => {
    if (!revenueData) {
      return {
        totalRevenue: 0,
        averageOrderValue: 0,
        totalOrders: 0,
        revenueGrowth: 0,
        revenueTrend: [],
        revenueBySource: [],
        hourlyRevenue: [],
        discountImpact: 0,
        projectedRevenue: 0,
      }
    }

    const { current, compare } = revenueData
    
    // Calculate revenue (estimated at $50 per person)
    const PRICE_PER_PERSON = 50
    
    const currentRevenue = current.reduce((sum: number, booking: { party_size: number; offer: { discount_percentage: number } }) => {
      let revenue = booking.party_size * PRICE_PER_PERSON
      if (booking.offer?.discount_percentage) {
        revenue *= (1 - booking.offer.discount_percentage / 100)
      }
      return sum + revenue
    }, 0)

    const compareRevenue = compare.reduce((sum: number, booking: { party_size: number; offer: { discount_percentage: number } }) => {
      let revenue = booking.party_size * PRICE_PER_PERSON
      if (booking.offer?.discount_percentage) {
        revenue *= (1 - booking.offer.discount_percentage / 100)
      }
      return sum + revenue
    }, 0)

    const averageOrderValue = current.length > 0 ? currentRevenue / current.length : 0
    const revenueGrowth = compareRevenue > 0 
      ? ((currentRevenue - compareRevenue) / compareRevenue) * 100 
      : 0

    // Calculate revenue trend
    const days = timeRange === "year" 
      ? eachMonthOfInterval({ start: dateRange.start, end: dateRange.end })
      : eachDayOfInterval({ start: dateRange.start, end: dateRange.end })

    const revenueTrend = days.map(date => {
      const dayBookings = current.filter((booking: { booking_time: string | number | Date }) => {
        const bookingDate = new Date(booking.booking_time)
        return timeRange === "year"
          ? bookingDate.getMonth() === date.getMonth() && bookingDate.getFullYear() === date.getFullYear()
          : format(bookingDate, "yyyy-MM-dd") === format(date, "yyyy-MM-dd")
      })

      const dayRevenue = dayBookings.reduce((sum: number, booking: { party_size: number; offer: { discount_percentage: number } }) => {
        let revenue = booking.party_size * PRICE_PER_PERSON
        if (booking.offer?.discount_percentage) {
          revenue *= (1 - booking.offer.discount_percentage / 100)
        }
        return sum + revenue
      }, 0)

      return {
        date: format(date, timeRange === "year" ? "MMM yyyy" : "MMM dd"),
        revenue: dayRevenue,
        bookings: dayBookings.length,
      }
    })

    // Revenue by source
    const revenueBySource = [
      {
        name: "Direct Bookings",
        value: current.filter((b: { offer_id: any }) => !b.offer_id).length * PRICE_PER_PERSON,
        percentage: 0,
      },
      {
        name: "With Offers",
        value: current.filter((b: { offer_id: any }) => b.offer_id).reduce((sum: number, booking: { party_size: number; offer: { discount_percentage: number } }) => {
          let revenue = booking.party_size * PRICE_PER_PERSON
          if (booking.offer?.discount_percentage) {
            revenue *= (1 - booking.offer.discount_percentage / 100)
          }
          return sum + revenue
        }, 0),
        percentage: 0,
      },
      {
        name: "VIP Customers",
        value: current.filter((b: { is_vip_booking: any }) => b.is_vip_booking).length * PRICE_PER_PERSON * 1.2, // Assume VIPs spend 20% more
        percentage: 0,
      },
    ]

    const totalSourceRevenue = revenueBySource.reduce((sum, source) => sum + source.value, 0)
    revenueBySource.forEach(source => {
      source.percentage = totalSourceRevenue > 0 ? (source.value / totalSourceRevenue) * 100 : 0
    })

    // Hourly revenue distribution
    const hourlyRevenue = Array.from({ length: 24 }, (_, hour) => {
      const hourBookings = current.filter((booking: { booking_time: string | number | Date }) => {
        const bookingHour = new Date(booking.booking_time).getHours()
        return bookingHour === hour
      })

      const revenue = hourBookings.reduce((sum: number, booking: { party_size: number }) => {
        return sum + (booking.party_size * PRICE_PER_PERSON)
      }, 0)

      return {
        hour: `${hour}:00`,
        revenue,
        bookings: hourBookings.length,
      }
    }).filter(item => item.revenue > 0)

    // Calculate discount impact
    const fullRevenue = current.reduce((sum: number, booking: { party_size: number }) => {
      return sum + (booking.party_size * PRICE_PER_PERSON)
    }, 0)
    const discountImpact = fullRevenue - currentRevenue

    // Simple revenue projection (based on trend)
    const avgDailyRevenue = revenueTrend.length > 0
      ? revenueTrend.reduce((sum, day) => sum + day.revenue, 0) / revenueTrend.length
      : 0
    const projectedRevenue = avgDailyRevenue * 30 // Next 30 days

    return {
      totalRevenue: currentRevenue,
      averageOrderValue,
      totalOrders: current.length,
      revenueGrowth,
      revenueTrend,
      revenueBySource,
      hourlyRevenue,
      discountImpact,
      projectedRevenue,
    }
  }

  const metrics = calculateMetrics()

  // Chart colors
  const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6"]

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <Button
          variant="ghost"
          className="mb-4"
          onClick={() => router.push("/analytics")}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Analytics
        </Button>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Revenue Analytics</h1>
            <p className="text-muted-foreground">
              Deep dive into your restaurant's financial performance
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Select value={timeRange} onValueChange={(v) => setTimeRange(v as TimeRange)}>
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="month">This Month</SelectItem>
                <SelectItem value="quarter">Quarter</SelectItem>
                <SelectItem value="year">This Year</SelectItem>
                <SelectItem value="all">All Time</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline">
              <Download className="mr-2 h-4 w-4" />
              Export Report
            </Button>
          </div>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${metrics.totalRevenue.toLocaleString()}
            </div>
            {metrics.revenueGrowth !== 0 && (
              <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                {metrics.revenueGrowth > 0 ? (
                  <>
                    <ArrowUpRight className="h-3 w-3 text-green-600" />
                    <span className="text-green-600">+{metrics.revenueGrowth.toFixed(1)}%</span>
                  </>
                ) : (
                  <>
                    <ArrowDownRight className="h-3 w-3 text-red-600" />
                    <span className="text-red-600">{metrics.revenueGrowth.toFixed(1)}%</span>
                  </>
                )}
                vs last period
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Average Order Value</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${metrics.averageOrderValue.toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground">
              Per booking
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Discount Impact</CardTitle>
            <Percent className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${metrics.discountImpact.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">
              Revenue foregone
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Projected Revenue</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${metrics.projectedRevenue.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">
              Next 30 days
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Revenue Trend Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Revenue Trend</CardTitle>
          <CardDescription>
            Daily revenue and booking volume over time
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={400}>
            <ComposedChart data={metrics.revenueTrend}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis yAxisId="left" />
              <YAxis yAxisId="right" orientation="right" />
              <Tooltip formatter={(value: number) => `$${value.toLocaleString()}`} />
              <Legend />
              <Area
                yAxisId="left"
                type="monotone"
                dataKey="revenue"
                stroke="#3b82f6"
                fill="#3b82f6"
                fillOpacity={0.6}
                name="Revenue"
              />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="bookings"
                stroke="#10b981"
                strokeWidth={2}
                dot={{ r: 3 }}
                name="Bookings"
              />
            </ComposedChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        {/* Revenue by Source */}
        <Card>
          <CardHeader>
            <CardTitle>Revenue by Source</CardTitle>
            <CardDescription>
              Breakdown of revenue sources
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={metrics.revenueBySource}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percentage }) => `${name}: ${percentage.toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {metrics.revenueBySource.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: number) => `$${value.toLocaleString()}`} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Peak Hours Revenue */}
        <Card>
          <CardHeader>
            <CardTitle>Revenue by Hour</CardTitle>
            <CardDescription>
              Identify your most profitable hours
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={metrics.hourlyRevenue}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="hour" />
                <YAxis />
                <Tooltip formatter={(value: number) => `$${value.toLocaleString()}`} />
                <Bar dataKey="revenue" fill="#f59e0b" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Revenue Insights */}
      <Card>
        <CardHeader>
          <CardTitle>Revenue Insights</CardTitle>
          <CardDescription>
            Key findings and recommendations
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {metrics.revenueGrowth > 10 && (
              <div className="flex items-start gap-3">
                <div className="mt-1">
                  <TrendingUp className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <h4 className="font-semibold">Strong Revenue Growth</h4>
                  <p className="text-sm text-muted-foreground">
                    Your revenue has increased by {metrics.revenueGrowth.toFixed(1)}% compared to the previous period. 
                    This indicates successful marketing efforts or seasonal demand.
                  </p>
                </div>
              </div>
            )}

            {metrics.discountImpact > metrics.totalRevenue * 0.2 && (
              <div className="flex items-start gap-3">
                <div className="mt-1">
                  <Percent className="h-5 w-5 text-amber-600" />
                </div>
                <div>
                  <h4 className="font-semibold">High Discount Impact</h4>
                  <p className="text-sm text-muted-foreground">
                    Discounts are reducing your revenue by ${metrics.discountImpact.toLocaleString()}. 
                    Consider optimizing your offer strategy to balance customer acquisition with profitability.
                  </p>
                </div>
              </div>
            )}

            {metrics.hourlyRevenue.length > 0 && (
              <div className="flex items-start gap-3">
                <div className="mt-1">
                  <Clock className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <h4 className="font-semibold">Peak Revenue Hours</h4>
                  <p className="text-sm text-muted-foreground">
                    Your highest revenue hours are {
                      metrics.hourlyRevenue
                        .sort((a, b) => b.revenue - a.revenue)
                        .slice(0, 3)
                        .map(h => h.hour)
                        .join(", ")
                    }. Consider staffing and inventory optimization during these times.
                  </p>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}