// components/customers/customer-insights.tsx

'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import {
  TrendingUp,
  TrendingDown,
  Users,
  Calendar,
  Clock,
  AlertCircle,
  Star
} from 'lucide-react'
import { format } from 'date-fns'

interface CustomerInsightsProps {
  restaurantId: string
}

interface InsightData {
  customerSegments: {
    vip: number
    regular: number
    atRisk: number
    new: number
    lost: number
  }
  trends: {
    newCustomersThisMonth: number
    newCustomersLastMonth: number
    returningRate: number
    averageVisitsPerCustomer: number
  }
  topMetrics: {
    mostFrequentCustomers: Array<{
      id: string
      name: string
      visits: number
      lastVisit: string
    }>
    highestSpenders: Array<{
      id: string
      name: string
      totalSpent: number
    }>
  }
  riskMetrics: {
    highCancellationCustomers: number
    highNoShowCustomers: number
    blacklistedCustomers: number
  }
}

export function CustomerInsights({ restaurantId }: CustomerInsightsProps) {
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [insights, setInsights] = useState<InsightData | null>(null)

  useEffect(() => {
    loadInsights()
  }, [restaurantId])

  const loadInsights = async () => {
    try {
      setLoading(true)

      // Get all customers excluding admin and restaurant staff accounts
      const { data: customersData, error: customersError } = await supabase
        .from('restaurant_customers')
        .select(`
          *,
          profile:profiles!restaurant_customers_user_id_fkey(
            id,
            full_name,
            email,
            phone_number,
            avatar_url,
            allergies,
            dietary_restrictions,
            favorite_cuisines,
            preferred_party_size,
            notification_preferences,
            loyalty_points,
            membership_tier,
            privacy_settings,
            user_rating,
            total_bookings,
            completed_bookings,
            cancelled_bookings,
            no_show_bookings,
            rating_last_updated,
            created_at,
            updated_at
          )
        `)
        .eq('restaurant_id', restaurantId)
        .order('created_at', { ascending: false })

      if (customersError) throw customersError

      // Filter out admin and restaurant staff accounts
      let filteredCustomersData = customersData || []
      
      if (filteredCustomersData.length > 0) {
        // Get all user IDs that have profiles (registered users)
        const customerUserIds = filteredCustomersData
          .map(c => c.user_id)
          .filter(id => id !== null)
        
        if (customerUserIds.length > 0) {
          // Check for admin accounts
          const { data: adminData } = await supabase
            .from('rbs_admins')
            .select('user_id')
            .in('user_id', customerUserIds)
          
          const adminUserIds = new Set(adminData?.map(admin => admin.user_id) || [])
          
          // Check for restaurant staff accounts
          const { data: staffData } = await supabase
            .from('restaurant_staff')
            .select('user_id')
            .in('user_id', customerUserIds)
            .eq('is_active', true)
          
          const staffUserIds = new Set(staffData?.map(staff => staff.user_id) || [])
          
          // Filter out customers who are admins or staff
          filteredCustomersData = filteredCustomersData.filter(customer => {
            // Keep guest customers (no user_id)
            if (!customer.user_id) return true
            
            // Exclude admin and staff accounts
            return !adminUserIds.has(customer.user_id) && !staffUserIds.has(customer.user_id)
          })
        }
      }

      // Calculate actual booking counts for all customers efficiently with deduplication
      const customersWithCorrectCounts = await Promise.all(
        filteredCustomersData.map(async (customer) => {
          let allBookings: any[] = []
          
          try {
            // Enhanced logic matching the customer details dialog
            
            // For registered users with profiles, prioritize user_id matching
            if (customer.user_id && customer.profile) {
              const { data: userBookings, error: userBookingsError } = await supabase
                .from('bookings')
                .select('id, booking_time')
                .eq('user_id', customer.user_id)
                .eq('restaurant_id', restaurantId)

              if (!userBookingsError && userBookings) {
                allBookings = [...allBookings, ...userBookings]
              }
            }

            // For guest customers or when user_id matching fails, try multiple approaches
            if (!customer.profile || allBookings.length === 0) {
              // Method 1: Query by guest_email (most reliable for guest customers)
              if (customer.guest_email) {
                const { data: emailBookings, error: emailBookingsError } = await supabase
                  .from('bookings')
                  .select('id, booking_time')
                  .eq('guest_email', customer.guest_email)
                  .eq('restaurant_id', restaurantId)

                if (!emailBookingsError && emailBookings) {
                  // Add bookings that aren't already in the list (by ID)
                  const existingIds = new Set(allBookings.map(b => b.id))
                  const newBookings = emailBookings.filter(b => !existingIds.has(b.id))
                  allBookings = [...allBookings, ...newBookings]
                }
              }

              // Method 2: Query by guest_name and guest_email combination (high confidence match)
              if (customer.guest_name && customer.guest_email) {
                const { data: nameEmailBookings, error: nameEmailError } = await supabase
                  .from('bookings')
                  .select('id, booking_time')
                  .eq('guest_name', customer.guest_name)
                  .eq('guest_email', customer.guest_email)
                  .eq('restaurant_id', restaurantId)

                if (!nameEmailError && nameEmailBookings) {
                  // Add bookings that aren't already in the list (by ID)
                  const existingIds = new Set(allBookings.map(b => b.id))
                  const newBookings = nameEmailBookings.filter(b => !existingIds.has(b.id))
                  allBookings = [...allBookings, ...newBookings]
                }
              }

              // Method 3: Query by guest_name only (lower confidence, use carefully)
              if (customer.guest_name && allBookings.length === 0) {
                const { data: nameBookings, error: nameBookingsError } = await supabase
                  .from('bookings')
                  .select('id, booking_time, guest_email')
                  .eq('guest_name', customer.guest_name)
                  .eq('restaurant_id', restaurantId)

                if (!nameBookingsError && nameBookings) {
                  // For name-only matches, be more selective to avoid false positives
                  // Only include if guest_email matches or is null in both records
                  const filteredBookings = nameBookings.filter(booking => {
                    if (!customer.guest_email && !booking.guest_email) return true
                    if (customer.guest_email && booking.guest_email === customer.guest_email) return true
                    return false
                  })

                  const existingIds = new Set(allBookings.map(b => b.id))
                  const newBookings = filteredBookings.filter(b => !existingIds.has(b.id))
                  allBookings = [...allBookings, ...newBookings]
                }
              }
            }

            return {
              ...customer,
              total_bookings: allBookings.length
            }
          } catch (error) {
            console.error('Error calculating booking count for customer:', customer.id, error)
            // Fall back to original database value if calculation fails
            return customer
          }
        })
      )

      const customers = customersWithCorrectCounts

      const now = new Date()
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
      const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000)
      const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)

      // Calculate segments
      const segments = {
        vip: customers?.filter(c => c.vip_status).length || 0,
        regular: 0,
        atRisk: 0,
        new: 0,
        lost: 0
      }

      // Calculate trends and categorize customers
      let totalVisits = 0
      let returningCustomers = 0
      const frequentCustomers: any[] = []
      const spenders: any[] = []
      let highCancellation = 0
      let highNoShow = 0

      customers?.forEach(customer => {
        const lastVisitDate = customer.last_visit ? new Date(customer.last_visit) : null
        const firstVisitDate = customer.first_visit ? new Date(customer.first_visit) : null

        // Categorize by visit patterns
        if (customer.total_bookings >= 5 && lastVisitDate && lastVisitDate > thirtyDaysAgo) {
          segments.regular++
        } else if (lastVisitDate && lastVisitDate < ninetyDaysAgo && customer.total_bookings > 0) {
          segments.lost++
        } else if (lastVisitDate && lastVisitDate < thirtyDaysAgo && lastVisitDate >= ninetyDaysAgo && customer.total_bookings > 0) {
          segments.atRisk++
        } else if (firstVisitDate && firstVisitDate > thirtyDaysAgo) {
          segments.new++
        }

        // Calculate metrics
        totalVisits += customer.total_bookings
        if (customer.total_bookings > 1) returningCustomers++

        // High cancellation/no-show - use profile data if available
        if (customer.total_bookings > 0) {
          const cancelledBookings = customer.profile?.cancelled_bookings || 0
          const noShowBookings = customer.profile?.no_show_bookings || 0
          
          const cancellationRate = cancelledBookings / customer.total_bookings
          const noShowRate = noShowBookings / customer.total_bookings
          
          if (cancellationRate > 0.3) highCancellation++
          if (noShowRate > 0.2) highNoShow++
        }

        // Track top customers
        if (customer.total_bookings > 0) {
          frequentCustomers.push({
            id: customer.id,
            name: customer.profile?.full_name || customer.guest_name || 'Guest',
            visits: customer.total_bookings,
            lastVisit: customer.last_visit
          })
        }

        if (customer.total_spent > 0) {
          spenders.push({
            id: customer.id,
            name: customer.profile?.full_name || customer.guest_name || 'Guest',
            totalSpent: customer.total_spent
          })
        }
      })

      // Count new customers this month and last month
      const newThisMonth = customers?.filter(c => {
        const firstVisit = c.first_visit ? new Date(c.first_visit) : null
        return firstVisit && firstVisit > thirtyDaysAgo
      }).length || 0

      const newLastMonth = customers?.filter(c => {
        const firstVisit = c.first_visit ? new Date(c.first_visit) : null
        return firstVisit && firstVisit > sixtyDaysAgo && firstVisit <= thirtyDaysAgo
      }).length || 0

      setInsights({
        customerSegments: segments,
        trends: {
          newCustomersThisMonth: newThisMonth,
          newCustomersLastMonth: newLastMonth,
          returningRate: customers && customers.length > 0 
            ? (returningCustomers / customers.length) * 100 
            : 0,
          averageVisitsPerCustomer: customers && customers.length > 0
            ? totalVisits / customers.length
            : 0
        },
        topMetrics: {
          mostFrequentCustomers: frequentCustomers
            .sort((a, b) => b.visits - a.visits)
            .slice(0, 5),
          highestSpenders: spenders
            .sort((a, b) => b.totalSpent - a.totalSpent)
            .slice(0, 5)
        },
        riskMetrics: {
          highCancellationCustomers: highCancellation,
          highNoShowCustomers: highNoShow,
          blacklistedCustomers: customers?.filter(c => c.blacklisted).length || 0
        }
      })

    } catch (error) {
      console.error('Error loading insights:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading || !insights) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[...Array(6)].map((_, i) => (
          <Card key={i}>
            <CardHeader>
              <div className="h-4 bg-muted rounded w-1/2 animate-pulse" />
            </CardHeader>
            <CardContent>
              <div className="h-8 bg-muted rounded w-1/3 animate-pulse" />
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  const getGrowthIcon = (current: number, previous: number) => {
    if (current > previous) return <TrendingUp className="h-4 w-4 text-green-500" />
    if (current < previous) return <TrendingDown className="h-4 w-4 text-red-500" />
    return null
  }

  const getGrowthPercentage = (current: number, previous: number) => {
    if (previous === 0) return current > 0 ? 100 : 0
    return ((current - previous) / previous) * 100
  }

  return (
    <div className="space-y-6">
      {/* Customer Segments */}
      <div>
        <h3 className="text-lg font-semibold mb-4">Customer Segments</h3>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">VIP Customers</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{insights.customerSegments.vip}</div>
              <Star className="h-4 w-4 text-yellow-500 mt-2" />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Regular</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{insights.customerSegments.regular}</div>
              <Users className="h-4 w-4 text-blue-500 mt-2" />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">At Risk</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{insights.customerSegments.atRisk}</div>
              <AlertCircle className="h-4 w-4 text-orange-500 mt-2" />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">New</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{insights.customerSegments.new}</div>
              <Calendar className="h-4 w-4 text-green-500 mt-2" />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Lost</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{insights.customerSegments.lost}</div>
              <Clock className="h-4 w-4 text-gray-500 mt-2" />
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Trends */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>New Customer Acquisition</CardTitle>
            <CardDescription>Month over month comparison</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm">This Month</span>
                <div className="flex items-center gap-2">
                  <span className="text-2xl font-bold">{insights.trends.newCustomersThisMonth}</span>
                  {getGrowthIcon(
                    insights.trends.newCustomersThisMonth, 
                    insights.trends.newCustomersLastMonth
                  )}
                </div>
              </div>
              <div className="flex items-center justify-between text-gray-600">
                <span className="text-sm">Last Month</span>
                <span className="text-lg">{insights.trends.newCustomersLastMonth}</span>
              </div>
              <div className="text-sm text-gray-600">
                {getGrowthPercentage(
                  insights.trends.newCustomersThisMonth,
                  insights.trends.newCustomersLastMonth
                ).toFixed(0)}% change
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Customer Retention</CardTitle>
            <CardDescription>Key retention metrics</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-sm">Returning Customer Rate</span>
                  <span className="text-sm font-medium">
                    {insights.trends.returningRate.toFixed(1)}%
                  </span>
                </div>
                <Progress value={insights.trends.returningRate} className="h-2" />
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm">Avg Visits per Customer</span>
                <span className="text-lg font-medium">
                  {insights.trends.averageVisitsPerCustomer.toFixed(1)}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Top Customers */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Most Frequent Visitors</CardTitle>
            <CardDescription>Your most loyal customers</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {insights.topMetrics.mostFrequentCustomers.map((customer, index) => (
                <div key={customer.id} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-500">#{index + 1}</span>
                    <span className="text-sm font-medium">{customer.name}</span>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-medium">{customer.visits} visits</div>
                    {customer.lastVisit && (
                      <div className="text-xs text-gray-500">
                        Last: {format(new Date(customer.lastVisit), 'MMM d')}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

    
      </div>

      {/* Risk Metrics */}
      <Card>
        <CardHeader>
          <CardTitle>Risk Indicators</CardTitle>
          <CardDescription>Customers requiring attention</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex items-center justify-between p-3 bg-orange-300 rounded-lg">
              <div>
                <p className="text-sm font-medium">High Cancellation Rate</p>
                <p className="text-xs text-gray-600">More than 30% cancellations</p>
              </div>
              <div className="text-2xl font-bold text-orange-600">
                {insights.riskMetrics.highCancellationCustomers}
              </div>
            </div>

            <div className="flex items-center justify-between p-3 bg-pink-300 rounded-lg">
              <div>
                <p className="text-sm font-medium">High No-Show Rate</p>
                <p className="text-xs text-gray-600">More than 20% no-shows</p>
              </div>
              <div className="text-2xl font-bold text-red-600">
                {insights.riskMetrics.highNoShowCustomers}
              </div>
            </div>

            <div className="flex items-center justify-between p-3 bg-gray-300 rounded-lg">
              <div>
                <p className="text-sm font-medium">Blacklisted</p>
                <p className="text-xs text-gray-600">Restricted from booking</p>
              </div>
              <div className="text-2xl font-bold text-gray-600">
                {insights.riskMetrics.blacklistedCustomers}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}