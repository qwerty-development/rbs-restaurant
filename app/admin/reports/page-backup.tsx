'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { toast } from 'react-hot-toast'
import { Calendar, Download, RefreshCw, TrendingUp, Users, CheckCircle2, XCircle, DollarSign, BarChart3, Activity, Target, CreditCard, Clock, AlertCircle } from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

type UserStats = {
  total_users: number
  new_users_7d: number
  new_users_today: number
  new_users_yesterday: number
  active_users_daily: number
  active_users_weekly: number
  active_users_monthly: number
  users_with_bookings: number
}

type BookingStats = {
  total_bookings: number
  bookings_7d: number
  bookings_today: number
  completed_bookings: number
  cancelled_bookings: number
  no_show_bookings: number
  total_covers: number
  avg_party_size: number
  completed_covers: number
}

type BookingRates = {
  total_bookings: number
  completed_bookings: number
  cancelled_bookings: number
  no_show_bookings: number
  completion_rate_pct: number
  cancellation_rate_pct: number
  no_show_rate_pct: number
}

type PlatformRevenue = {
  basic_restaurants: number
  pro_restaurants: number
  total_completed_bookings: number
  total_completed_covers: number
  total_estimated_revenue_usd: number
}

type CustomerDemographics = {
  total_customers: number
  avg_age: number
  customers_with_age_data: number
  customers_with_bookings: number
  avg_party_size_per_booking: number
}

type KPI = {
  total: number
  accepted: number
  cancelled: number
  noShow: number
  totalCovers: number
  acceptedCovers: number
  declinedCovers: number
  cancelledCovers: number
  billableUSD: number
}

