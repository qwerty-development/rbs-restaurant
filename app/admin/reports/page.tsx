'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { toast } from 'react-hot-toast'
import { Calendar, Download, RefreshCw, TrendingUp, Users, CheckCircle2, XCircle, DollarSign, BarChart3, Activity, Target, CreditCard, Clock, AlertCircle, FileText } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { generateComprehensivePDF } from '@/lib/utils/pdf-export'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useReportFilters } from '@/hooks/use-report-filters'
import { SortableTable, Column } from './sortable-table'
import { EXCLUDED_RESTAURANT_IDS } from '@/lib/config/excluded-restaurants'
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
} from 'recharts'

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

type BookingsByHour = {
  hour: number
  count: number
  label: string
}

export default function AdminReportsPage() {
  const supabase = createClient()
  const { filters, updateFilters, getDateFilter } = useReportFilters()

  const [restaurants, setRestaurants] = useState<{ id: string; name: string }[]>([])
  const [loading, setLoading] = useState(false)
  const [kpi, setKpi] = useState<KPI>({ total: 0, accepted: 0, cancelled: 0, noShow: 0, totalCovers: 0, acceptedCovers: 0, declinedCovers: 0, cancelledCovers: 0, billableUSD: 0 })
  const [byHour, setByHour] = useState<{ hour: number; count: number }[]>([])
  const [creationHourTotals, setCreationHourTotals] = useState<BookingsByHour[]>([])
  const [creationHourByDate, setCreationHourByDate] = useState<Record<string, BookingsByHour[]>>({})
  const [creationChartDate, setCreationChartDate] = useState<string>('all')
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
  const [activationMetrics, setActivationMetrics] = useState<any>(null)
  const [showExportDialog, setShowExportDialog] = useState(false)
  const [exportDateRange, setExportDateRange] = useState<{ from: string; to: string }>({
    from: '2024-10-10',
    to: '2024-11-10'
  })

  const buildCreationSeries = (source: Record<number, number>): BookingsByHour[] => {
    return Array.from({ length: 24 }, (_, hour) => ({
      hour,
      label: `${String(hour).padStart(2, '0')}:00`,
      count: source[hour] || 0,
    }))
  }

  // User-specific filters
  const [userFilterMinBookings, setUserFilterMinBookings] = useState<string>('')
  const [userFilterMinCompleted, setUserFilterMinCompleted] = useState<string>('')
  const [userFilterActiveOnly, setUserFilterActiveOnly] = useState<boolean>(false)

  const dateSummary = useMemo(() => {
    if (!filters.dateRange.from && !filters.dateRange.to) return 'All time'
    return `${filters.dateRange.from || '…'} → ${filters.dateRange.to || '…'}`
  }, [filters.dateRange])

  const loadRestaurants = async () => {
    try {
      const { data, error } = await supabase.from('restaurants').select('id, name').not('id', 'in', `(${EXCLUDED_RESTAURANT_IDS.join(',')})`).order('name')
      if (error) throw error
      setRestaurants(data || [])
    } catch (e) {
      console.error(e)
    }
  }

  const loadKPIs = async () => {
    try {
      setLoading(true)
      const dateFilter = getDateFilter()
      let base = supabase
        .from('bookings')
        .select('status, booking_time, created_at, party_size, restaurant_id, restaurants:restaurants!bookings_restaurant_id_fkey(tier)', { count: 'exact', head: false })
        .not('restaurant_id', 'in', `(${EXCLUDED_RESTAURANT_IDS.join(',')})`)
      if (filters.restaurantId !== 'all') base = base.eq('restaurant_id', filters.restaurantId)
      if (dateFilter.from) base = base.gte('booking_time', dateFilter.from)
      if (dateFilter.to) base = base.lte('booking_time', dateFilter.to)

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

      // Peak hours by reservation time
      const hourMap: Record<number, number> = {}
      // Booking creation time distribution (aggregate + per-day)
      const creationTotalsMap: Record<number, number> = {}
      const creationByDateMap: Record<string, Record<number, number>> = {}
      data?.forEach((b: any) => {
        const bookingTime = b.booking_time ? new Date(b.booking_time) : null
        if (bookingTime) {
          const hour = bookingTime.getHours()
          hourMap[hour] = (hourMap[hour] || 0) + 1
        }

        const createdAt = b.created_at ? new Date(b.created_at) : null
        if (createdAt && !Number.isNaN(createdAt.getTime())) {
          const creationHour = createdAt.getHours()
          creationTotalsMap[creationHour] = (creationTotalsMap[creationHour] || 0) + 1
          const dateKey = createdAt.toISOString().slice(0, 10)
          creationByDateMap[dateKey] = creationByDateMap[dateKey] || {}
          creationByDateMap[dateKey][creationHour] = (creationByDateMap[dateKey][creationHour] || 0) + 1
        }
      })
      const sorted = Object.entries(hourMap)
        .map(([h, c]) => ({ hour: Number(h), count: c as number }))
        .sort((a, b) => a.hour - b.hour)
      setByHour(sorted)

      setCreationHourTotals(buildCreationSeries(creationTotalsMap))
      const perDateSeries: Record<string, BookingsByHour[]> = {}
      Object.entries(creationByDateMap).forEach(([date, map]) => {
        perDateSeries[date] = buildCreationSeries(map)
      })
      setCreationHourByDate(perDateSeries)
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
      
      // Load User Stats - always platform-wide
      const { data: userData } = await supabase.from('vw_user_summary_stats').select('*').single()
      if (userData) setUserStats(userData)
      
      // Load Booking Stats - always platform-wide
      const { data: bookingData } = await supabase.from('vw_booking_summary_stats').select('*').single()
      if (bookingData) setBookingStats(bookingData)
      
      // Load Booking Rates - always platform-wide
      const { data: ratesData } = await supabase.from('vw_booking_rates').select('*').single()
      if (ratesData) setBookingRates(ratesData)
      
      // Load Platform Revenue - always platform-wide (no restaurant filter)
      const { data: revenueData } = await supabase.from('vw_platform_revenue_summary').select('*').single()
      if (revenueData) setPlatformRevenue(revenueData)
      
      // Load Customer Demographics - always platform-wide
      const { data: demoData } = await supabase.from('vw_customer_demographics').select('*').single()
      if (demoData) setCustomerDemographics(demoData)
      
      // Load Top Restaurants
      let restaurantsQuery = supabase.from('vw_top_restaurants').select('*').limit(20)
      if (filters.restaurantId !== 'all') {
        restaurantsQuery = restaurantsQuery.eq('id', filters.restaurantId)
      }
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
      
      // Load Activation Metrics
      const { data: activationData } = await supabase.rpc('get_activation_metrics')
      if (activationData) setActivationMetrics(activationData)
      
    } catch (e) {
      console.error(e)
      toast.error('Failed to load comprehensive stats')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadRestaurants() }, [])
  useEffect(() => { loadKPIs() }, [filters.restaurantId, filters.dateRange.from, filters.dateRange.to])
  useEffect(() => { loadComprehensiveStats() }, [])
  useEffect(() => {
    if (creationChartDate !== 'all' && !creationHourByDate[creationChartDate]) {
      setCreationChartDate('all')
    }
  }, [creationChartDate, creationHourByDate])

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
        const dateFilter = getDateFilter()
        for (let page = 0; page < 50; page++) {
          let query = supabase
            .from('bookings')
            .select('id, restaurant_id, status, party_size, booking_time, created_at, guest_name, guest_email, profiles:profiles!bookings_user_id_fkey(full_name, email), restaurants:restaurants!bookings_restaurant_id_fkey(name, tier)')
            .order('created_at', { ascending: false })
            .range(page * pageSize, page * pageSize + pageSize - 1)
          if (filters.restaurantId !== 'all') query = query.eq('restaurant_id', filters.restaurantId)
          if (dateFilter.from) query = query.gte('booking_time', dateFilter.from)
          if (dateFilter.to) query = query.lte('booking_time', dateFilter.to)
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
        const dateFilter = getDateFilter()
        const headers = ['review_id','restaurant_id','restaurant_name','user_id','reviewer_name','reviewer_email','rating','comment','created_at','flags']
        const all: any[] = []
        const pageSize = 1000
        for (let page = 0; page < 50; page++) {
          let query = supabase
            .from('reviews')
            .select('id, restaurant_id, user_id, rating, comment, created_at, restaurants:restaurants!reviews_restaurant_id_fkey(name), profiles:profiles!reviews_user_id_fkey(full_name, email), review_reports:review_reports(count)')
            .order('created_at', { ascending: false })
            .range(page * pageSize, page * pageSize + pageSize - 1)
          if (filters.restaurantId !== 'all') query = query.eq('restaurant_id', filters.restaurantId)
          if (dateFilter.from) query = query.gte('created_at', dateFilter.from)
          if (dateFilter.to) query = query.lte('created_at', dateFilter.to)
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

  const creationSeries = useMemo(() => {
    if (creationChartDate !== 'all' && creationHourByDate[creationChartDate]) {
      return creationHourByDate[creationChartDate]
    }
    return creationHourTotals
  }, [creationChartDate, creationHourByDate, creationHourTotals])

  const creationDateOptions = useMemo(() => {
    return Object.keys(creationHourByDate).sort((a, b) => {
      const aTime = new Date(a).getTime()
      const bTime = new Date(b).getTime()
      return bTime - aTime
    })
  }, [creationHourByDate])

  const creationInsights = useMemo(() => {
    if (!creationSeries.length) return null
    const total = creationSeries.reduce((sum, entry) => sum + entry.count, 0)
    if (total === 0) {
      return {
        total: 0,
        peak: null,
        share: 0,
        topThree: [] as BookingsByHour[],
      }
    }
    const peak = creationSeries.reduce((max, entry) => (entry.count > max.count ? entry : max), creationSeries[0])
    const topThree = [...creationSeries].sort((a, b) => b.count - a.count).slice(0, 3)

    return {
      total,
      peak,
      share: Math.round((peak.count / total) * 100),
      topThree,
    }
  }, [creationSeries])
  const hasCreationData = !!(creationInsights && creationInsights.total > 0)

  const acceptanceRate = useMemo(() => {
    const totalDecided = kpi.accepted + kpi.cancelled
    if (totalDecided === 0) return 0
    return Math.round((kpi.accepted / totalDecided) * 100)
  }, [kpi])

  // Filter users based on user-specific filters
  const filteredMostActiveUsers = useMemo(() => {
    return mostBookedUsers.filter(user => {
      if (userFilterMinBookings && user.total_bookings < parseInt(userFilterMinBookings)) return false
      if (userFilterMinCompleted && user.completed_bookings < parseInt(userFilterMinCompleted)) return false
      if (userFilterActiveOnly && user.total_bookings === 0) return false
      return true
    })
  }, [mostBookedUsers, userFilterMinBookings, userFilterMinCompleted, userFilterActiveOnly])

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

  const exportAllToPDF = async () => {
    try {
      setLoading(true)
      toast.loading('Generating comprehensive PDF report...', { id: 'pdf-export' })
      
      // Use selected date range or default to Oct 10 - Nov 10
      const fromDate = new Date(exportDateRange.from + 'T00:00:00Z')
      const toDate = new Date(exportDateRange.to + 'T23:59:59Z')
      
      // Temporarily update filters to get accurate data for the selected range
      const originalFrom = filters.dateRange.from
      const originalTo = filters.dateRange.to
      
      updateFilters({
        ...filters,
        dateRange: {
          from: exportDateRange.from,
          to: exportDateRange.to
        }
      })
      
      // Wait for filters to update and reload data
      await new Promise(resolve => setTimeout(resolve, 500))
      await Promise.all([loadKPIs(), loadComprehensiveStats()])
      
      // Wait for data to load
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      // Generate PDF
      await generateComprehensivePDF({
        userStats,
        bookingStats,
        bookingRates,
        platformRevenue,
        customerDemographics,
        kpi,
        topRestaurants,
        mostBookedUsers,
        bookingFunnel,
        recurringUsers,
        waitingTimeStats,
        byHour,
        activationMetrics,
        dateRange: {
          from: fromDate.toISOString(),
          to: toDate.toISOString()
        }
      })
      
      // Restore original filters
      updateFilters({
        ...filters,
        dateRange: {
          from: originalFrom,
          to: originalTo
        }
      })
      
      toast.success('PDF report generated successfully!', { id: 'pdf-export' })
      setShowExportDialog(false)
    } catch (error) {
      console.error('PDF export error:', error)
      toast.error('Failed to generate PDF report. Please ensure all data is loaded.', { id: 'pdf-export' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold">Comprehensive Reports</h2>
        <div className="flex gap-2">
          <Button 
            variant="default" 
            size="sm" 
            onClick={() => setShowExportDialog(true)} 
            disabled={loading}
            className="bg-blue-600 hover:bg-blue-700"
          >
            <FileText className={`h-4 w-4 mr-2 ${loading ? 'animate-pulse' : ''}`} /> Export All (PDF)
          </Button>
          <Button variant="outline" size="sm" onClick={() => { loadKPIs(); loadComprehensiveStats() }} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} /> Refresh All
          </Button>
        </div>
      </div>

      {/* Export PDF Dialog */}
      <Dialog open={showExportDialog} onOpenChange={setShowExportDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Export Comprehensive PDF Report</DialogTitle>
            <DialogDescription>
              Select the date range for your report. The report will include all analytics, metrics, and insights for the selected period.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="from-date">From Date</Label>
              <Input
                id="from-date"
                type="date"
                value={exportDateRange.from}
                onChange={(e) => setExportDateRange({ ...exportDateRange, from: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="to-date">To Date</Label>
              <Input
                id="to-date"
                type="date"
                value={exportDateRange.to}
                onChange={(e) => setExportDateRange({ ...exportDateRange, to: e.target.value })}
              />
            </div>
            <div className="text-sm text-muted-foreground">
              <p className="font-semibold mb-1">Report will include:</p>
              <ul className="list-disc list-inside space-y-1">
                <li>User analytics & 30-day activation rates</li>
                <li>Booking metrics & conversion rates</li>
                <li>Revenue analysis</li>
                <li>Customer demographics</li>
                <li>Top restaurants & users</li>
                <li>Peak hours analysis</li>
                <li>Key insights & recommendations</li>
                <li>Complete calculation methodology</li>
              </ul>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowExportDialog(false)}>
              Cancel
            </Button>
            <Button onClick={exportAllToPDF} disabled={loading} className="bg-blue-600 hover:bg-blue-700">
              {loading ? 'Generating...' : 'Generate PDF'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">
                📊 Platform-wide statistics showing overall user activity, bookings, and performance metrics.
              </p>
            </CardContent>
          </Card>

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
          {/* User-Specific Filters */}
          <Card>
            <CardContent className="p-4">
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div>
                  <label className="text-sm font-medium mb-1 block">Min Total Bookings</label>
                  <Input 
                    type="number" 
                    placeholder="e.g. 5"
                    value={userFilterMinBookings}
                    onChange={(e) => setUserFilterMinBookings(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Min Completed Bookings</label>
                  <Input 
                    type="number" 
                    placeholder="e.g. 3"
                    value={userFilterMinCompleted}
                    onChange={(e) => setUserFilterMinCompleted(e.target.value)}
                  />
                </div>
                <div className="flex items-end">
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={userFilterActiveOnly}
                      onChange={(e) => setUserFilterActiveOnly(e.target.checked)}
                      className="rounded"
                    />
                    <span className="text-sm font-medium">Active users only</span>
                  </label>
                </div>
                <div className="flex items-end">
                  <Button 
                    variant="outline" 
                    onClick={() => {
                      setUserFilterMinBookings('')
                      setUserFilterMinCompleted('')
                      setUserFilterActiveOnly(false)
                    }}
                    className="w-full"
                  >
                    Clear Filters
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Most Booked Users */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle><Users className="inline h-5 w-5 mr-2" /> Most Active Users</CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">
                    Showing {filteredMostActiveUsers.length} of {mostBookedUsers.length} users
                  </p>
                </div>
                <Button variant="outline" size="sm" onClick={() => exportViewCSV('vw_most_booked_users', ['full_name', 'email', 'total_bookings', 'total_covers', 'completed_bookings'])}>
                  <Download className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <SortableTable
                data={filteredMostActiveUsers}
                columns={[
                  {
                    key: 'full_name',
                    label: 'User',
                    sortable: true,
                    render: (value, row) => (
                      <div>
                        <div className="font-medium">{row.full_name || 'Guest'}</div>
                        <div className="text-xs text-muted-foreground">{row.email}</div>
                      </div>
                    )
                  },
                  { key: 'total_bookings', label: 'Bookings', sortable: true },
                  { key: 'total_covers', label: 'Total Covers', sortable: true },
                  {
                    key: 'completed_bookings',
                    label: 'Completed',
                    sortable: true,
                    render: (value) => <span className="text-green-600">{value}</span>
                  },
                  {
                    key: 'last_booking_date',
                    label: 'Last Booking',
                    sortable: true,
                    render: (value) => (
                      <span className="text-xs">{new Date(value).toLocaleDateString()}</span>
                    )
                  }
                ]}
                defaultSort={{ key: 'total_bookings', direction: 'desc' }}
              />
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
                  <CardTitle><Users className="inline h-5 w-5 mr-2" /> Recurring Users (2+ completed bookings in 20 days)</CardTitle>
                  <Button variant="outline" size="sm" onClick={() => exportViewCSV('vw_recurring_users', ['full_name', 'email', 'bookings_past_20d', 'covers_past_20d'])}>
                    <Download className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-lg font-semibold mb-4">Total Recurring Users: <span className="text-purple-600">{recurringUsers.length}</span></div>
                <SortableTable
                  data={recurringUsers}
                  columns={[
                    {
                      key: 'full_name',
                      label: 'User',
                      sortable: true,
                      render: (value, row) => (
                        <div>
                          <div className="font-medium">{row.full_name || 'Guest'}</div>
                          <div className="text-xs text-muted-foreground">{row.email}</div>
                        </div>
                      )
                    },
                    { key: 'bookings_past_20d', label: 'Bookings (20d)', sortable: true, render: (value) => <span className="text-purple-600 font-semibold">{value}</span> },
                    { key: 'covers_past_20d', label: 'Covers (20d)', sortable: true },
                    {
                      key: 'last_booking',
                      label: 'Last Booking',
                      sortable: true,
                      render: (value) => (
                        <span className="text-xs">{new Date(value).toLocaleDateString()}</span>
                      )
                    }
                  ]}
                  defaultSort={{ key: 'bookings_past_20d', direction: 'desc' }}
                />
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* BOOKINGS TAB */}
        <TabsContent value="bookings" className="space-y-4">
          {/* Booking-Specific Filters */}
          <Card>
            <CardContent className="p-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-sm font-medium mb-1 block">Restaurant</label>
                  <Select value={filters.restaurantId} onValueChange={(v) => updateFilters({ restaurantId: v })}>
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
                <div>
                  <label className="text-sm font-medium mb-1 block">From Date</label>
                  <Input 
                    type="date" 
                    value={filters.dateRange.from} 
                    onChange={(e) => updateFilters({ dateRange: { ...filters.dateRange, from: e.target.value } })}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">To Date</label>
                  <Input 
                    type="date" 
                    value={filters.dateRange.to} 
                    onChange={(e) => updateFilters({ dateRange: { ...filters.dateRange, to: e.target.value } })}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

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

          <Card>
            <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5 text-indigo-500" />
                  Booking Creation Pulse
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  When guests actually place their bookings (based on created_at timestamps).
                </p>
              </div>
              <div className="flex w-full flex-col gap-1 sm:w-auto sm:flex-row sm:items-center sm:gap-2">
                <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Day</span>
                <Select value={creationChartDate} onValueChange={(value) => setCreationChartDate(value)}>
                  <SelectTrigger className="w-full sm:w-[200px]">
                    <SelectValue placeholder="All dates" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All dates</SelectItem>
                    {creationDateOptions.map((date) => (
                      <SelectItem key={date} value={date}>
                        {new Date(date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              {hasCreationData ? (
                <div className="grid gap-6 lg:grid-cols-3">
                  <div className="space-y-4">
                    <div className="rounded-lg border bg-muted/40 p-4">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Peak hour</p>
                      <p className="text-2xl font-semibold">
                        {creationInsights?.peak ? creationInsights.peak.label : '--:--'}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {creationInsights?.peak?.count ?? 0} bookings ({creationInsights?.share ?? 0}% of total)
                      </p>
                    </div>
                    <div className="rounded-lg border bg-muted/40 p-4">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Top creation windows</p>
                      <div className="space-y-1.5">
                        {(creationInsights?.topThree ?? []).map((entry) => (
                          <div key={entry.hour} className="flex items-center justify-between text-sm">
                            <span>{entry.label}</span>
                            <span className="font-semibold">{entry.count}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="lg:col-span-2">
                    <ResponsiveContainer width="100%" height={260}>
                      <BarChart data={creationSeries}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="label" tick={{ fontSize: 12 }} interval={2} />
                        <RechartsTooltip
                          labelFormatter={(label) => `Hour ${label}`}
                          formatter={(value) => [`${value} bookings`, 'Created']}
                        />
                        <Bar dataKey="count" fill="#6366f1" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Not enough booking creation activity for the selected filters.
                </p>
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
          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">
                💰 Platform-wide revenue statistics showing estimated revenue from completed covers across all restaurants.
              </p>
            </CardContent>
          </Card>

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
          {/* Analytics-Specific Filters */}
          <Card>
            <CardContent className="p-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-sm font-medium mb-1 block">Restaurant</label>
                  <Select value={filters.restaurantId} onValueChange={(v) => updateFilters({ restaurantId: v })}>
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
                <div>
                  <label className="text-sm font-medium mb-1 block">From Date</label>
                  <Input 
                    type="date" 
                    value={filters.dateRange.from} 
                    onChange={(e) => updateFilters({ dateRange: { ...filters.dateRange, from: e.target.value } })}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">To Date</label>
                  <Input 
                    type="date" 
                    value={filters.dateRange.to} 
                    onChange={(e) => updateFilters({ dateRange: { ...filters.dateRange, to: e.target.value } })}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

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
              <SortableTable
                data={topRestaurants}
                columns={[
                  { key: 'name', label: 'Restaurant', sortable: true, render: (value) => <span className="font-medium">{value}</span> },
                  {
                    key: 'tier',
                    label: 'Tier',
                    sortable: true,
                    render: (value) => (
                      <span className={`px-2 py-1 rounded text-xs ${
                        value === 'pro' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700'
                      }`}>{value}</span>
                    )
                  },
                  { key: 'total_bookings', label: 'Total', sortable: true },
                  { key: 'completed_bookings', label: 'Completed', sortable: true, render: (value) => <span className="text-green-600">{value}</span> },
                  { key: 'completed_covers', label: 'Completed Covers', sortable: true },
                  {
                    key: 'restaurant_revenue_est',
                    label: 'Revenue Est.',
                    sortable: true,
                    render: (value) => <span className="text-purple-600 font-semibold">${value?.toFixed(0) || '0'}</span>
                  },
                  { key: 'bookings_last_7d', label: 'Last 7d', sortable: true, render: (value) => <span className="text-blue-600">{value}</span> }
                ]}
                defaultSort={{ key: 'completed_bookings', direction: 'desc' }}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}


