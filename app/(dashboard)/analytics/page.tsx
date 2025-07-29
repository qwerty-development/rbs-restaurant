// app/(dashboard)/analytics/page.tsx
"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { useQuery } from "@tanstack/react-query"
import { 
  startOfMonth, 
  endOfMonth, 
  startOfWeek, 
  endOfWeek,
  subMonths,
  eachDayOfInterval,
  format,
  isSameMonth,
  subDays
} from "date-fns"
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
import {
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
} from "recharts"
import { 
  TrendingUp, 
  TrendingDown, 
  Users, 
  DollarSign, 
  Calendar,
  Clock,
  Utensils,
  Download,
  Filter
} from "lucide-react"
import { Separator } from "@/components/ui/separator"

export default function AnalyticsPage() {
  const [timeRange, setTimeRange] = useState("month")
  const [selectedMonth, setSelectedMonth] = useState(new Date())
  const supabase = createClient()

  // Get restaurant ID
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

  // Date ranges
  const getDateRange = () => {
    const now = new Date()
    switch (timeRange) {
      case "week":
        return {
          start: startOfWeek(now),
          end: endOfWeek(now),
        }
      case "month":
        return {
          start: startOfMonth(selectedMonth),
          end: endOfMonth(selectedMonth),
        }
      case "quarter":
        return {
          start: startOfMonth(subMonths(now, 2)),
          end: endOfMonth(now),
        }
      default:
        return {
          start: startOfMonth(now),
          end: endOfMonth(now),
        }
    }
  }

  const dateRange = getDateRange()

  // Fetch analytics data
  const { data: analyticsData, isLoading } = useQuery({
    queryKey: ["analytics", restaurantId, timeRange, selectedMonth],
    queryFn: async () => {
      if (!restaurantId) return null

      // Fetch bookings data
      const { data: bookings, error: bookingsError } = await supabase
        .from("bookings")
        .select(`
          *,
          user:profiles(full_name, membership_tier),
          tables:booking_tables(
            table:restaurant_tables(table_type)
          )
        `)
        .eq("restaurant_id", restaurantId)
        .gte("booking_time", dateRange.start.toISOString())
        .lte("booking_time", dateRange.end.toISOString())
        .order("booking_time", { ascending: true })

      if (bookingsError) throw bookingsError

      // Fetch reviews data
      const { data: reviews, error: reviewsError } = await supabase
        .from("reviews")
        .select("rating, created_at")
        .eq("restaurant_id", restaurantId)
        .gte("created_at", dateRange.start.toISOString())
        .lte("created_at", dateRange.end.toISOString())

      if (reviewsError) throw reviewsError

      return { bookings: bookings || [], reviews: reviews || [] }
    },
    enabled: !!restaurantId,
  })

  // Calculate metrics
  const calculateMetrics = () => {
    if (!analyticsData) {
      return {
        totalBookings: 0,
        totalRevenue: 0,
        averagePartySize: 0,
        occupancyRate: 0,
        repeatCustomers: 0,
        averageRating: 0,
        bookingsByStatus: {},
        bookingsByHour: [],
        bookingsByDay: [],
        revenueByDay: [],
        tableTypeDistribution: [],
        customerTierDistribution: [],
        customerBookings: {},
      }
    }

    const { bookings, reviews } = analyticsData

    // Basic metrics
    const totalBookings = bookings.length
    const completedBookings = bookings.filter((b: { status: string }) => b.status === "completed")
    const totalRevenue = completedBookings.reduce((sum: number, b: { party_size: number }) => sum + (b.party_size * 50), 0) // Estimated $50 per person
    const averagePartySize = bookings.length > 0 
      ? bookings.reduce((sum: any, b: { party_size: any }) => sum + b.party_size, 0) / bookings.length 
      : 0
    const averageRating = reviews.length > 0
      ? reviews.reduce((sum: any, r: { rating: any }) => sum + r.rating, 0) / reviews.length
      : 0

    // Bookings by status
    const bookingsByStatus = bookings.reduce((acc: { [x: string]: any }, booking: { status: string | number }) => {
      acc[booking.status] = (acc[booking.status] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    // Bookings by hour
    const bookingsByHour = Array.from({ length: 24 }, (_, hour) => {
      const count = bookings.filter((b: { booking_time: string | number | Date }) => {
        const bookingHour = new Date(b.booking_time).getHours()
        return bookingHour === hour
      }).length
      return { hour: `${hour}:00`, bookings: count }
    }).filter(item => item.bookings > 0)

    // Bookings by day
    const days = eachDayOfInterval({ start: dateRange.start, end: dateRange.end })
    const bookingsByDay = days.map(day => {
      const dayBookings = bookings.filter((b: { booking_time: string | number | Date }) => {
        const bookingDate = new Date(b.booking_time)
        return format(bookingDate, "yyyy-MM-dd") === format(day, "yyyy-MM-dd")
      })
      return {
        date: format(day, "MMM dd"),
        bookings: dayBookings.length,
        revenue: dayBookings
          .filter((b: { status: string }) => b.status === "completed")
          .reduce((sum: number, b: { party_size: number }) => sum + (b.party_size * 50), 0),
      }
    })

    // Table type distribution
    const tableTypes = bookings.reduce((acc: { [x: string]: any }, booking: { tables: string | any[] }) => {
      if (booking.tables && booking.tables.length > 0) {
        const tableType = booking.tables[0].table?.table_type || "unknown"
        acc[tableType] = (acc[tableType] || 0) + 1
      }
      return acc
    }, {} as Record<string, number>)

    const tableTypeDistribution = Object.entries(tableTypes).map(([type, count]) => ({
      name: type.charAt(0).toUpperCase() + type.slice(1),
      value: count,
    }))

    // Customer tier distribution
    const tierCounts = bookings.reduce((acc: { [x: string]: any }, booking: { user: { membership_tier: string } }) => {
      const tier = booking.user?.membership_tier || "none"
      acc[tier] = (acc[tier] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    const customerTierDistribution = Object.entries(tierCounts).map(([tier, count]) => ({
      name: tier.charAt(0).toUpperCase() + tier.slice(1),
      value: count,
    }))

    // Repeat customers
    const customerBookings = bookings.reduce((acc: { [x: string]: any }, booking: { user_id: string | number }) => {
      if (booking.user_id) {
        acc[booking.user_id] = (acc[booking.user_id] || 0) + 1
      }
      return acc
    }, {} as Record<string, number>)
    const repeatCustomers = Object.values(customerBookings).filter((count:any) => count > 1).length

    return {
      totalBookings,
      totalRevenue,
      averagePartySize: Math.round(averagePartySize * 10) / 10,
      occupancyRate: Math.round((completedBookings.length / totalBookings) * 100),
      repeatCustomers,
      averageRating: Math.round(averageRating * 10) / 10,
      bookingsByStatus,
      bookingsByHour,
      bookingsByDay,
      tableTypeDistribution,
      customerTierDistribution,
      customerBookings,
    }
  }

  const metrics = calculateMetrics()

  // Colors for charts
  const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899"]

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
        <div className="flex items-center gap-2">
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="week">This Week</SelectItem>
              <SelectItem value="month">This Month</SelectItem>
              <SelectItem value="quarter">Quarter</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline">
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Bookings</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.totalBookings}</div>
            <p className="text-xs text-muted-foreground">
              {metrics.bookingsByStatus.completed || 0} completed
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${metrics.totalRevenue.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">
              Estimated revenue
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Party Size</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.averagePartySize}</div>
            <p className="text-xs text-muted-foreground">
              Guests per booking
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Rating</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.averageRating}</div>
            <p className="text-xs text-muted-foreground">
              Out of 5.0
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="bookings" className="space-y-4">
        <TabsList>
          <TabsTrigger value="bookings">Bookings</TabsTrigger>
          <TabsTrigger value="revenue">Revenue</TabsTrigger>
          <TabsTrigger value="customers">Customers</TabsTrigger>
          <TabsTrigger value="operations">Operations</TabsTrigger>
        </TabsList>

        <TabsContent value="bookings" className="space-y-4">
          {/* Bookings Over Time */}
          <Card>
            <CardHeader>
              <CardTitle>Bookings Trend</CardTitle>
              <CardDescription>
                Daily booking volume over the selected period
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={metrics.bookingsByDay}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Line 
                    type="monotone" 
                    dataKey="bookings" 
                    stroke="#3b82f6" 
                    strokeWidth={2}
                    dot={{ r: 4 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <div className="grid gap-4 md:grid-cols-2">
            {/* Booking Status Distribution */}
            <Card>
              <CardHeader>
                <CardTitle>Booking Status</CardTitle>
                <CardDescription>
                  Distribution by booking status
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={Object.entries(metrics.bookingsByStatus).map(([status, count]) => ({
                        name: status.replace(/_/g, " "),
                        value: count,
                      }))}
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                      label
                    >
                      {Object.entries(metrics.bookingsByStatus).map((_, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Peak Hours */}
            <Card>
              <CardHeader>
                <CardTitle>Peak Hours</CardTitle>
                <CardDescription>
                  Bookings by hour of day
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={metrics.bookingsByHour}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="hour" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="bookings" fill="#10b981" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="revenue" className="space-y-4">
          {/* Revenue Over Time */}
          <Card>
            <CardHeader>
              <CardTitle>Revenue Trend</CardTitle>
              <CardDescription>
                Daily revenue over the selected period
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={metrics.bookingsByDay}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip formatter={(value) => `$${value}`} />
                  <Line 
                    type="monotone" 
                    dataKey="revenue" 
                    stroke="#10b981" 
                    strokeWidth={2}
                    dot={{ r: 4 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Revenue Metrics */}
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Average Order Value</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  ${Math.round(metrics.totalRevenue / (metrics.bookingsByStatus.completed || 1))}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Per completed booking
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Revenue per Guest</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">$50</div>
                <p className="text-xs text-muted-foreground mt-1">
                  Average spend
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Occupancy Rate</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{metrics.occupancyRate}%</div>
                <p className="text-xs text-muted-foreground mt-1">
                  Completed bookings
                </p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="customers" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {/* Customer Tier Distribution */}
            <Card>
              <CardHeader>
                <CardTitle>Customer Tiers</CardTitle>
                <CardDescription>
                  Distribution by loyalty tier
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={metrics.customerTierDistribution}
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                      label
                    >
                      {metrics.customerTierDistribution.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Customer Metrics */}
            <Card>
              <CardHeader>
                <CardTitle>Customer Insights</CardTitle>
                <CardDescription>
                  Key customer metrics
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Repeat Customers</span>
                    <span className="text-2xl font-bold">{metrics.repeatCustomers}</span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Customers with multiple bookings
                  </div>
                </div>
                <Separator />
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">New Customers</span>
                    <span className="text-2xl font-bold">
                      {Object.keys(metrics.customerBookings || {}).length - metrics.repeatCustomers}
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    First-time diners
                  </div>
                </div>
                <Separator />
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Guest Bookings</span>
                    <span className="text-2xl font-bold">
                      {analyticsData?.bookings.filter((b: { user_id: any }) => !b.user_id).length || 0}
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Non-registered customers
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="operations" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {/* Table Type Usage */}
            <Card>
              <CardHeader>
                <CardTitle>Table Usage</CardTitle>
                <CardDescription>
                  Distribution by table type
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={metrics.tableTypeDistribution}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="value" fill="#f59e0b" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Operational Metrics */}
            <Card>
              <CardHeader>
                <CardTitle>Operational Efficiency</CardTitle>
                <CardDescription>
                  Key operational metrics
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">No Show Rate</span>
                    <span className="text-2xl font-bold">
                      {Math.round(((metrics.bookingsByStatus.no_show || 0) / metrics.totalBookings) * 100)}%
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Bookings marked as no-show
                  </div>
                </div>
                <Separator />
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Cancellation Rate</span>
                    <span className="text-2xl font-bold">
                      {Math.round(((metrics.bookingsByStatus.cancelled_by_user || 0) / metrics.totalBookings) * 100)}%
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    User-initiated cancellations
                  </div>
                </div>
                <Separator />
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Avg Turn Time</span>
                    <span className="text-2xl font-bold">120 min</span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Average dining duration
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}