export default function AdminReportsPage() {
  const supabase = createClient()

  const [restaurants, setRestaurants] = useState<{ id: string; name: string }[]>([])
  const [restaurantId, setRestaurantId] = useState<string>('all')
  const [dateFrom, setDateFrom] = useState<string>('')
  const [dateTo, setDateTo] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [kpi, setKpi] = useState<KPI>({ total: 0, accepted: 0, cancelled: 0, noShow: 0, totalCovers: 0, acceptedCovers: 0, declinedCovers: 0, cancelledCovers: 0, billableUSD: 0 })
  const [byHour, setByHour] = useState<{ hour: number; count: number }[]>([])
  // Export controls
  const [exportEntity, setExportEntity] = useState<'bookings' | 'reviews'>('bookings')
  const [exportStatus, setExportStatus] = useState<string>('all')
  const [exportUserQuery, setExportUserQuery] = useState<string>('')
  
  // New comprehensive stats
  const [userStats, setUserStats] = useState<UserStats | null>(null)
  const [bookingStats, setBookingStats] = useState<BookingStats | null>(null)
  const [bookingRates, setBookingRates] = useState<BookingRates | null>(null)
  const [platformRevenue, setPlatformRevenue] = useState<PlatformRevenue | null>(null)
  const [customerDemographics, setCustomerDemographics] = useState<CustomerDemographics | null>(null)
  const [topRestaurants, setTopRestaurants] = useState<any[]>([])
  const [mostBookedUsers, setMostBookedUsers] = useState<any[]>([])
  const [bookingFunnel, setBookingFunnel] = useState<any[]>([])
  const [recurringUsers, setRecurringUsers] = useState<any[]>([])
  const [waitingTimeStats, setWaitingTimeStats] = useState<any>(null)

  const dateSummary = useMemo(() => {
    if (!dateFrom && !dateTo) return 'All time'
    return `${dateFrom || '…'} → ${dateTo || '…'}`
  }, [dateFrom, dateTo])

  const loadRestaurants = async () => {
    try {
      const { data, error } = await supabase.from('restaurants').select('id, name').order('name')
      if (error) throw error
      setRestaurants(data || [])
    } catch (e) {
      console.error(e)
    }
  }

  const loadKPIs = async () => {
    try {
      setLoading(true)
      let base = supabase.from('bookings').select('status, booking_time, party_size, restaurant_id, restaurants:restaurants!bookings_restaurant_id_fkey(tier)', { count: 'exact', head: false })
      if (restaurantId !== 'all') base = base.eq('restaurant_id', restaurantId)
      if (dateFrom) base = base.gte('booking_time', new Date(dateFrom).toISOString())
      if (dateTo) {
        const end = new Date(dateTo); end.setHours(23,59,59,999)
        base = base.lte('booking_time', end.toISOString())
      }

      const { data, error } = await base
      if (error) throw error

      const total = data?.length || 0
      const accepted = data?.filter((b: any) => b.status === 'confirmed').length || 0
      const cancelled = data?.filter((b: any) => b.status === 'cancelled_by_user' || b.status === 'cancelled_by_restaurant' || b.status === 'declined_by_restaurant').length || 0
      const noShow = data?.filter((b: any) => b.status === 'no_show').length || 0

      const sum = (arr: any[], predicate?: (b: any) => boolean) => arr.reduce((acc, b) => acc + (predicate ? (predicate(b) ? (b.party_size || 0) : 0) : (b.party_size || 0)), 0)
      const totalCovers = sum(data || [])
      const acceptedCovers = sum(data || [], (b) => b.status === 'confirmed')
      const declinedCovers = sum(data || [], (b) => b.status === 'declined_by_restaurant')
      const cancelledCovers = sum(data || [], (b) => b.status === 'cancelled_by_user' || b.status === 'cancelled_by_restaurant')

      // Billable amount: price per accepted cover, by restaurant tier (basic: $1, pro: $0.7)
      const billableUSD = (data || []).reduce((acc: number, b: any) => {
        if (b.status !== 'confirmed') return acc
        const tier = b.restaurants?.tier || 'pro'
        const rate = tier === 'basic' ? 1 : 0.7
        return acc + (b.party_size || 0) * rate
      }, 0)

      setKpi({ total, accepted, cancelled, noShow, totalCovers, acceptedCovers, declinedCovers, cancelledCovers, billableUSD })

      // Peak hours (simple)
      const hourMap: Record<number, number> = {}
      data?.forEach((b: any) => {
        const h = new Date(b.booking_time).getHours(); hourMap[h] = (hourMap[h] || 0) + 1
      })
      const sorted = Object.entries(hourMap).map(([h,c]) => ({ hour: Number(h), count: c as number })).sort((a,b)=>a.hour-b.hour)
      setByHour(sorted)
    } catch (e) {
      console.error(e)
      toast.error('Failed to load report')
    } finally {
      setLoading(false)
    }
  }

  // Load comprehensive stats
  const loadComprehensiveStats = async () => {
    try {
      setLoading(true)
      
      // Build restaurant filter if needed
      const restaurantFilter = restaurantId !== 'all' ? { restaurant_id: restaurantId } : {}
      
      // Load User Stats
      const { data: userData } = await supabase.from('vw_user_summary_stats').select('*').single()
      if (userData) setUserStats(userData)
      
      // Load Booking Stats
      const { data: bookingData } = await supabase.from('vw_booking_summary_stats').select('*').single()
      if (bookingData) setBookingStats(bookingData)
      
      // Load Booking Rates
      const { data: ratesData } = await supabase.from('vw_booking_rates').select('*').single()
      if (ratesData) setBookingRates(ratesData)
      
      // Load Platform Revenue
      const { data: revenueData } = await supabase.from('vw_platform_revenue_summary').select('*').single()
      if (revenueData) setPlatformRevenue(revenueData)
      
      // Load Customer Demographics
      const { data: demoData } = await supabase.from('vw_customer_demographics').select('*').single()
      if (demoData) setCustomerDemographics(demoData)
      
      // Load Top Restaurants (with restaurant filter)
      let restaurantsQuery = supabase.from('vw_top_restaurants').select('*').limit(20)
      if (restaurantId !== 'all') restaurantsQuery = restaurantsQuery.eq('id', restaurantId)
      const { data: restaurantsData } = await restaurantsQuery
      if (restaurantsData) setTopRestaurants(restaurantsData)
      
      // Load Most Booked Users
      const { data: usersData } = await supabase.from('vw_most_booked_users').select('*').limit(50)
      if (usersData) setMostBookedUsers(usersData)
      
      // Load Booking Funnel
      const { data: funnelData } = await supabase.from('vw_booking_funnel').select('*')
      if (funnelData) setBookingFunnel(funnelData)
      
      // Load Recurring Users
      const { data: recurringData } = await supabase.from('vw_recurring_users').select('*').limit(50)
      if (recurringData) setRecurringUsers(recurringData)
      
      // Load Waiting Time Stats
      const { data: waitingData } = await supabase.from('vw_avg_waiting_time').select('*').single()
      if (waitingData) setWaitingTimeStats(waitingData)
      
    } catch (e) {
      console.error(e)
      toast.error('Failed to load comprehensive stats')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadRestaurants() }, [])
  useEffect(() => { loadKPIs() }, [restaurantId, dateFrom, dateTo])
  useEffect(() => { loadComprehensiveStats() }, [restaurantId])

  const applyFilters = () => {
    loadKPIs()
    loadComprehensiveStats()
  }

  const exportCSV = () => {
    const rows = [['Hour','Bookings'], ...byHour.map(x => [String(x.hour), String(x.count)])]
    const csv = rows.map(r => r.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'peak-hours.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  // Export helpers
  const downloadCSV = (filename: string, headers: string[], rows: (string | number | null | undefined)[][]) => {
    const csvRows = [headers.join(',')].concat(
      rows.map(r => r.map(v => {
        const s = v == null ? '' : String(v)
        // Escape quotes and commas
        if (s.includes('"') || s.includes(',') || s.includes('\n')) {
          return '"' + s.replace(/"/g, '""') + '"'
        }
        return s
      }).join(','))
    )
    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }

  const exportData = async () => {
    try {
      setLoading(true)
      if (exportEntity === 'bookings') {
        const headers = ['booking_id','restaurant_id','restaurant_name','restaurant_tier','status','party_size','booking_time','created_at','guest_name','guest_email']
        const all: any[] = []
        const pageSize = 1000
        for (let page = 0; page < 50; page++) {
          let query = supabase
            .from('bookings')
            .select('id, restaurant_id, status, party_size, booking_time, created_at, guest_name, guest_email, profiles:profiles!bookings_user_id_fkey(full_name, email), restaurants:restaurants!bookings_restaurant_id_fkey(name, tier)')
            .order('created_at', { ascending: false })
            .range(page * pageSize, page * pageSize + pageSize - 1)
          if (restaurantId !== 'all') query = query.eq('restaurant_id', restaurantId)
          if (dateFrom) query = query.gte('booking_time', new Date(dateFrom).toISOString())
          if (dateTo) { const end = new Date(dateTo); end.setHours(23,59,59,999); query = query.lte('booking_time', end.toISOString()) }
          if (exportStatus !== 'all') query = query.eq('status', exportStatus)
          const { data, error } = await query
          if (error) throw error
          const chunk = (data || [])
            .filter((b: any) => {
              const q = exportUserQuery.trim().toLowerCase()
              if (!q) return true
              const name = (b.guest_name || b.profiles?.full_name || '').toLowerCase()
              const email = (b.guest_email || b.profiles?.email || '').toLowerCase()
              return name.includes(q) || email.includes(q)
            })
          all.push(...chunk)
          if (!data || data.length < pageSize) break
        }
        const rows = all.map((b: any) => [
          b.id,
          b.restaurant_id,
          b.restaurants?.name || '',
          b.restaurants?.tier || '',
          b.status,
          b.party_size,
          b.booking_time,
          b.created_at,
          b.guest_name || b.profiles?.full_name || '',
          b.guest_email || b.profiles?.email || ''
        ])
        downloadCSV('bookings_export.csv', headers, rows)
      } else {
        const headers = ['review_id','restaurant_id','restaurant_name','user_id','reviewer_name','reviewer_email','rating','comment','created_at','flags']
        const all: any[] = []
        const pageSize = 1000
        for (let page = 0; page < 50; page++) {
          let query = supabase
            .from('reviews')
            .select('id, restaurant_id, user_id, rating, comment, created_at, restaurants:restaurants!reviews_restaurant_id_fkey(name), profiles:profiles!reviews_user_id_fkey(full_name, email), review_reports:review_reports(count)')
            .order('created_at', { ascending: false })
            .range(page * pageSize, page * pageSize + pageSize - 1)
          if (restaurantId !== 'all') query = query.eq('restaurant_id', restaurantId)
          if (dateFrom) query = query.gte('created_at', new Date(dateFrom).toISOString())
          if (dateTo) { const end = new Date(dateTo); end.setHours(23,59,59,999); query = query.lte('created_at', end.toISOString()) }
          const { data, error } = await query
          if (error) throw error
          const chunk = (data || [])
            .filter((r: any) => {
              const q = exportUserQuery.trim().toLowerCase()
              if (!q) return true
              const name = (r.profiles?.full_name || '').toLowerCase()
              const email = (r.profiles?.email || '').toLowerCase()
              const comment = (r.comment || '').toLowerCase()
              return name.includes(q) || email.includes(q) || comment.includes(q)
            })
          all.push(...chunk)
          if (!data || data.length < pageSize) break
        }
        const rows = all.map((r: any) => [
          r.id,
          r.restaurant_id,
          r.restaurants?.name || '',
          r.user_id,
          r.profiles?.full_name || '',
          r.profiles?.email || '',
          r.rating,
          r.comment || '',
          r.created_at,
          (r.review_reports && r.review_reports[0]?.count) ? r.review_reports[0].count : 0
        ])
        downloadCSV('reviews_export.csv', headers, rows)
      }
      toast.success('Export ready')
    } catch (e) {
      console.error(e)
      toast.error('Export failed')
    } finally {
      setLoading(false)
    }
  }

  const acceptanceRate = useMemo(() => {
    const totalDecided = kpi.accepted + kpi.cancelled
    if (totalDecided === 0) return 0
    return Math.round((kpi.accepted / totalDecided) * 100)
  }, [kpi])

  const exportViewCSV = async (viewName: string, headers: string[]) => {
    try {
      const { data, error } = await supabase.from(viewName).select('*')
      if (error) throw error
      if (!data) return
      
      const csv = [
        headers.join(','),
        ...data.map(row => Object.values(row).map(v => 
          v === null || v === undefined ? '' : String(v).replace(/"/g, '""').replace(/,/g, ';')
        ).join(','))
      ].join('\n')
      
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${viewName}.csv`
      a.click()
      URL.revokeObjectURL(url)
      toast.success('Export ready')
    } catch (e) {
      console.error(e)
      toast.error('Export failed')
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold">Comprehensive Reports</h2>
        <Button variant="outline" size="sm" onClick={() => { loadKPIs(); loadComprehensiveStats() }} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} /> Refresh All
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
            <div>
              <Select value={restaurantId} onValueChange={setRestaurantId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="All restaurants" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All restaurants</SelectItem>
                  {restaurants.map(r => (
                    <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <Input type="date" value={dateFrom} onChange={(e)=>setDateFrom(e.target.value)} />
            </div>
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <Input type="date" value={dateTo} onChange={(e)=>setDateTo(e.target.value)} />
            </div>
            <div className="flex sm:justify-end">
              <Button onClick={applyFilters} disabled={loading} className="w-full sm:w-auto">Apply</Button>
            </div>
          </div>
          <div className="text-xs text-muted-foreground">Date range: {dateSummary}</div>
        </CardContent>
      </Card>

      {/* Tabs for different report sections */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="bookings">Bookings</TabsTrigger>
          <TabsTrigger value="revenue">Revenue</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        {/* OVERVIEW TAB */}
        <TabsContent value="overview" className="space-y-4">
          {/* User Stats */}
          {userStats && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle><Users className="inline h-5 w-5 mr-2" /> User Analytics</CardTitle>
                  <Button variant="outline" size="sm" onClick={() => exportViewCSV('vw_user_summary_stats', ['total_users', 'new_users_7d', 'new_users_today', 'active_users_7d'])}>
                    <Download className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Total Users</p>
                    <p className="text-2xl font-bold">{userStats.total_users}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">New (7d)</p>
                    <p className="text-2xl font-bold text-green-600">+{userStats.new_users_7d}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Active (Daily)</p>
                    <p className="text-2xl font-bold text-blue-600">{userStats.active_users_daily}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Active (Weekly)</p>
                    <p className="text-2xl font-bold text-purple-600">{userStats.active_users_weekly}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Active (Monthly)</p>
                    <p className="text-2xl font-bold text-orange-600">{userStats.active_users_monthly}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">With Bookings</p>
                    <p className="text-2xl font-bold text-teal-600">{userStats.users_with_bookings}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Booking Stats */}
          {bookingStats && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle><BarChart3 className="inline h-5 w-5 mr-2" /> Booking Analytics</CardTitle>
                  <Button variant="outline" size="sm" onClick={() => exportViewCSV('vw_booking_summary_stats', ['total_bookings', 'bookings_7d', 'completed_bookings', 'total_covers'])}>
                    <Download className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Total Bookings</p>
                    <p className="text-2xl font-bold">{bookingStats.total_bookings}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Completed</p>
                    <p className="text-2xl font-bold text-green-600">{bookingStats.completed_bookings}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Total Covers</p>
                    <p className="text-2xl font-bold">{bookingStats.total_covers}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Avg Party Size</p>
                    <p className="text-2xl font-bold">{bookingStats.avg_party_size?.toFixed(1)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Booking Rates */}
          {bookingRates && (
            <Card>
              <CardHeader>
                <CardTitle><Target className="inline h-5 w-5 mr-2" /> Booking Performance</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-4">
                  <div className="text-center p-4 bg-green-50 rounded-lg">
                    <p className="text-sm text-muted-foreground">Completion Rate</p>
                    <p className="text-3xl font-bold text-green-600">{bookingRates.completion_rate_pct.toFixed(1)}%</p>
                    <p className="text-xs text-muted-foreground">{bookingRates.completed_bookings} bookings</p>
                  </div>
                  <div className="text-center p-4 bg-red-50 rounded-lg">
                    <p className="text-sm text-muted-foreground">Cancellation Rate</p>
                    <p className="text-3xl font-bold text-red-600">{bookingRates.cancellation_rate_pct.toFixed(1)}%</p>
                    <p className="text-xs text-muted-foreground">{bookingRates.cancelled_bookings} bookings</p>
                  </div>
                  <div className="text-center p-4 bg-orange-50 rounded-lg">
                    <p className="text-sm text-muted-foreground">No-Show Rate</p>
                    <p className="text-3xl font-bold text-orange-600">{bookingRates.no_show_rate_pct.toFixed(1)}%</p>
                    <p className="text-xs text-muted-foreground">{bookingRates.no_show_bookings} bookings</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Booking Funnel */}
          {bookingFunnel.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle><Activity className="inline h-5 w-5 mr-2" /> Booking Funnel</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {bookingFunnel.map((stage, i) => (
                    <div key={i} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                      <span className="font-medium">{stage.stage}</span>
                      <div className="flex items-center gap-4">
                        <span className="text-sm text-muted-foreground">{stage.count} ({stage.percentage}%)</span>
                        <span className="text-sm font-semibold">{stage.covers} covers</span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Waiting Time Stats */}
          {waitingTimeStats && (
            <Card>
              <CardHeader>
                <CardTitle><Clock className="inline h-5 w-5 mr-2" /> Response Time (Pending to Confirmed/Declined)</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="p-4 bg-blue-50 rounded-lg">
                    <p className="text-sm text-muted-foreground">Avg Response</p>
                    <p className="text-2xl font-bold">{waitingTimeStats.avg_response_time_minutes}m</p>
                    <p className="text-xs text-muted-foreground">({waitingTimeStats.avg_response_time_hours} hours)</p>
                  </div>
                  <div className="p-4 bg-green-50 rounded-lg">
                    <p className="text-sm text-muted-foreground">Fastest Response</p>
                    <p className="text-2xl font-bold">{waitingTimeStats.min_response_minutes}m</p>
                  </div>
                  <div className="p-4 bg-orange-50 rounded-lg">
                    <p className="text-sm text-muted-foreground">Slowest Response</p>
                    <p className="text-2xl font-bold">{waitingTimeStats.max_response_minutes}m</p>
                  </div>
                  <div className="p-4 bg-purple-50 rounded-lg">
                    <p className="text-sm text-muted-foreground">Bookings</p>
                    <p className="text-2xl font-bold">{waitingTimeStats.bookings_count}</p>
                    <p className="text-xs text-muted-foreground">{waitingTimeStats.confirmed_count} confirmed</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* USERS TAB */}
        <TabsContent value="users" className="space-y-4">
          {/* Most Booked Users */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle><Users className="inline h-5 w-5 mr-2" /> Most Active Users</CardTitle>
                <Button variant="outline" size="sm" onClick={() => exportViewCSV('vw_most_booked_users', ['full_name', 'email', 'total_bookings', 'total_covers', 'completed_bookings'])}>
                  <Download className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="p-2 text-left text-sm font-semibold">User</th>
                      <th className="p-2 text-left text-sm font-semibold">Bookings</th>
                      <th className="p-2 text-left text-sm font-semibold">Total Covers</th>
                      <th className="p-2 text-left text-sm font-semibold">Completed</th>
                      <th className="p-2 text-left text-sm font-semibold">Last Booking</th>
                    </tr>
                  </thead>
                  <tbody>
                    {mostBookedUsers.slice(0, 20).map((user, i) => (
                      <tr key={user.id} className="border-b">
                        <td className="p-2">
                          <div>
                            <div className="font-medium">{user.full_name || 'Guest'}</div>
                            <div className="text-xs text-muted-foreground">{user.email}</div>
                          </div>
                        </td>
                        <td className="p-2">{user.total_bookings}</td>
                        <td className="p-2">{user.total_covers}</td>
                        <td className="p-2 text-green-600">{user.completed_bookings}</td>
                        <td className="p-2 text-xs">{new Date(user.last_booking_date).toLocaleDateString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Customer Demographics */}
          {customerDemographics && (
            <Card>
              <CardHeader>
                <CardTitle><Target className="inline h-5 w-5 mr-2" /> Customer Insights</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="p-4 bg-blue-50 rounded-lg">
                    <p className="text-sm text-muted-foreground">Total Customers</p>
                    <p className="text-2xl font-bold">{customerDemographics.total_customers}</p>
                  </div>
                  <div className="p-4 bg-green-50 rounded-lg">
                    <p className="text-sm text-muted-foreground">Avg Age</p>
                    <p className="text-2xl font-bold">{customerDemographics.avg_age || 'N/A'}</p>
                  </div>
                  <div className="p-4 bg-purple-50 rounded-lg">
                    <p className="text-sm text-muted-foreground">With Bookings</p>
                    <p className="text-2xl font-bold">{customerDemographics.customers_with_bookings}</p>
                  </div>
                  <div className="p-4 bg-orange-50 rounded-lg">
                    <p className="text-sm text-muted-foreground">Avg Party Size</p>
                    <p className="text-2xl font-bold">{customerDemographics.avg_party_size_per_booking?.toFixed(1)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Recurring Users */}
          {recurringUsers.length > 0 && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle><Users className="inline h-5 w-5 mr-2" /> Recurring Users (2+ bookings in 20 days)</CardTitle>
                  <Button variant="outline" size="sm" onClick={() => exportViewCSV('vw_recurring_users', ['full_name', 'email', 'bookings_past_20d', 'covers_past_20d'])}>
                    <Download className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-lg font-semibold mb-4">Total Recurring Users: <span className="text-purple-600">{recurringUsers.length}</span></div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="p-2 text-left text-sm font-semibold">User</th>
                        <th className="p-2 text-left text-sm font-semibold">Bookings (20d)</th>
                        <th className="p-2 text-left text-sm font-semibold">Covers (20d)</th>
                        <th className="p-2 text-left text-sm font-semibold">Last Booking</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recurringUsers.slice(0, 20).map((user, i) => (
                        <tr key={user.user_id} className="border-b">
                          <td className="p-2">
                            <div className="font-medium">{user.full_name || 'Guest'}</div>
                            <div className="text-xs text-muted-foreground">{user.email}</div>
                          </td>
                          <td className="p-2 text-purple-600 font-semibold">{user.bookings_past_20d}</td>
                          <td className="p-2">{user.covers_past_20d}</td>
                          <td className="p-2 text-xs">{new Date(user.last_booking).toLocaleDateString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* BOOKINGS TAB */}
        <TabsContent value="bookings" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle><BarChart3 className="inline h-5 w-5 mr-2" /> Peak Hours</CardTitle>
                <Button variant="outline" size="sm" onClick={exportCSV}>
                  <Download className="h-4 w-4 mr-2" /> CSV
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {byHour.length === 0 ? (
                <div className="text-sm text-muted-foreground">No data for selected period.</div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-12 gap-2">
                  {byHour.map(h => (
                    <div key={h.hour} className="border rounded p-2 text-center bg-white">
                      <div className="text-xs text-muted-foreground">{String(h.hour).padStart(2,'0')}:00</div>
                      <div className="text-xl font-semibold">{h.count}</div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Universal Export */}
          <Card>
            <CardHeader>
              <CardTitle>Export Bookings Data</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div>
                  <Select value={exportEntity} onValueChange={(v: any) => setExportEntity(v)}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="bookings">Bookings</SelectItem>
                      <SelectItem value="reviews">Reviews</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {exportEntity === 'bookings' && (
                  <div>
                    <Select value={exportStatus} onValueChange={(v: any) => setExportStatus(v)}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All statuses</SelectItem>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="confirmed">Confirmed</SelectItem>
                        <SelectItem value="cancelled_by_user">Cancelled by user</SelectItem>
                        <SelectItem value="cancelled_by_restaurant">Cancelled by restaurant</SelectItem>
                        <SelectItem value="declined_by_restaurant">Declined by restaurant</SelectItem>
                        <SelectItem value="completed">Completed</SelectItem>
                        <SelectItem value="no_show">No show</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <div className="sm:col-span-2">
                  <Input
                    placeholder="Filter by user name or email"
                    value={exportUserQuery}
                    onChange={(e) => setExportUserQuery(e.target.value)}
                  />
                </div>
              </div>
              <Button onClick={exportData} disabled={loading} className="w-full">
                <Download className="h-4 w-4 mr-2" /> Export CSV
              </Button>
              <div className="text-xs text-muted-foreground">
                Uses the restaurant and date filters above.
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* REVENUE TAB */}
        <TabsContent value="revenue" className="space-y-4">
          {platformRevenue && (
            <>
              <Card>
                <CardHeader>
                  <CardTitle><DollarSign className="inline h-5 w-5 mr-2" /> Platform Revenue</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="p-4 bg-green-50 rounded-lg">
                      <p className="text-sm text-muted-foreground">Basic Restaurants</p>
                      <p className="text-2xl font-bold">{platformRevenue.basic_restaurants}</p>
                    </div>
                    <div className="p-4 bg-blue-50 rounded-lg">
                      <p className="text-sm text-muted-foreground">Pro Restaurants</p>
                      <p className="text-2xl font-bold">{platformRevenue.pro_restaurants}</p>
                    </div>
                    <div className="p-4 bg-purple-50 rounded-lg">
                      <p className="text-sm text-muted-foreground">Completed Covers</p>
                      <p className="text-2xl font-bold">{platformRevenue.total_completed_covers}</p>
                    </div>
                    <div className="p-4 bg-emerald-50 rounded-lg">
                      <p className="text-sm text-muted-foreground">Est. Revenue</p>
                      <p className="text-2xl font-bold">${platformRevenue.total_estimated_revenue_usd?.toFixed(0)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Button onClick={() => exportViewCSV('vw_restaurant_revenue_estimate', ['restaurant_name', 'tier', 'completed_covers', 'estimated_revenue_usd'])} className="w-full">
                <Download className="h-4 w-4 mr-2" /> Export Restaurant Revenue Estimate
              </Button>
            </>
          )}
        </TabsContent>

        {/* ANALYTICS TAB */}
        <TabsContent value="analytics" className="space-y-4">
          {/* Top Restaurants */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle><TrendingUp className="inline h-5 w-5 mr-2" /> Top Performing Restaurants</CardTitle>
                <Button variant="outline" size="sm" onClick={() => exportViewCSV('vw_top_restaurants', ['name', 'tier', 'total_bookings', 'completed_bookings', 'total_covers'])}>
                  <Download className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="p-2 text-left text-sm font-semibold">Restaurant</th>
                      <th className="p-2 text-left text-sm font-semibold">Tier</th>
                      <th className="p-2 text-left text-sm font-semibold">Total</th>
                      <th className="p-2 text-left text-sm font-semibold">Completed</th>
                      <th className="p-2 text-left text-sm font-semibold">Completed Covers</th>
                      <th className="p-2 text-left text-sm font-semibold">Restaurant Revenue</th>
                      <th className="p-2 text-left text-sm font-semibold">Last 7d</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topRestaurants.slice(0, 20).map((restaurant, i) => (
                      <tr key={restaurant.id} className="border-b">
                        <td className="p-2 font-medium">{restaurant.name}</td>
                        <td className="p-2">
                          <span className={`px-2 py-1 rounded text-xs ${
                            restaurant.tier === 'pro' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700'
                          }`}>{restaurant.tier}</span>
                        </td>
                        <td className="p-2">{restaurant.total_bookings}</td>
                        <td className="p-2 text-green-600">{restaurant.completed_bookings}</td>
                        <td className="p-2 font-semibold">{restaurant.completed_covers}</td>
                        <td className="p-2 text-emerald-600">${restaurant.restaurant_revenue_est?.toFixed(0) || 0}</td>
                        <td className="p-2 text-blue-600">{restaurant.bookings_last_7d}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}


