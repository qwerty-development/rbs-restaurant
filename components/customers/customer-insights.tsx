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
  DollarSign,
  Clock,
  AlertCircle,
  Award,
  PieChart
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

      // Get all customers
      const { data: customers, error: customersError } = await supabase
        .from('restaurant_customers')
        .select(`
          *,
          profile:profiles(full_name)
        `)
        .eq('restaurant_id', restaurantId)

      if (customersError) throw customersError

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
        } else if (lastVisitDate && lastVisitDate < thirtyDaysAgo && lastVisitDate > ninetyDaysAgo) {
          segments.atRisk++
        } else if (firstVisitDate && firstVisitDate > thirtyDaysAgo) {
          segments.new++
        }

        // Calculate metrics
        totalVisits += customer.total_bookings
        if (customer.total_bookings > 1) returningCustomers++

        // High cancellation/no-show
        if (customer.total_bookings > 0) {
          const cancellationRate = customer.cancelled_count / customer.total_bookings
          const noShowRate = customer.no_show_count / customer.total_bookings
          
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
              <div className="h-4 bg-gray-400 rounded w-1/2 animate-pulse" />
            </CardHeader>
            <CardContent>
              <div className="h-8 bg-gray-400 rounded w-1/3 animate-pulse" />
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
              <Award className="h-4 w-4 text-yellow-500 mt-2" />
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