// app/(dashboard)/dashboard/analytics/page.tsx
"use client"
export const dynamic = 'force-dynamic'

import { useState, useMemo } from "react"
import { useQuery } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import { useRestaurantContext } from "@/lib/contexts/restaurant-context"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { 
  BarChart3, 
  TrendingUp, 
  TrendingDown,
  Users, 
  Calendar, 
  DollarSign, 
  Building2,
  Target,
  Clock,
  Star,
  Percent,
  ArrowUp,
  ArrowDown,
  Filter
} from "lucide-react"
import { cn } from "@/lib/utils"
import { format, subDays, startOfDay, endOfDay } from "date-fns"

export default function AnalyticsPage() {
  const { restaurants, currentRestaurant, isMultiRestaurant } = useRestaurantContext()
  const [timeframe, setTimeframe] = useState<"7d" | "30d" | "90d">("30d")
  const [compareMode, setCompareMode] = useState<boolean>(false)
  
  const supabase = createClient()

  // If single restaurant, show that restaurant's analytics
  // If multi restaurant, show consolidated analytics across all restaurants
  const analyticsMode = isMultiRestaurant && !currentRestaurant ? "consolidated" : "single"
  const targetRestaurantIds = analyticsMode === "consolidated" 
    ? restaurants.map(r => r.restaurant.id)
    : currentRestaurant ? [currentRestaurant.restaurant.id] : []

  // Analytics data query
  const { data: analyticsData, isLoading } = useQuery({
    queryKey: ["analytics", targetRestaurantIds, timeframe],
    queryFn: async () => {
      if (targetRestaurantIds.length === 0) return null

      const days = parseInt(timeframe.replace('d', ''))
      const startDate = format(startOfDay(subDays(new Date(), days)), 'yyyy-MM-dd')
      const endDate = format(endOfDay(new Date()), 'yyyy-MM-dd')

      // Fetch bookings data
      const { data: bookingsData, error: bookingsError } = await supabase
        .from('bookings')
        .select(`
          id,
          restaurant_id,
          status,
          party_size,
          booking_time,
          created_at,
          restaurant:restaurants(name)
        `)
        .in('restaurant_id', targetRestaurantIds)
        .gte('booking_time', startDate)
        .lte('booking_time', endDate)

      if (bookingsError) throw bookingsError

      // Fetch restaurants info for comparison
      const { data: restaurantsInfo, error: restaurantsError } = await supabase
        .from('restaurants')
        .select('id, name, created_at')
        .in('id', targetRestaurantIds)

      if (restaurantsError) throw restaurantsError

      // Calculate analytics per restaurant
      const restaurantAnalytics = restaurantsInfo.map(restaurant => {
        const restaurantBookings = bookingsData?.filter(b => b.restaurant_id === restaurant.id) || []
        
        const totalBookings = restaurantBookings.length
        const confirmedBookings = restaurantBookings.filter(b => b.status === 'confirmed').length
        const completedBookings = restaurantBookings.filter(b => b.status === 'completed').length
        const cancelledBookings = restaurantBookings.filter(b => 
          ['cancelled_by_user', 'cancelled_by_restaurant', 'no_show'].includes(b.status)
        ).length
        const pendingBookings = restaurantBookings.filter(b => b.status === 'pending').length
        
        const totalGuests = restaurantBookings.reduce((sum, b) => sum + b.party_size, 0)
        const averagePartySize = totalBookings > 0 ? totalGuests / totalBookings : 0
        
        // Revenue estimation (rough calculation)
        const estimatedRevenue = completedBookings * 85
        
        // Conversion rate
        const conversionRate = totalBookings > 0 ? (confirmedBookings + completedBookings) / totalBookings * 100 : 0
        
        // Daily breakdown
        const dailyData = Array.from({ length: days }, (_, i) => {
          const date = format(subDays(new Date(), days - 1 - i), 'yyyy-MM-dd')
          const dayBookings = restaurantBookings.filter(b => 
            format(new Date(b.booking_time), 'yyyy-MM-dd') === date
          )
          return {
            date,
            bookings: dayBookings.length,
            guests: dayBookings.reduce((sum, b) => sum + b.party_size, 0),
            revenue: dayBookings.filter(b => b.status === 'completed').length * 85
          }
        })

        return {
          restaurant,
          metrics: {
            totalBookings,
            confirmedBookings,
            completedBookings,
            cancelledBookings,
            pendingBookings,
            totalGuests,
            averagePartySize,
            estimatedRevenue,
            conversionRate,
          },
          dailyData
        }
      })

      // Consolidated metrics
      const consolidated = {
        totalBookings: restaurantAnalytics.reduce((sum, r) => sum + r.metrics.totalBookings, 0),
        confirmedBookings: restaurantAnalytics.reduce((sum, r) => sum + r.metrics.confirmedBookings, 0),
        completedBookings: restaurantAnalytics.reduce((sum, r) => sum + r.metrics.completedBookings, 0),
        cancelledBookings: restaurantAnalytics.reduce((sum, r) => sum + r.metrics.cancelledBookings, 0),
        pendingBookings: restaurantAnalytics.reduce((sum, r) => sum + r.metrics.pendingBookings, 0),
        totalGuests: restaurantAnalytics.reduce((sum, r) => sum + r.metrics.totalGuests, 0),
        estimatedRevenue: restaurantAnalytics.reduce((sum, r) => sum + r.metrics.estimatedRevenue, 0),
        averagePartySize: 0,
        conversionRate: 0,
      }

      consolidated.averagePartySize = consolidated.totalBookings > 0 
        ? consolidated.totalGuests / consolidated.totalBookings 
        : 0

      consolidated.conversionRate = consolidated.totalBookings > 0 
        ? (consolidated.confirmedBookings + consolidated.completedBookings) / consolidated.totalBookings * 100 
        : 0

      return {
        restaurants: restaurantAnalytics,
        consolidated,
        timeframe: { days, startDate, endDate }
      }
    },
    enabled: targetRestaurantIds.length > 0,
    refetchInterval: 60000, // Refresh every minute
  })

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background to-card flex items-center justify-center">
        <div className="text-center">
          <BarChart3 className="h-16 w-16 text-primary animate-pulse mx-auto mb-4" />
          <p className="text-lg font-medium text-foreground">Loading analytics...</p>
          <p className="text-sm text-muted-foreground mt-1">Crunching the numbers</p>
        </div>
      </div>
    )
  }

  if (!analyticsData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background to-card flex items-center justify-center">
        <div className="text-center">
          <BarChart3 className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
          <p className="text-lg font-medium text-foreground">No data available</p>
          <p className="text-sm text-muted-foreground mt-1">Try selecting a different time period</p>
        </div>
      </div>
    )
  }

  const metrics = analyticsMode === "consolidated" 
    ? analyticsData.consolidated 
    : analyticsData.restaurants[0]?.metrics

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background/95 to-card">
      {/* Header */}
      <div className="bg-gradient-to-r from-primary via-primary/90 to-primary text-primary-foreground">
        <div className="container mx-auto px-6 py-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold flex items-center gap-3">
                <BarChart3 className="h-8 w-8" />
                {analyticsMode === "consolidated" ? "Portfolio Analytics" : "Restaurant Analytics"}
              </h1>
              <p className="text-primary-foreground/80 mt-2">
                {analyticsMode === "consolidated" 
                  ? `Performance overview across ${restaurants.length} restaurants`
                  : `Performance insights for ${currentRestaurant?.restaurant.name}`}
              </p>
            </div>
            
            <div className="flex items-center gap-4">
              <Select value={timeframe} onValueChange={(value: "7d" | "30d" | "90d") => setTimeframe(value)}>
                <SelectTrigger className="w-32 bg-white/10 border-white/20 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7d">Last 7 days</SelectItem>
                  <SelectItem value="30d">Last 30 days</SelectItem>
                  <SelectItem value="90d">Last 90 days</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-6 py-8">
        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <MetricCard
            title="Total Bookings"
            value={metrics?.totalBookings || 0}
            icon={Calendar}
            trend="+12%"
            trendUp={true}
          />
          <MetricCard
            title="Total Guests"
            value={metrics?.totalGuests || 0}
            icon={Users}
            trend="+8%"
            trendUp={true}
          />
          <MetricCard
            title="Revenue"
            value={`$${(metrics?.estimatedRevenue || 0).toLocaleString()}`}
            icon={DollarSign}
            trend="+15%"
            trendUp={true}
          />
          <MetricCard
            title="Conversion Rate"
            value={`${Math.round(metrics?.conversionRate || 0)}%`}
            icon={Target}
            trend="-2%"
            trendUp={false}
          />
        </div>

        {/* Tabs for Different Views */}
        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3 lg:w-[400px]">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="performance">Performance</TabsTrigger>
            <TabsTrigger value="comparison">Comparison</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            {/* Booking Status Breakdown */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5 text-primary" />
                  Booking Status Breakdown
                </CardTitle>
                <CardDescription>
                  Distribution of booking statuses over the selected period
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                  <StatusCard
                    label="Confirmed"
                    value={metrics?.confirmedBookings || 0}
                    percentage={metrics?.totalBookings ? Math.round((metrics.confirmedBookings / metrics.totalBookings) * 100) : 0}
                    color="bg-green-100 text-green-800 border-green-200"
                  />
                  <StatusCard
                    label="Completed"
                    value={metrics?.completedBookings || 0}
                    percentage={metrics?.totalBookings ? Math.round((metrics.completedBookings / metrics.totalBookings) * 100) : 0}
                    color="bg-blue-100 text-blue-800 border-blue-200"
                  />
                  <StatusCard
                    label="Cancelled"
                    value={metrics?.cancelledBookings || 0}
                    percentage={metrics?.totalBookings ? Math.round((metrics.cancelledBookings / metrics.totalBookings) * 100) : 0}
                    color="bg-red-100 text-red-800 border-red-200"
                  />
                  <StatusCard
                    label="Pending"
                    value={metrics?.pendingBookings || 0}
                    percentage={metrics?.totalBookings ? Math.round((metrics.pendingBookings / metrics.totalBookings) * 100) : 0}
                    color="bg-yellow-100 text-yellow-800 border-yellow-200"
                  />
                  <StatusCard
                    label="Avg Party Size"
                    value={Math.round(metrics?.averagePartySize || 0)}
                    percentage={0}
                    color="bg-purple-100 text-purple-800 border-purple-200"
                    hidePercentage={true}
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="performance" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Revenue Trend</CardTitle>
                  <CardDescription>Daily revenue over time</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-center py-8 text-muted-foreground">
                    Revenue chart would go here
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Booking Trend</CardTitle>
                  <CardDescription>Daily booking volume</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-center py-8 text-muted-foreground">
                    Booking chart would go here
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="comparison" className="space-y-6">
            {analyticsMode === "consolidated" && analyticsData.restaurants.length > 1 ? (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold mb-4">Restaurant Comparison</h3>
                <div className="grid gap-4">
                  {analyticsData.restaurants.map((restaurant, index) => (
                    <Card key={restaurant.restaurant.id}>
                      <CardHeader className="pb-4">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-base font-semibold">
                            {restaurant.restaurant.name}
                          </CardTitle>
                          <Badge variant="outline">
                            Rank #{index + 1}
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                          <div className="text-center">
                            <div className="text-2xl font-bold text-primary">{restaurant.metrics.totalBookings}</div>
                            <div className="text-xs text-muted-foreground">Bookings</div>
                          </div>
                          <div className="text-center">
                            <div className="text-2xl font-bold text-green-600">{restaurant.metrics.totalGuests}</div>
                            <div className="text-xs text-muted-foreground">Guests</div>
                          </div>
                          <div className="text-center">
                            <div className="text-2xl font-bold text-blue-600">${restaurant.metrics.estimatedRevenue.toLocaleString()}</div>
                            <div className="text-xs text-muted-foreground">Revenue</div>
                          </div>
                          <div className="text-center">
                            <div className="text-2xl font-bold text-purple-600">{Math.round(restaurant.metrics.conversionRate)}%</div>
                            <div className="text-xs text-muted-foreground">Conversion</div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-center py-12">
                <Building2 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">Comparison Not Available</h3>
                <p className="text-muted-foreground">
                  {analyticsMode === "single" 
                    ? "Switch to portfolio view to compare multiple restaurants"
                    : "You need at least 2 restaurants to use comparison view"}
                </p>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}

// Helper components
interface MetricCardProps {
  title: string
  value: string | number
  icon: React.ElementType
  trend?: string
  trendUp?: boolean
}

function MetricCard({ title, value, icon: Icon, trend, trendUp }: MetricCardProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {trend && (
          <p className={cn(
            "text-xs flex items-center gap-1 mt-1",
            trendUp ? "text-green-600" : "text-red-600"
          )}>
            {trendUp ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
            {trend} from last period
          </p>
        )}
      </CardContent>
    </Card>
  )
}

interface StatusCardProps {
  label: string
  value: number
  percentage: number
  color: string
  hidePercentage?: boolean
}

function StatusCard({ label, value, percentage, color, hidePercentage = false }: StatusCardProps) {
  return (
    <div className={cn("p-4 rounded-lg border text-center", color)}>
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-sm font-medium">{label}</div>
      {!hidePercentage && (
        <div className="text-xs mt-1">{percentage}% of total</div>
      )}
    </div>
  )
}