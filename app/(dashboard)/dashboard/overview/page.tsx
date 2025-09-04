// app/(dashboard)/dashboard/overview/page.tsx
"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import { useUserRestaurants } from "@/lib/hooks/use-restaurants"
import { useComprehensiveRestaurantData } from "@/lib/hooks/use-comprehensive-restaurant-data"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Progress } from "@/components/ui/progress"
import { Separator } from "@/components/ui/separator"
import { 
  Building2, 
  Users, 
  Calendar, 
  TrendingUp, 
  ChefHat,
  MapPin,
  Phone,
  Clock,
  Star,
  ArrowRight,
  Search,
  Filter,
  BarChart3,
  PieChart,
  Activity,
  DollarSign,
  UserCheck,
  AlertCircle,
  Timer,
  Table2,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Eye,
  Plus,
  RefreshCw,
  Zap,
  TrendingDown,
  Crown,
  Utensils,
  Home,
  Bell,
  LogOut
} from "lucide-react"
import { cn } from "@/lib/utils"
import { format, formatDistanceToNow } from "date-fns"
import Image from "next/image"

export default function RestaurantOverviewPage() {
  const router = useRouter()
  const supabase = createClient()
  const { data: restaurants = [], isLoading } = useUserRestaurants()
  const [searchQuery, setSearchQuery] = useState("")
  const [viewMode, setViewMode] = useState<"overview" | "detailed">("overview")
  const [sortBy, setSortBy] = useState<"name" | "activity" | "alerts">("activity")
  const [currentTime, setCurrentTime] = useState(new Date())
  
  const restaurantIds = restaurants.map(r => r.restaurant.id)
  const { data: comprehensiveData = [], isLoading: dataLoading, refetch } = useComprehensiveRestaurantData(restaurantIds)
  
  // Update current time every minute
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date())
    }, 60000)
    return () => clearInterval(interval)
  }, [])

  // Filtered and sorted restaurants with comprehensive data
  const filteredRestaurants = comprehensiveData
    .filter(data => 
      data.restaurant.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      data.restaurant.address.toLowerCase().includes(searchQuery.toLowerCase()) ||
      data.restaurant.cuisine_type.toLowerCase().includes(searchQuery.toLowerCase())
    )
    .sort((a, b) => {
      switch(sortBy) {
        case "name":
          return a.restaurant.name.localeCompare(b.restaurant.name)
        case "alerts":
          return b.criticalAlerts.length - a.criticalAlerts.length
        case "activity":
        default:
          return b.todayStats.currentlyDining - a.todayStats.currentlyDining
      }
    })
  
  // Portfolio-wide statistics
  const portfolioStats = comprehensiveData.reduce((acc, data) => {
    acc.totalRestaurants += 1
    acc.totalBookings += data.todayStats.totalBookings
    acc.currentlyDining += data.todayStats.currentlyDining
    acc.totalGuests += data.todayStats.totalGuests
    acc.totalRevenue += data.todayStats.revenue
    acc.totalAlerts += data.criticalAlerts.filter(a => a.severity === 'high').length
    acc.pendingRequests += data.todayStats.pendingRequests
    acc.availableTables += data.tables.available
    acc.occupiedTables += data.tables.occupied
    return acc
  }, {
    totalRestaurants: 0,
    totalBookings: 0,
    currentlyDining: 0,
    totalGuests: 0,
    totalRevenue: 0,
    totalAlerts: 0,
    pendingRequests: 0,
    availableTables: 0,
    occupiedTables: 0
  })

  const handleRestaurantSelect = (restaurantId: string) => {
    localStorage.setItem('selected-restaurant-id', restaurantId)
    router.push(`/dashboard?restaurant=${restaurantId}`)
  }
  
  const handleQuickAction = (action: string, restaurantId: string) => {
    localStorage.setItem('selected-restaurant-id', restaurantId)
    switch(action) {
      case 'bookings':
        router.push(`/bookings?restaurant=${restaurantId}`)
        break
      case 'tables':
        router.push(`/tables?restaurant=${restaurantId}`)
        break
      case 'analytics':
        router.push(`/analytics?restaurant=${restaurantId}`)
        break
      default:
        router.push(`/dashboard?restaurant=${restaurantId}`)
    }
  }

  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut()
      router.push('/login')
      toast.success('Signed out successfully')
    } catch (error) {
      console.error('Error signing out:', error)
      toast.error('Failed to sign out')
    }
  }

  if (isLoading || dataLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background to-card flex items-center justify-center">
        <div className="text-center">
          <div className="relative">
            <div className="animate-spin rounded-full h-16 w-16 border-4 border-border mx-auto mb-4" />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="h-10 w-10 rounded-full bg-gradient-to-br from-primary to-primary/80 animate-pulse" />
            </div>
          </div>
          <p className="text-lg font-medium text-foreground">Loading your restaurants...</p>
          <p className="text-sm text-muted-foreground mt-1">Setting up your dashboard</p>
        </div>
      </div>
    )
  }

  // If single restaurant, redirect directly
  if (restaurants.length === 1) {
    const restaurantId = restaurants[0].restaurant.id
    localStorage.setItem('selected-restaurant-id', restaurantId)
    router.replace(`/dashboard?restaurant=${restaurantId}`)
    return null
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background/95 to-card">
      {/* Header */}
      <div className="bg-gradient-to-r from-primary via-primary/90 to-primary text-primary-foreground">
        <div className="container mx-auto px-6 py-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold flex items-center gap-3">
                <Building2 className="h-8 w-8" />
                Portfolio Dashboard
              </h1>
              <p className="text-primary-foreground/80 mt-2">
                Real-time overview of {portfolioStats.totalRestaurants} restaurant{portfolioStats.totalRestaurants !== 1 ? 's' : ''} • {portfolioStats.currentlyDining} dining • {portfolioStats.totalGuests} guests
              </p>
            </div>
            
            <div className="flex items-center gap-4">
              {portfolioStats.totalAlerts > 0 && (
                <Badge variant="destructive" className="bg-red-600 text-white px-4 py-2 animate-pulse">
                  <AlertTriangle className="h-4 w-4 mr-2" />
                  {portfolioStats.totalAlerts} Alert{portfolioStats.totalAlerts > 1 ? 's' : ''}
                </Badge>
              )}
              <Badge variant="secondary" className="bg-white/10 text-white border-white/20 px-4 py-2">
                <DollarSign className="h-4 w-4 mr-2" />
                ${portfolioStats.totalRevenue.toLocaleString()}
              </Badge>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => refetch()}
                className="bg-white/10 hover:bg-white/20 text-white border-white/20"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleSignOut}
                className="bg-white/10 hover:bg-white/20 text-white border-white/20"
              >
                <LogOut className="h-4 w-4 mr-2" />
                Sign Out
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-6 py-8">
        {/* Filters and Search */}
        <div className="flex flex-col sm:flex-row gap-4 mb-8">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search restaurants by name, location, or cuisine..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          
          <div className="flex gap-2">
            <Button
              variant={sortBy === "activity" ? "default" : "outline"}
              size="sm"
              onClick={() => setSortBy("activity")}
            >
              <Activity className="h-4 w-4 mr-2" />
              Activity
            </Button>
            <Button
              variant={sortBy === "name" ? "default" : "outline"}
              size="sm"
              onClick={() => setSortBy("name")}
            >
              <Building2 className="h-4 w-4 mr-2" />
              Name
            </Button>
          </div>
        </div>

        {/* Performance Comparison */}
        {comprehensiveData.length > 1 && (
          <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold">Performance Comparison</h3>
                <p className="text-sm text-muted-foreground">Compare key metrics across your restaurants</p>
              </div>
              <Button variant="outline" size="sm">
                <BarChart3 className="h-4 w-4 mr-2" />
                View Full Analytics
              </Button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Best Performing Restaurant */}
              {(() => {
                const bestByRevenue = [...comprehensiveData].sort((a, b) => 
                  b.todayStats.revenue - a.todayStats.revenue
                )[0]
                const bestByOccupancy = [...comprehensiveData].sort((a, b) => 
                  b.todayStats.occupancyRate - a.todayStats.occupancyRate
                )[0]
                const bestByBookings = [...comprehensiveData].sort((a, b) => 
                  b.todayStats.totalBookings - a.todayStats.totalBookings
                )[0]
                const needsAttention = [...comprehensiveData].sort((a, b) => 
                  b.criticalAlerts.length - a.criticalAlerts.length
                )[0]

                return (
                  <>
                    <Card>
                      <CardContent className="p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <Crown className="h-4 w-4 text-yellow-600" />
                          <span className="text-sm font-medium text-yellow-700">Top Revenue</span>
                        </div>
                        <div className="font-semibold">{bestByRevenue.restaurant.name}</div>
                        <div className="text-2xl font-bold text-green-600">
                          ${bestByRevenue.todayStats.revenue.toLocaleString()}
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          {bestByRevenue.todayStats.completedBookings} completed bookings
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardContent className="p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <TrendingUp className="h-4 w-4 text-blue-600" />
                          <span className="text-sm font-medium text-blue-700">Best Occupancy</span>
                        </div>
                        <div className="font-semibold">{bestByOccupancy.restaurant.name}</div>
                        <div className="text-2xl font-bold text-blue-600">
                          {bestByOccupancy.todayStats.occupancyRate}%
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          {bestByOccupancy.tables.occupied}/{bestByOccupancy.tables.total} tables occupied
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardContent className="p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <Calendar className="h-4 w-4 text-purple-600" />
                          <span className="text-sm font-medium text-purple-700">Most Bookings</span>
                        </div>
                        <div className="font-semibold">{bestByBookings.restaurant.name}</div>
                        <div className="text-2xl font-bold text-purple-600">
                          {bestByBookings.todayStats.totalBookings}
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          {bestByBookings.todayStats.currentlyDining} currently dining
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardContent className="p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <AlertTriangle className="h-4 w-4 text-red-600" />
                          <span className="text-sm font-medium text-red-700">Needs Attention</span>
                        </div>
                        <div className="font-semibold">{needsAttention.restaurant.name}</div>
                        <div className="text-2xl font-bold text-red-600">
                          {needsAttention.criticalAlerts.length}
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          {needsAttention.criticalAlerts.length > 0 
                            ? needsAttention.criticalAlerts[0].message 
                            : 'All systems normal'
                          }
                        </div>
                      </CardContent>
                    </Card>
                  </>
                )
              })()}
            </div>
          </div>
        )}

        {/* Restaurant Grid */}
        {viewMode === "overview" ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            {filteredRestaurants.map((data) => (
              <EnhancedRestaurantCard
                key={data.restaurant.id}
                data={data}
                onSelect={() => handleRestaurantSelect(data.restaurant.id)}
                onQuickAction={handleQuickAction}
              />
            ))}
          </div>
        ) : (
          <div className="space-y-6 mb-8">
            {filteredRestaurants.map((data) => (
              <DetailedRestaurantCard
                key={data.restaurant.id}
                data={data}
                onSelect={() => handleRestaurantSelect(data.restaurant.id)}
                onQuickAction={handleQuickAction}
              />
            ))}
          </div>
        )}

        {/* No Results */}
        {filteredRestaurants.length === 0 && searchQuery && (
          <div className="text-center py-12">
            <Building2 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No restaurants found</h3>
            <p className="text-muted-foreground mb-4">
              No restaurants match your search for "{searchQuery}"
            </p>
            <Button variant="outline" onClick={() => setSearchQuery("")}>
              Clear search
            </Button>
          </div>
        )}

        {/* Quick Stats Overview */}
        {restaurants.length > 0 && (
          <div className="mt-12">
            <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
              <BarChart3 className="h-6 w-6 text-primary" />
              Quick Overview
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-primary" />
                    Total Locations
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{restaurants.length}</div>
                  <p className="text-xs text-muted-foreground">
                    Active restaurants
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <ChefHat className="h-4 w-4 text-green-600" />
                    Cuisines
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {[...new Set(restaurants.map(r => r.restaurant.cuisine_type))].length}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Different cuisines
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Users className="h-4 w-4 text-blue-600" />
                    Your Role
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {restaurants.filter(r => r.role === 'owner').length}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    As owner
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Star className="h-4 w-4 text-yellow-600" />
                    Access Level
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {restaurants.filter(r => ['owner', 'manager'].includes(r.role)).length}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Full access
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// Enhanced Restaurant Card with comprehensive data
interface EnhancedRestaurantCardProps {
  data: any // ComprehensiveRestaurantData type
  onSelect: () => void
  onQuickAction: (action: string, restaurantId: string) => void
}

function EnhancedRestaurantCard({ data, onSelect, onQuickAction }: EnhancedRestaurantCardProps) {
  const getRoleColor = (role: string) => {
    switch(role) {
      case 'owner': return 'bg-emerald-100 text-emerald-800 border-emerald-200'
      case 'manager': return 'bg-blue-100 text-blue-800 border-blue-200'
      case 'staff': return 'bg-purple-100 text-purple-800 border-purple-200'
      default: return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  const getAlertSeverityColor = (severity: string) => {
    switch(severity) {
      case 'high': return 'text-red-600 bg-red-100 border-red-200'
      case 'medium': return 'text-yellow-600 bg-yellow-100 border-yellow-200'
      case 'low': return 'text-blue-600 bg-blue-100 border-blue-200'
      default: return 'text-gray-600 bg-gray-100 border-gray-200'
    }
  }

  const highAlerts = data.criticalAlerts.filter((a: any) => a.severity === 'high').length

  return (
    <Card className={cn(
      "group transition-all duration-300 hover:shadow-lg",
      highAlerts > 0 ? "border-red-200 hover:border-red-300 bg-red-50/50" : "hover:shadow-primary/20 border hover:border-primary/30"
    )}>
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {data.restaurant.main_image_url ? (
              <Image
                src={data.restaurant.main_image_url}
                alt={data.restaurant.name}
                width={48}
                height={48}
                className="w-12 h-12 rounded-lg object-cover"
              />
            ) : (
              <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center">
                <ChefHat className="h-6 w-6 text-primary/60" />
              </div>
            )}
            <div>
              <CardTitle className="text-lg font-bold">{data.restaurant.name}</CardTitle>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <MapPin className="h-3 w-3" />
                <span className="truncate">{data.restaurant.cuisine_type}</span>
                <Badge className={cn("text-xs", getRoleColor(data.staff.role))}>
                  {data.staff.role}
                </Badge>
              </div>
            </div>
          </div>
          
          {highAlerts > 0 && (
            <Badge variant="destructive" className="animate-pulse">
              <AlertTriangle className="h-3 w-3 mr-1" />
              {highAlerts}
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Critical Alerts */}
        {data.criticalAlerts.length > 0 && (
          <div className="space-y-2">
            {data.criticalAlerts.slice(0, 2).map((alert: any, index: number) => (
              <Alert key={index} className={cn("text-xs", getAlertSeverityColor(alert.severity))}>
                <AlertCircle className="h-3 w-3" />
                <AlertDescription>{alert.message}</AlertDescription>
              </Alert>
            ))}
          </div>
        )}

        {/* Stats Grid */}
        <div className="grid grid-cols-4 gap-3">
          <div className="text-center p-2 bg-blue-50 rounded border border-blue-200">
            <div className="text-lg font-bold text-blue-700">{data.todayStats.currentlyDining}</div>
            <div className="text-xs text-blue-600">Dining</div>
          </div>
          <div className="text-center p-2 bg-green-50 rounded border border-green-200">
            <div className="text-lg font-bold text-green-700">{data.tables.available}</div>
            <div className="text-xs text-green-600">Available</div>
          </div>
          <div className="text-center p-2 bg-purple-50 rounded border border-purple-200">
            <div className="text-lg font-bold text-purple-700">{data.todayStats.occupancyRate}%</div>
            <div className="text-xs text-purple-600">Occupied</div>
          </div>
          <div className="text-center p-2 bg-yellow-50 rounded border border-yellow-200">
            <div className="text-lg font-bold text-yellow-700">${data.todayStats.revenue}</div>
            <div className="text-xs text-yellow-600">Revenue</div>
          </div>
        </div>

        {/* Upcoming Bookings Preview */}
        {data.upcomingBookings.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium flex items-center gap-2">
              <Clock className="h-4 w-4 text-blue-600" />
              Next Bookings
            </h4>
            <div className="space-y-1">
              {data.upcomingBookings.slice(0, 3).map((booking: any) => (
                <div key={booking.id} className="flex items-center justify-between text-xs bg-muted/50 p-2 rounded">
                  <div className="flex items-center gap-2">
                    {booking.is_vip && <Crown className="h-3 w-3 text-yellow-600" />}
                    <span className="font-medium">{booking.guest_name}</span>
                    <span className="text-muted-foreground">({booking.party_size})</span>
                  </div>
                  <div className="text-right">
                    <div className="font-medium">{format(new Date(booking.booking_time), 'h:mm a')}</div>
                    <div className="text-muted-foreground">
                      {booking.time_until > 0 ? `in ${booking.time_until}m` : `${Math.abs(booking.time_until)}m ago`}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Quick Actions */}
        <div className="flex gap-2">
          <Button size="sm" onClick={onSelect} className="flex-1">
            <Home className="h-4 w-4 mr-2" />
            Dashboard
          </Button>
          <Button size="sm" variant="outline" onClick={() => onQuickAction('bookings', data.restaurant.id)}>
            <Calendar className="h-4 w-4" />
          </Button>
          <Button size="sm" variant="outline" onClick={() => onQuickAction('tables', data.restaurant.id)}>
            <Table2 className="h-4 w-4" />
          </Button>
          <Button size="sm" variant="outline" onClick={() => onQuickAction('analytics', data.restaurant.id)}>
            <BarChart3 className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

// Detailed Restaurant Card for detailed view
function DetailedRestaurantCard({ data, onSelect, onQuickAction }: EnhancedRestaurantCardProps) {
  return (
    <Card className="p-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Restaurant Info */}
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            {data.restaurant.main_image_url ? (
              <Image
                src={data.restaurant.main_image_url}
                alt={data.restaurant.name}
                width={64}
                height={64}
                className="w-16 h-16 rounded-lg object-cover"
              />
            ) : (
              <div className="w-16 h-16 rounded-lg bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center">
                <ChefHat className="h-8 w-8 text-primary/60" />
              </div>
            )}
            <div>
              <h3 className="text-xl font-bold">{data.restaurant.name}</h3>
              <p className="text-sm text-muted-foreground">{data.restaurant.address}</p>
              <div className="flex gap-2 mt-2">
                <Badge variant="outline">{data.restaurant.cuisine_type}</Badge>
                <Badge>{data.staff.role}</Badge>
              </div>
            </div>
          </div>
          
          <div className="flex gap-2">
            <Button onClick={onSelect} className="flex-1">
              <Home className="h-4 w-4 mr-2" />
              Open Dashboard
            </Button>
          </div>
        </div>

        {/* Stats and Tables */}
        <div className="space-y-4">
          <h4 className="font-semibold">Today's Performance</h4>
          <div className="grid grid-cols-2 gap-3">
            <div className="text-center p-3 bg-blue-50 rounded">
              <div className="text-xl font-bold text-blue-700">{data.todayStats.currentlyDining}</div>
              <div className="text-sm text-blue-600">Currently Dining</div>
            </div>
            <div className="text-center p-3 bg-green-50 rounded">
              <div className="text-xl font-bold text-green-700">${data.todayStats.revenue}</div>
              <div className="text-sm text-green-600">Revenue</div>
            </div>
            <div className="text-center p-3 bg-purple-50 rounded">
              <div className="text-xl font-bold text-purple-700">{data.tables.occupied}/{data.tables.total}</div>
              <div className="text-sm text-purple-600">Tables Occupied</div>
            </div>
            <div className="text-center p-3 bg-yellow-50 rounded">
              <div className="text-xl font-bold text-yellow-700">{data.todayStats.totalBookings}</div>
              <div className="text-sm text-yellow-600">Total Bookings</div>
            </div>
          </div>
          
          {/* Table Status */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span>Table Utilization</span>
              <span className="font-medium">{data.todayStats.occupancyRate}%</span>
            </div>
            <Progress value={data.todayStats.occupancyRate} className="h-2" />
          </div>
        </div>

        {/* Upcoming Bookings & Alerts */}
        <div className="space-y-4">
          {data.criticalAlerts.length > 0 && (
            <div>
              <h4 className="font-semibold text-red-700 mb-2">Critical Alerts</h4>
              <div className="space-y-2">
                {data.criticalAlerts.slice(0, 3).map((alert: any, index: number) => (
                  <Alert key={index} variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>{alert.message}</AlertDescription>
                  </Alert>
                ))}
              </div>
            </div>
          )}
          
          {data.upcomingBookings.length > 0 && (
            <div>
              <h4 className="font-semibold mb-2">Upcoming Bookings</h4>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {data.upcomingBookings.map((booking: any) => (
                  <div key={booking.id} className="flex items-center justify-between p-3 bg-muted/50 rounded">
                    <div className="flex items-center gap-2">
                      {booking.is_vip && <Crown className="h-4 w-4 text-yellow-600" />}
                      <div>
                        <div className="font-medium text-sm">{booking.guest_name}</div>
                        <div className="text-xs text-muted-foreground">
                          Party of {booking.party_size} • Tables {booking.table_numbers.join(', ')}
                        </div>
                      </div>
                    </div>
                    <div className="text-right text-sm">
                      <div className="font-medium">{format(new Date(booking.booking_time), 'h:mm a')}</div>
                      <div className="text-xs text-muted-foreground">
                        {booking.time_until > 0 ? `in ${booking.time_until}m` : `${Math.abs(booking.time_until)}m ago`}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </Card>
  )
}
