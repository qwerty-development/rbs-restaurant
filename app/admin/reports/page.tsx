'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { toast } from 'react-hot-toast'
import { Calendar, Download, RefreshCw, TrendingUp, Users, CheckCircle2, XCircle, DollarSign } from 'lucide-react'

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

  useEffect(() => { loadRestaurants() }, [])
  useEffect(() => { loadKPIs() }, [])

  const applyFilters = () => loadKPIs()

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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold">Reports</h2>
        <Button variant="outline" size="sm" onClick={loadKPIs} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} /> Refresh
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

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Bookings</p>
                <p className="text-2xl font-bold"><Users className="inline h-5 w-5 mr-1" /> {kpi.total}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Accepted</p>
                <p className="text-2xl font-bold text-green-600"><CheckCircle2 className="inline h-5 w-5 mr-1" /> {kpi.accepted}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Cancelled/Declined</p>
                <p className="text-2xl font-bold text-red-600"><XCircle className="inline h-5 w-5 mr-1" /> {kpi.cancelled}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Acceptance Rate</p>
                <p className="text-2xl font-bold text-blue-600"><TrendingUp className="inline h-5 w-5 mr-1" /> {acceptanceRate}%</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Accepted Covers</p>
                <p className="text-2xl font-bold">{kpi.acceptedCovers}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Billable (USD)</p>
                <p className="text-2xl font-bold text-emerald-700"><DollarSign className="inline h-5 w-5 mr-1" />{kpi.billableUSD.toFixed(2)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Peak Hours */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Peak Hours</CardTitle>
            <Button variant="outline" size="sm" onClick={exportCSV}>
              <Download className="h-4 w-4 mr-2" /> CSV
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {byHour.length === 0 ? (
            <div className="text-sm text-muted-foreground">No data for selected period.</div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2">
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
          <CardTitle>Export Data</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
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
            <div className="flex sm:justify-end">
              <Button onClick={exportData} disabled={loading} className="w-full sm:w-auto">
                <Download className="h-4 w-4 mr-2" /> Export CSV
              </Button>
            </div>
          </div>
          <div className="text-xs text-muted-foreground">
            Uses the restaurant and date filters above. For bookings, you can also select a specific status.
          </div>
        </CardContent>
      </Card>
    </div>
  )
}


