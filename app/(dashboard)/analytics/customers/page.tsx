// app/(dashboard)/analytics/customers/page.tsx
"use client"

import { useState, useEffect, JSXElementConstructor, Key, ReactElement, ReactNode, ReactPortal } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { useQuery } from "@tanstack/react-query"
import { 
  startOfMonth, 
  endOfMonth, 
  subMonths,
  format,
  differenceInDays
} from "date-fns"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
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
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ScatterChart,
  Scatter,
} from "recharts"
import { 
  Users,
  UserPlus,
  UserCheck,
  Star,
  TrendingUp,
  Calendar,
  Download,
  ArrowLeft,
  Heart,
  AlertCircle,
  Clock,
  Repeat
} from "lucide-react"

type TimeRange = "month" | "quarter" | "year"
type CustomerSegment = "new" | "returning" | "vip" | "at_risk" | "lost"

export default function CustomerAnalyticsPage() {
  const router = useRouter()
  const supabase = createClient()
  const [timeRange, setTimeRange] = useState<TimeRange>("quarter")
  const [selectedSegment, setSelectedSegment] = useState<CustomerSegment | "all">("all")
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
        }
      case "quarter":
        return {
          start: startOfMonth(subMonths(now, 2)),
          end: endOfMonth(now),
        }
      case "year":
        return {
          start: startOfMonth(subMonths(now, 11)),
          end: endOfMonth(now),
        }
    }
  }

  const dateRange = getDateRange()

  // Fetch customer data
  const { data: customerData, isLoading } = useQuery({
    queryKey: ["customer-analytics", restaurantId, timeRange],
    queryFn: async () => {
      if (!restaurantId) return null

      // Fetch all bookings
      const { data: bookings, error: bookingsError } = await supabase
        .from("bookings")
        .select(`
          *,
          user:profiles(
            id,
            full_name,
            email,
            created_at,
            membership_tier,
            loyalty_points
          ),
          reviews:reviews(rating)
        `)
        .eq("restaurant_id", restaurantId)
        .gte("booking_time", dateRange.start.toISOString())
        .lte("booking_time", dateRange.end.toISOString())

      if (bookingsError) throw bookingsError

      // Fetch VIP users
      const { data: vipUsers, error: vipError } = await supabase
        .from("restaurant_vip_users")
        .select("user_id")
        .eq("restaurant_id", restaurantId)
        .gte("valid_until", new Date().toISOString())

      if (vipError) throw vipError

      // Fetch all-time customer stats
      const { data: allTimeStats, error: statsError } = await supabase
        .from("bookings")
        .select(`
          user_id,
          status,
          created_at,
          party_size
        `)
        .eq("restaurant_id", restaurantId)
        .not("user_id", "is", null)

      if (statsError) throw statsError

      return {
        bookings: bookings || [],
        vipUsers: vipUsers || [],
        allTimeStats: allTimeStats || [],
      }
    },
    enabled: !!restaurantId,
  })

  // Calculate customer metrics
  const calculateMetrics = () => {
    if (!customerData) {
      return {
        totalCustomers: 0,
        newCustomers: 0,
        returningCustomers: 0,
        vipCustomers: 0,
        averageLifetimeValue: 0,
        customerRetentionRate: 0,
        averageVisitFrequency: 0,
        customerSatisfaction: 0,
        segmentDistribution: [],
        acquisitionTrend: [],
        cohortRetention: [],
        visitFrequencyDistribution: [],
        topCustomers: [],
        customerLifecycle: [],
      }
    }

    const { bookings, vipUsers, allTimeStats } = customerData
    const vipUserIds = new Set(vipUsers.map((v: { user_id: any }) => v.user_id))

    // Get unique customers
    const uniqueCustomers = new Map()
    const customerStats = new Map()

    bookings.forEach((booking: { user_id: any; user: any; created_at: any }) => {
      if (!booking.user_id) return
      
      if (!uniqueCustomers.has(booking.user_id)) {
        uniqueCustomers.set(booking.user_id, {
          ...booking.user,
          firstBooking: booking.created_at,
          bookings: [],
        })
      }
      
      uniqueCustomers.get(booking.user_id).bookings.push(booking)
    })

    // Calculate all-time stats per customer
    allTimeStats.forEach((booking: { user_id: any; created_at: any; party_size: any }) => {
      if (!customerStats.has(booking.user_id)) {
        customerStats.set(booking.user_id, {
          totalBookings: 0,
          totalGuests: 0,
          firstVisit: booking.created_at,
          lastVisit: booking.created_at,
        })
      }
      
      const stats = customerStats.get(booking.user_id)
      stats.totalBookings++
      stats.totalGuests += booking.party_size
      stats.lastVisit = booking.created_at
    })

    // Segment customers
    const segments = {
      new: 0,
      returning: 0,
      vip: 0,
      at_risk: 0,
      lost: 0,
    }

    const now = new Date()
    uniqueCustomers.forEach((customer, userId) => {
      const stats = customerStats.get(userId)
      if (!stats) return

      const daysSinceLastVisit = differenceInDays(now, new Date(stats.lastVisit))
      const isNew = stats.totalBookings === 1
      const isVip = vipUserIds.has(userId)

      if (isVip) {
        segments.vip++
      } else if (isNew) {
        segments.new++
      } else if (daysSinceLastVisit > 90) {
        segments.lost++
      } else if (daysSinceLastVisit > 60) {
        segments.at_risk++
      } else {
        segments.returning++
      }
    })

    // Calculate metrics
    const totalCustomers = uniqueCustomers.size
    const newCustomersCount = Array.from(uniqueCustomers.values()).filter(c => 
      c.bookings.length === 1
    ).length

    // Customer retention rate (customers with >1 booking)
    const returningCustomersCount = Array.from(uniqueCustomers.values()).filter(c => 
      c.bookings.length > 1
    ).length
    const customerRetentionRate = totalCustomers > 0 
      ? (returningCustomersCount / totalCustomers) * 100 
      : 0

    // Average lifetime value (simplified: avg bookings * avg party size * price per person)
    const avgBookingsPerCustomer = bookings.length / totalCustomers
    const avgPartySize = bookings.reduce((sum: any, b: { party_size: any }) => sum + b.party_size, 0) / bookings.length
    const averageLifetimeValue = avgBookingsPerCustomer * avgPartySize * 50 // $50 per person

    // Customer satisfaction (average rating)
    const ratingsCount = bookings.filter((b: { reviews: string | any[] }) => b.reviews?.length > 0).length
    const totalRating = bookings.reduce((sum: any, b: { reviews: { rating: any }[] }) => 
      sum + (b.reviews?.[0]?.rating || 0), 0
    )
    const customerSatisfaction = ratingsCount > 0 ? totalRating / ratingsCount : 0

    // Visit frequency (bookings per customer per month)
    const monthsInRange = Math.max(1, Math.ceil(
      (dateRange.end.getTime() - dateRange.start.getTime()) / (30 * 24 * 60 * 60 * 1000)
    ))
    const averageVisitFrequency = (bookings.length / totalCustomers) / monthsInRange

    // Segment distribution for pie chart
    const segmentDistribution = Object.entries(segments).map(([segment, count]) => ({
      name: segment.charAt(0).toUpperCase() + segment.slice(1).replace('_', ' '),
      value: count,
      percentage: totalCustomers > 0 ? (count / totalCustomers) * 100 : 0,
    }))

    // Customer acquisition trend (new customers per month)
    const acquisitionTrend = []
    for (let i = 0; i < 12; i++) {
      const monthStart = startOfMonth(subMonths(now, i))
      const monthEnd = endOfMonth(subMonths(now, i))
      
      const newInMonth = Array.from(customerStats.values()).filter(stats => {
        const firstVisit = new Date(stats.firstVisit)
        return firstVisit >= monthStart && firstVisit <= monthEnd
      }).length

      acquisitionTrend.unshift({
        month: format(monthStart, "MMM"),
        newCustomers: newInMonth,
      })
    }

    // Visit frequency distribution
    const frequencyBuckets = {
      "1 visit": 0,
      "2-3 visits": 0,
      "4-6 visits": 0,
      "7+ visits": 0,
    }

    customerStats.forEach(stats => {
      if (stats.totalBookings === 1) frequencyBuckets["1 visit"]++
      else if (stats.totalBookings <= 3) frequencyBuckets["2-3 visits"]++
      else if (stats.totalBookings <= 6) frequencyBuckets["4-6 visits"]++
      else frequencyBuckets["7+ visits"]++
    })

    const visitFrequencyDistribution = Object.entries(frequencyBuckets).map(([range, count]) => ({
      range,
      count,
      percentage: customerStats.size > 0 ? (count / customerStats.size) * 100 : 0,
    }))

    // Top customers
    const topCustomers = Array.from(uniqueCustomers.entries())
      .map(([userId, customer]) => ({
        id: userId,
        ...customer,
        totalBookings: customer.bookings.length,
        totalSpent: customer.bookings.reduce((sum: number, b: { party_size: number }) => sum + (b.party_size * 50), 0),
        avgRating: customer.bookings.filter((b: { reviews: string | any[] }) => b.reviews?.length > 0).length > 0
          ? customer.bookings.reduce((sum: any, b: { reviews: { rating: any }[] }) => sum + (b.reviews?.[0]?.rating || 0), 0) / 
            customer.bookings.filter((b: { reviews: string | any[] }) => b.reviews?.length > 0).length
          : 0,
      }))
      .sort((a, b) => b.totalSpent - a.totalSpent)
      .slice(0, 10)

    // Customer lifecycle stages
    const customerLifecycle = [
      { stage: "Acquisition", value: segments.new },
      { stage: "Activation", value: segments.returning },
      { stage: "Retention", value: segments.vip },
      { stage: "At Risk", value: segments.at_risk },
      { stage: "Reactivation", value: segments.lost },
    ]

    return {
      totalCustomers,
      newCustomers: newCustomersCount,
      returningCustomers: returningCustomersCount,
      vipCustomers: segments.vip,
      averageLifetimeValue,
      customerRetentionRate,
      averageVisitFrequency,
      customerSatisfaction,
      segmentDistribution,
      acquisitionTrend,
      visitFrequencyDistribution,
      topCustomers,
      customerLifecycle,
      segments,
    }
  }

  const metrics:any = calculateMetrics()

  // Chart colors
  const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6"]

  const getSegmentColor = (segment: string) => {
    switch (segment.toLowerCase()) {
      case "new": return "#10b981"
      case "returning": return "#3b82f6"
      case "vip": return "#f59e0b"
      case "at risk": return "#ef4444"
      case "lost": return "#6b7280"
      default: return "#8b5cf6"
    }
  }

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
            <h1 className="text-3xl font-bold tracking-tight">Customer Analytics</h1>
            <p className="text-muted-foreground">
              Understand your customer base and behavior patterns
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
              </SelectContent>
            </Select>
            <Button variant="outline">
              <Download className="mr-2 h-4 w-4" />
              Export
            </Button>
          </div>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Customers</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.totalCustomers}</div>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant="secondary" className="text-xs">
                <UserPlus className="mr-1 h-3 w-3" />
                {metrics.newCustomers} new
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Retention Rate</CardTitle>
            <Repeat className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {metrics.customerRetentionRate.toFixed(1)}%
            </div>
            <Progress value={metrics.customerRetentionRate} className="mt-2" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Lifetime Value</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${metrics.averageLifetimeValue.toFixed(0)}
            </div>
            <p className="text-xs text-muted-foreground">
              Per customer
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Satisfaction</CardTitle>
            <Star className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold flex items-center gap-1">
              {metrics.customerSatisfaction.toFixed(1)}
              <Star className="h-5 w-5 fill-yellow-400 text-yellow-400" />
            </div>
            <p className="text-xs text-muted-foreground">
              Average rating
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Customer Segments */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Customer Segments</CardTitle>
            <CardDescription>
              Distribution of your customer base
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={metrics.segmentDistribution}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percentage }) => `${name}: ${percentage.toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {metrics.segmentDistribution.map((entry: { name: string }, index: any) => (
                    <Cell key={`cell-${index}`} fill={getSegmentColor(entry.name)} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
            
            {/* Segment Details */}
            <div className="mt-4 space-y-2">
              {Object.entries(metrics.segments).map(([segment, count]:any) => (
                <div key={segment} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div 
                      className="h-3 w-3 rounded-full" 
                      style={{ backgroundColor: getSegmentColor(segment) }}
                    />
                    <span className="text-sm capitalize">
                      {segment.replace('_', ' ')}
                    </span>
                  </div>
                  <Badge variant="secondary">{count}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Customer Acquisition</CardTitle>
            <CardDescription>
              New customers acquired over time
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={metrics.acquisitionTrend}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip />
                <Line 
                  type="monotone" 
                  dataKey="newCustomers" 
                  stroke="#10b981" 
                  strokeWidth={2}
                  dot={{ r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Visit Frequency & Lifecycle */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Visit Frequency</CardTitle>
            <CardDescription>
              How often customers visit your restaurant
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={metrics.visitFrequencyDistribution}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="range" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="count" fill="#3b82f6" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Customer Lifecycle</CardTitle>
            <CardDescription>
              Distribution across lifecycle stages
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <RadarChart data={metrics.customerLifecycle}>
                <PolarGrid />
                <PolarAngleAxis dataKey="stage" />
                <PolarRadiusAxis />
                <Radar 
                  name="Customers" 
                  dataKey="value" 
                  stroke="#8b5cf6" 
                  fill="#8b5cf6" 
                  fillOpacity={0.6} 
                />
                <Tooltip />
              </RadarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Top Customers */}
      <Card>
        <CardHeader>
          <CardTitle>Top Customers</CardTitle>
          <CardDescription>
            Your most valuable customers by total spend
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Customer</TableHead>
                <TableHead>Total Bookings</TableHead>
                <TableHead>Total Spent</TableHead>
                <TableHead>Avg Rating</TableHead>
                <TableHead>Member Since</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {metrics.topCustomers.map((customer:any) => (
                <TableRow key={customer.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={customer.avatar_url} />
                        <AvatarFallback>
                          {customer.full_name?.split(" ").map((n: any[]) => n[0]).join("")}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="font-medium">{customer.full_name}</div>
                        <div className="text-sm text-muted-foreground">
                          {customer.email}
                        </div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>{customer.totalBookings}</TableCell>
                  <TableCell>${customer.totalSpent.toLocaleString()}</TableCell>
                  <TableCell>
                    {customer.avgRating > 0 ? (
                      <div className="flex items-center gap-1">
                        {customer.avgRating.toFixed(1)}
                        <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                      </div>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {format(new Date(customer.created_at), "MMM yyyy")}
                  </TableCell>
                  <TableCell>
                    <Badge variant={customer.membership_tier === "vip" ? "default" : "secondary"}>
                      {customer.membership_tier || "Regular"}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Customer Insights */}
      <Card>
        <CardHeader>
          <CardTitle>Customer Insights</CardTitle>
          <CardDescription>
            Key findings and recommendations
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {metrics.segments.at_risk > metrics.totalCustomers * 0.2 && (
              <div className="flex items-start gap-3">
                <div className="mt-1">
                  <AlertCircle className="h-5 w-5 text-amber-600" />
                </div>
                <div>
                  <h4 className="font-semibold">High Number of At-Risk Customers</h4>
                  <p className="text-sm text-muted-foreground">
                    {metrics.segments.at_risk} customers haven't visited in 60+ days. 
                    Consider running a re-engagement campaign with special offers.
                  </p>
                </div>
              </div>
            )}

            {metrics.customerRetentionRate < 30 && (
              <div className="flex items-start gap-3">
                <div className="mt-1">
                  <Repeat className="h-5 w-5 text-red-600" />
                </div>
                <div>
                  <h4 className="font-semibold">Low Retention Rate</h4>
                  <p className="text-sm text-muted-foreground">
                    Only {metrics.customerRetentionRate.toFixed(1)}% of customers return. 
                    Focus on improving the dining experience and implementing a loyalty program.
                  </p>
                </div>
              </div>
            )}

            {metrics.customerSatisfaction >= 4.5 && (
              <div className="flex items-start gap-3">
                <div className="mt-1">
                  <Heart className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <h4 className="font-semibold">Excellent Customer Satisfaction</h4>
                  <p className="text-sm text-muted-foreground">
                    Your {metrics.customerSatisfaction.toFixed(1)} average rating shows customers love your restaurant. 
                    Leverage this in marketing and encourage reviews.
                  </p>
                </div>
              </div>
            )}

            {metrics.averageVisitFrequency < 1 && (
              <div className="flex items-start gap-3">
                <div className="mt-1">
                  <Clock className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <h4 className="font-semibold">Increase Visit Frequency</h4>
                  <p className="text-sm text-muted-foreground">
                    Customers visit less than once per month on average. 
                    Consider weekday specials or lunch deals to increase frequency.
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