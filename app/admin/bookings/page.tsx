'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'react-hot-toast'
import { ChevronLeft, ChevronRight, Search, RefreshCw, Calendar, Clock, CheckCircle, XCircle } from 'lucide-react'

type BookingRow = {
  id: string
  restaurant_id: string
  user_id: string | null
  guest_name: string | null
  guest_email: string | null
  booking_time: string
  created_at: string
  status: string
  party_size: number
  profiles?: {
    id: string
    full_name: string | null
    email: string | null
    phone_number: string | null
  } | null
  restaurants?: {
    name: string | null
  } | null
}

function useElapsed(iso?: string) {
  const [now, setNow] = useState<number>(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])
  if (!iso) return ''
  const start = new Date(iso).getTime()
  const diff = Math.max(0, now - start)
  const s = Math.floor(diff / 1000)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const r = s % 60
  if (h > 0) return `${h}h ${m}m ${r}s`
  if (m > 0) return `${m}m ${r}s`
  return `${r}s`
}

export default function AdminAllBookingsPage() {
  const supabase = createClient()

  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [total, setTotal] = useState(0)

  const [userQuery, setUserQuery] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [restaurants, setRestaurants] = useState<{ id: string; name: string }[]>([])
  const [selectedRestaurant, setSelectedRestaurant] = useState<string>('all')
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc')
  const [loading, setLoading] = useState(false)
  const [rows, setRows] = useState<BookingRow[]>([])

  const from = (page - 1) * pageSize
  const to = from + pageSize - 1

  const filtersSummary = useMemo(() => {
    const parts: string[] = []
    if (userQuery) parts.push(`User: ${userQuery}`)
    if (dateFrom) parts.push(`From: ${dateFrom}`)
    if (dateTo) parts.push(`To: ${dateTo}`)
    return parts.join(' • ')
  }, [userQuery, dateFrom, dateTo])

  const fetchBookings = async () => {
    try {
      setLoading(true)

      // Base query
      let query = supabase
        .from('bookings')
        .select(
          `id, restaurant_id, user_id, guest_name, guest_email, booking_time, created_at, status, party_size,
           profiles:profiles!bookings_user_id_fkey(id, full_name, email, phone_number),
           restaurants:restaurants!bookings_restaurant_id_fkey(name)`,
          { count: 'exact' }
        )
      // Restaurant filter
      if (selectedRestaurant && selectedRestaurant !== 'all') {
        query = query.eq('restaurant_id', selectedRestaurant)
      }

      // Date range filter
      if (dateFrom) query = query.gte('booking_time', new Date(dateFrom).toISOString())
      if (dateTo) {
        const end = new Date(dateTo)
        end.setHours(23, 59, 59, 999)
        query = query.lte('booking_time', end.toISOString())
      }

      // User filter: match guest_name, guest_email or profile name/email
      if (userQuery.trim()) {
        const uq = userQuery.trim()
        // Attempt a broad filter: guest fields OR via profiles (requires RPC or search)
        // Use ilike on guest_name and guest_email, plus an or for profiles via text search on a materialized field.
        query = query.or(
          `guest_name.ilike.%${uq}%,guest_email.ilike.%${uq}%`
        )
      }

      // Sorting on created_at; pending will be bubbled to top client-side
      query = query.order('created_at', { ascending: sortOrder === 'asc' })

      // Pagination
      query = query.range(from, to)

      const { data, error, count } = await query
      if (error) throw error

      // Client-side sort to ensure pending appear first
      const rows = ((data as unknown as BookingRow[]) || []).slice().sort((a, b) => {
        const aPending = a.status === 'pending' ? 1 : 0
        const bPending = b.status === 'pending' ? 1 : 0
        if (aPending !== bPending) return bPending - aPending
        // then by created_at based on sortOrder
        const aTime = new Date(a.created_at).getTime()
        const bTime = new Date(b.created_at).getTime()
        return sortOrder === 'asc' ? aTime - bTime : bTime - aTime
      })

      setRows(rows)
      setTotal(count || 0)
    } catch (error) {
      console.error(error)
      toast.error('Failed to fetch bookings')
    } finally {
      setLoading(false)
    }
  }

  const updateStatus = async (bookingId: string, status: 'confirmed' | 'declined_by_restaurant') => {
    try {
      const { error } = await supabase
        .from('bookings')
        .update({ status })
        .eq('id', bookingId)
      if (error) throw error
      toast.success(status === 'confirmed' ? 'Booking accepted' : 'Booking declined')
      // Soft update local rows for quick feedback
      setRows(prev => prev.map(r => r.id === bookingId ? { ...r, status } : r))
      // Refresh to keep counts/pagination correct
      fetchBookings()
    } catch (e) {
      console.error(e)
      toast.error('Failed to update booking')
    }
  }

  useEffect(() => {
    fetchBookings()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, pageSize, sortOrder])

  // Load restaurants for filter once
  useEffect(() => {
    const loadRestaurants = async () => {
      try {
        const { data, error } = await supabase
          .from('restaurants')
          .select('id, name')
          .order('name')
        if (error) throw error
        setRestaurants(data || [])
      } catch (e) {
        console.error(e)
      }
    }
    loadRestaurants()
  }, [supabase])

  const onApplyFilters = () => {
    setPage(1)
    fetchBookings()
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold">All Bookings</h2>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={fetchBookings} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-4 space-y-3">
          {/* Row 1: full-width search */}
          <div className="w-full">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by user name or email"
                value={userQuery}
                onChange={(e) => setUserQuery(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          {/* Row 2: responsive filter controls */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
            <div>
              <Select value={selectedRestaurant} onValueChange={(v) => setSelectedRestaurant(v)}>
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
              <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
            </div>
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
            </div>
            <div>
              <Select value={sortOrder} onValueChange={(v: 'asc' | 'desc') => setSortOrder(v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="desc">Most recent</SelectItem>
                  <SelectItem value="asc">Oldest first</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Select value={String(pageSize)} onValueChange={(v) => setPageSize(parseInt(v))}>
                <SelectTrigger className="w-full lg:w-[110px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">10 / page</SelectItem>
                  <SelectItem value="20">20 / page</SelectItem>
                  <SelectItem value="50">50 / page</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex sm:justify-end">
              <Button onClick={onApplyFilters} disabled={loading} className="w-full sm:w-auto">Apply</Button>
            </div>
          </div>

          {filtersSummary && (
            <div className="text-xs text-muted-foreground">{filtersSummary}</div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Results ({total})</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">Loading...</div>
          ) : rows.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">No bookings found</div>
          ) : (
            <div className="space-y-3">
              {rows.map((row) => (
                <BookingRowItem key={row.id} row={row} onUpdateStatus={updateStatus} />
              ))}
            </div>
          )}

          <div className="flex items-center justify-between mt-6">
            <div className="text-sm text-muted-foreground">
              Page {page} of {totalPages}
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>
                <ChevronLeft className="h-4 w-4 mr-1" /> Prev
              </Button>
              <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages}>
                Next <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function BookingRowItem({ row, onUpdateStatus }: { row: BookingRow; onUpdateStatus: (id: string, status: 'confirmed' | 'declined_by_restaurant') => void }) {
  const elapsed = useElapsed(row.created_at)
  const isPending = row.status === 'pending'
  const customerName = row.guest_name || row.profiles?.full_name || 'Guest'
  const customerEmail = row.guest_email || row.profiles?.email || ''
  const time = new Date(row.booking_time)
  const created = new Date(row.created_at)
  const timeStr = time.toLocaleString()
  const createdStr = created.toLocaleString()
  const restaurantName = row.restaurants?.name || 'Unknown Restaurant'

  return (
    <div className={`border rounded-lg p-3 ${isPending ? 'bg-red-50 border-red-200' : 'bg-white'}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium truncate max-w-[260px]">{customerName}</span>
            <span className="text-xs bg-slate-100 text-slate-700 border border-slate-200 rounded px-2 py-0.5 truncate max-w-[240px]">
              {restaurantName}
            </span>
            {customerEmail && (
              <span className="text-xs text-muted-foreground truncate max-w-[240px]">{customerEmail}</span>
            )}
            {isPending && (
              <span className="inline-flex items-center text-xs text-red-700 bg-red-100 border border-red-200 rounded px-2 py-0.5">
                <Clock className="h-3 w-3 mr-1" /> Waiting: {elapsed}
              </span>
            )}
          </div>
          <div className="text-xs text-muted-foreground">
            <span className={`font-medium ${isPending ? 'text-red-700' : 'text-slate-700'}`}>Status: {row.status.replaceAll('_', ' ')}</span>
            <span className="mx-2">•</span>
            <span>Party: {row.party_size}</span>
          </div>
          <div className="text-xs text-muted-foreground">
            Created: {createdStr} • Booking time: {timeStr}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isPending && (
            <>
              <Button size="sm" onClick={() => onUpdateStatus(row.id, 'confirmed')}>
                <CheckCircle className="h-4 w-4 mr-1" /> Accept
              </Button>
              <Button size="sm" variant="destructive" onClick={() => onUpdateStatus(row.id, 'declined_by_restaurant')}>
                <XCircle className="h-4 w-4 mr-1" /> Decline
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}


