'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { toast } from 'react-hot-toast'
import { ChevronLeft, ChevronRight, Search, RefreshCw, Calendar, Clock, CheckCircle, XCircle, Phone, Users, Mail, MapPin, Tag } from 'lucide-react'

type BookingRow = {
  id: string
  restaurant_id: string
  user_id: string | null
  guest_name: string | null
  guest_email: string | null
  guest_phone: string | null
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
  // Allow any additional fields without strict typing for full payload view
  [key: string]: any
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
  const [sortField, setSortField] = useState<'created_at' | 'booking_time' | 'elapsed'>('created_at')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [partyMin, setPartyMin] = useState<string>('')
  const [partyMax, setPartyMax] = useState<string>('')
  const [bookingType, setBookingType] = useState<'all' | 'registered' | 'guest'>('all')
  const [hasTable, setHasTable] = useState<'all' | 'yes' | 'no'>('all')
  const [loading, setLoading] = useState(false)
  const [rows, setRows] = useState<BookingRow[]>([])
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  
  // Confirmation dialog states
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean
    type: 'accept' | 'decline' | null
    bookingId: string | null
    customerName: string | null
  }>({
    open: false,
    type: null,
    bookingId: null,
    customerName: null
  })

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
          `
           *,
           profiles:profiles!bookings_user_id_fkey(
             id,
             full_name,
             email,
             phone_number,
             avatar_url,
             dietary_restrictions,
             allergies
           ),
           restaurants:restaurants!bookings_restaurant_id_fkey(
             id,
             name,
             address
           ),
           booking_tables(
             id,
             table:restaurant_tables(*)
           ),
           booking_status_history(
             new_status,
             old_status,
             changed_at,
             changed_by,
             metadata
           ),
           special_offers: special_offers!bookings_applied_offer_id_fkey(*)
          `,
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

      // Status filter
      if (statusFilter && statusFilter !== 'all') {
        if (statusFilter === 'dining') {
          query = query.in('status', ['arrived', 'seated', 'ordered', 'appetizers', 'main_course', 'dessert', 'payment'])
        } else if (statusFilter === 'cancelled') {
          // Combined cancelled filter
          query = query.in('status', ['cancelled_by_user', 'declined_by_restaurant'])
        } else if (statusFilter === 'cancelled_by_user') {
          query = query.eq('status', 'cancelled_by_user')
        } else if (statusFilter === 'cancelled_by_restaurant') {
          // Map UI label to DB status value
          query = query.eq('status', 'declined_by_restaurant')
        } else {
          query = query.eq('status', statusFilter)
        }
      }

      // Party size filters
      const partyMinNum = partyMin ? parseInt(partyMin, 10) : undefined
      const partyMaxNum = partyMax ? parseInt(partyMax, 10) : undefined
      if (!Number.isNaN(partyMinNum) && typeof partyMinNum === 'number') {
        query = query.gte('party_size', partyMinNum as number)
      }
      if (!Number.isNaN(partyMaxNum) && typeof partyMaxNum === 'number') {
        query = query.lte('party_size', partyMaxNum as number)
      }

      // Booking type filter
      if (bookingType === 'registered') {
        query = query.not('user_id', 'is', null)
      } else if (bookingType === 'guest') {
        query = query.is('user_id', null)
      }

      // User filter: match guest_name, guest_email, phone, ID or profile name/email
      if (userQuery.trim()) {
        const uq = userQuery.trim()
        // Lookup matching profiles to include user_id.in
        const profileIds: string[] = []
        try {
          const { data: matchedProfiles } = await supabase
            .from('profiles')
            .select('id')
            .or(`full_name.ilike.%${uq}%,email.ilike.%${uq}%,phone_number.ilike.%${uq}%`)
            .limit(1000)
          matchedProfiles?.forEach((p: any) => p?.id && profileIds.push(p.id))
        } catch (_) {}

        const orSegments = [
          `guest_name.ilike.%${uq}%`,
          `guest_email.ilike.%${uq}%`,
          `guest_phone.ilike.%${uq}%`
        ]
        
        // Only add UUID search if the search term looks like a UUID
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
        if (uuidRegex.test(uq)) {
          orSegments.push(`id.eq.${uq}`)
        }
        if (profileIds.length > 0) {
          const inList = profileIds.map(id => `${id}`).join(',')
          orSegments.push(`user_id.in.(${inList})`)
        }
        query = query.or(orSegments.join(','))
      }

      // Server-side sort for created_at or booking_time; elapsed handled client-side
      if (sortField === 'created_at' || sortField === 'booking_time') {
        query = query.order(sortField, { ascending: sortOrder === 'asc' })
      } else {
        query = query.order('created_at', { ascending: sortOrder === 'asc' })
      }

      // Pagination
      query = query.range(from, to)

      const { data, error, count } = await query
      if (error) throw error

      // Client-side: hasTable filter and elapsed sorting
      let processed = ((data as unknown as BookingRow[]) || []).slice()

      if (hasTable !== 'all') {
        processed = processed.filter((r: any) => {
          const count = r?.booking_tables?.length || 0
          return hasTable === 'yes' ? count > 0 : count === 0
        })
      }

      if (sortField === 'elapsed') {
        processed.sort((a, b) => {
          const aElapsed = Math.max(0, Date.now() - new Date(a.created_at).getTime())
          const bElapsed = Math.max(0, Date.now() - new Date(b.created_at).getTime())
          return sortOrder === 'asc' ? aElapsed - bElapsed : bElapsed - aElapsed
        })
      }

      setRows(processed)
      setTotal(count || 0)
    } catch (error) {
      console.error(error)
      toast.error('Failed to fetch bookings')
    } finally {
      setLoading(false)
    }
  }

  // Show confirmation dialog
  const showConfirmDialog = (type: 'accept' | 'decline', bookingId: string, customerName: string) => {
    setConfirmDialog({
      open: true,
      type,
      bookingId,
      customerName
    })
  }

  // Handle confirmed action
  const handleConfirmedAction = async () => {
    if (!confirmDialog.bookingId || !confirmDialog.type) return

    try {
      const status = confirmDialog.type === 'accept' ? 'confirmed' : 'declined_by_restaurant'
      const { error } = await supabase
        .from('bookings')
        .update({ status })
        .eq('id', confirmDialog.bookingId)
      if (error) throw error
      
      toast.success(status === 'confirmed' ? 'Booking accepted' : 'Booking declined')
      // Soft update local rows for quick feedback
      setRows(prev => prev.map(r => r.id === confirmDialog.bookingId ? { ...r, status } : r))
      // Refresh to keep counts/pagination correct
      fetchBookings()
    } catch (e) {
      console.error(e)
      toast.error('Failed to update booking')
    } finally {
      // Close dialog
      setConfirmDialog({
        open: false,
        type: null,
        bookingId: null,
        customerName: null
      })
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
  }, [page, pageSize, sortOrder, sortField, statusFilter, partyMin, partyMax, bookingType, hasTable])

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
                placeholder="Search by name, email, phone, ID"
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
              <Select value={sortField} onValueChange={(v: 'created_at' | 'booking_time' | 'elapsed') => setSortField(v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Sort field" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="created_at">Created time</SelectItem>
                  <SelectItem value="booking_time">Booking time</SelectItem>
                  <SelectItem value="elapsed">Time elapsed</SelectItem>
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

          {/* Row 3: more filters */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
            <div>
              <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v)}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="confirmed">Confirmed</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="cancelled">Cancelled (all)</SelectItem>
                  <SelectItem value="cancelled_by_user">Cancelled by user</SelectItem>
                  <SelectItem value="cancelled_by_restaurant">Cancelled by restaurant</SelectItem>
                  <SelectItem value="no_show">No show</SelectItem>
                  <SelectItem value="dining">Dining</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Input type="number" inputMode="numeric" placeholder="Min party" value={partyMin} onChange={(e) => setPartyMin(e.target.value)} />
              <Input type="number" inputMode="numeric" placeholder="Max party" value={partyMax} onChange={(e) => setPartyMax(e.target.value)} />
            </div>
            <div>
              <Select value={bookingType} onValueChange={(v: 'all' | 'registered' | 'guest') => setBookingType(v)}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Booking type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All types</SelectItem>
                  <SelectItem value="registered">Registered users</SelectItem>
                  <SelectItem value="guest">Guests</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Select value={hasTable} onValueChange={(v: 'all' | 'yes' | 'no') => setHasTable(v)}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Has table?" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Any table status</SelectItem>
                  <SelectItem value="yes">With table</SelectItem>
                  <SelectItem value="no">Without table</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Select value={sortOrder} onValueChange={(v: 'asc' | 'desc') => setSortOrder(v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Sort order" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="desc">High to low</SelectItem>
                  <SelectItem value="asc">Low to high</SelectItem>
                </SelectContent>
              </Select>
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
                <BookingRowItem key={row.id} row={row} onUpdateStatus={updateStatus} onShowConfirmDialog={showConfirmDialog} expanded={expandedIds.has(row.id)} onToggleExpand={() => setExpandedIds(prev => {
                  const next = new Set(prev)
                  if (next.has(row.id)) next.delete(row.id); else next.add(row.id)
                  return next
                })} />
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

      {/* Confirmation Dialog */}
      <ConfirmDialog
        open={confirmDialog.open}
        onOpenChange={(open) => setConfirmDialog(prev => ({ ...prev, open }))}
        title={confirmDialog.type === 'accept' ? 'Accept Booking' : 'Decline Booking'}
        description={
          confirmDialog.type === 'accept' 
            ? `Are you sure you want to accept the booking for ${confirmDialog.customerName}?`
            : `Are you sure you want to decline the booking for ${confirmDialog.customerName}?`
        }
        confirmText={confirmDialog.type === 'accept' ? 'Accept' : 'Decline'}
        cancelText="Cancel"
        onConfirm={handleConfirmedAction}
      />
    </div>
  )
}

function BookingRowItem({ row, onUpdateStatus, onShowConfirmDialog, expanded, onToggleExpand }: { 
  row: BookingRow; 
  onUpdateStatus: (id: string, status: 'confirmed' | 'declined_by_restaurant') => void; 
  onShowConfirmDialog: (type: 'accept' | 'decline', bookingId: string, customerName: string) => void;
  expanded: boolean; 
  onToggleExpand: () => void 
}) {
  const elapsed = useElapsed(row.created_at)
  const isPending = row.status === 'pending'
  const customerName = row.guest_name || row.profiles?.full_name || 'Guest'
  const customerEmail = row.guest_email || row.profiles?.email || ''
  const customerPhone = row.profiles?.phone_number || row.guest_phone || ''
  const time = new Date(row.booking_time)
  const created = new Date(row.created_at)
  const timeStr = time.toLocaleString('en-US', { 
    weekday: 'short', 
    year: 'numeric', 
    month: 'short', 
    day: 'numeric', 
    hour: '2-digit', 
    minute: '2-digit' 
  })
  const createdStr = created.toLocaleString('en-US', { 
    month: 'short', 
    day: 'numeric', 
    hour: '2-digit', 
    minute: '2-digit' 
  })
  const restaurantName = row.restaurants?.name || 'Unknown Restaurant'

  // Status badge variant
  const getStatusVariant = (status: string) => {
    switch (status) {
      case 'pending': return 'destructive'
      case 'confirmed': return 'default'
      case 'completed': return 'secondary'
      case 'cancelled': return 'outline'
      case 'declined_by_restaurant': return 'outline'
      default: return 'secondary'
    }
  }

  return (
    <div className={`border rounded-lg p-3 md:p-4 transition-all ${isPending ? 'bg-red-50 border-red-300 shadow-md' : 'bg-white hover:shadow-sm'}`}>
      <div className="flex flex-col gap-3">
        {/* Header: Name & Status */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <h3 className="text-lg md:text-xl font-bold text-slate-900 truncate">{customerName}</h3>
            <div className="text-xs md:text-sm text-slate-600 mt-0.5">
              📍 {restaurantName}
            </div>
          </div>
          <Badge variant={getStatusVariant(row.status)} className="text-xs flex-shrink-0">
            {row.status.replaceAll('_', ' ').toUpperCase()}
          </Badge>
        </div>

        {/* Pending Timer */}
        {isPending && (
          <div className="inline-flex items-center text-xs md:text-sm font-semibold text-red-700 bg-red-100 border border-red-300 rounded px-2 py-1 animate-pulse w-fit">
            <Clock className="h-3 w-3 md:h-4 md:w-4 mr-1.5" /> Waiting: {elapsed}
          </div>
        )}

        {/* Key Details Grid */}
        <div className="grid grid-cols-2 gap-2 md:gap-3">
          {/* Booking Time */}
          <div className="flex items-start gap-1.5 md:gap-2">
            <Calendar className="h-4 w-4 md:h-5 md:w-5 text-blue-600 mt-0.5 flex-shrink-0" />
            <div className="min-w-0">
              <div className="text-[10px] md:text-xs text-muted-foreground font-medium uppercase">Time</div>
              <div className="text-xs md:text-sm font-bold text-slate-900 break-words">{timeStr}</div>
            </div>
          </div>

          {/* Party Size */}
          <div className="flex items-start gap-1.5 md:gap-2">
            <Users className="h-4 w-4 md:h-5 md:w-5 text-purple-600 mt-0.5 flex-shrink-0" />
            <div className="min-w-0">
              <div className="text-[10px] md:text-xs text-muted-foreground font-medium uppercase">Party</div>
              <div className="text-xs md:text-sm font-bold text-slate-900">{row.party_size} {row.party_size === 1 ? 'person' : 'people'}</div>
            </div>
          </div>

          {/* Phone Number */}
          {customerPhone && (
            <div className="flex items-start gap-1.5 md:gap-2 col-span-2">
              <Phone className="h-4 w-4 md:h-5 md:w-5 text-green-600 mt-0.5 flex-shrink-0" />
              <div className="min-w-0">
                <div className="text-[10px] md:text-xs text-muted-foreground font-medium uppercase">Phone</div>
                <a href={`tel:${customerPhone}`} className="text-sm md:text-base font-bold text-blue-600 hover:text-blue-800 hover:underline break-all">
                  {customerPhone}
                </a>
              </div>
            </div>
          )}

          {/* Email */}
          {customerEmail && (
            <div className="flex items-start gap-1.5 md:gap-2 col-span-2">
              <Mail className="h-4 w-4 md:h-5 md:w-5 text-slate-500 mt-0.5 flex-shrink-0" />
              <div className="min-w-0">
                <div className="text-[10px] md:text-xs text-muted-foreground font-medium uppercase">Email</div>
                <a href={`mailto:${customerEmail}`} className="text-xs md:text-sm text-blue-600 hover:text-blue-800 hover:underline break-all">
                  {customerEmail}
                </a>
              </div>
            </div>
          )}
        </div>

        {/* Action Buttons - Only show for pending */}
        {isPending && (
          <div className="flex gap-2 pt-2 border-t">
            <Button size="sm" onClick={() => onShowConfirmDialog('accept', row.id, customerName)} className="flex-1">
              <CheckCircle className="h-4 w-4 mr-1.5" /> Accept
            </Button>
            <Button size="sm" variant="destructive" onClick={() => onShowConfirmDialog('decline', row.id, customerName)} className="flex-1">
              <XCircle className="h-4 w-4 mr-1.5" /> Decline
            </Button>
          </div>
        )}

        {/* Metadata */}
        <div className="text-[10px] md:text-xs text-muted-foreground pt-2 border-t">
          Created: {createdStr} • ID: {row.id.slice(0, 8)}
        </div>

        {/* Expand structured details */}
        <div className="pt-2">
          <Button variant="outline" size="sm" onClick={onToggleExpand}>{expanded ? 'Hide details' : 'Show details'}</Button>
        </div>
        {expanded && (
          <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* Customer */}
            <div className="border rounded p-3">
              <div className="text-xs font-semibold text-slate-600 mb-2">Customer</div>
              <div className="space-y-1 text-sm">
                <div className="flex items-center gap-2"><Users className="h-4 w-4 text-purple-600" /> <span>{customerName}</span></div>
                {customerEmail && <div className="flex items-center gap-2"><Mail className="h-4 w-4 text-slate-500" /> <a className="text-blue-600 hover:underline" href={`mailto:${customerEmail}`}>{customerEmail}</a></div>}
                {customerPhone && <div className="flex items-center gap-2"><Phone className="h-4 w-4 text-green-600" /> <a className="text-blue-600 hover:underline" href={`tel:${customerPhone}`}>{customerPhone}</a></div>}
                {/* Dietary restrictions & allergies */}
                {Array.isArray(row.profiles?.dietary_restrictions) && row.profiles?.dietary_restrictions?.length > 0 && (
                  <div className="pt-1">
                    <div className="text-[10px] uppercase text-slate-500">Dietary Restrictions</div>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {row.profiles?.dietary_restrictions.map((d: string, i: number) => (
                        <span key={i} className="text-[10px] px-2 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200">{d}</span>
                      ))}
                    </div>
                  </div>
                )}
                {Array.isArray(row.profiles?.allergies) && row.profiles?.allergies?.length > 0 && (
                  <div className="pt-1">
                    <div className="text-[10px] uppercase text-slate-500">Allergies</div>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {row.profiles?.allergies.map((a: string, i: number) => (
                        <span key={i} className="text-[10px] px-2 py-0.5 rounded bg-red-50 text-red-800 border border-red-200">{a}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Booking */}
            <div className="border rounded p-3">
              <div className="text-xs font-semibold text-slate-600 mb-2">Booking</div>
              <div className="space-y-1 text-sm">
                <div className="flex items-center gap-2"><Calendar className="h-4 w-4 text-blue-600" /> <span>{timeStr}</span></div>
                <div className="flex items-center gap-2"><Clock className="h-4 w-4 text-slate-600" /> <span>Created {createdStr}</span></div>
                <div className="flex items-center gap-2"><Users className="h-4 w-4 text-purple-600" /> <span>Party {row.party_size}</span></div>
                <div className="flex items-center gap-2"><Tag className="h-4 w-4 text-slate-600" /> <span>Status {row.status.replaceAll('_',' ')}</span></div>
                {row.special_offers && <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1 inline-block">Offer applied</div>}
                {/* Special requests */}
                {row.special_requests && (
                  <div className="pt-2 text-sm">
                    <div className="text-[10px] uppercase text-slate-500">Special Requests</div>
                    <div className="mt-1 italic text-slate-800">"{row.special_requests}"</div>
                  </div>
                )}
              </div>
            </div>

            {/* Restaurant */}
            <div className="border rounded p-3">
              <div className="text-xs font-semibold text-slate-600 mb-2">Restaurant</div>
              <div className="space-y-1 text-sm">
                <div className="flex items-center gap-2"><MapPin className="h-4 w-4 text-red-600" /> <span>{restaurantName}</span></div>
                {row.restaurants?.address && (
                  <div className="text-xs text-slate-600">{row.restaurants.address}</div>
                )}
              </div>
            </div>

            {/* Tables */}
            <div className="border rounded p-3">
              <div className="text-xs font-semibold text-slate-600 mb-2">Tables</div>
              {Array.isArray((row as any).booking_tables) && (row as any).booking_tables.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {(row as any).booking_tables.map((bt: any) => (
                    <div key={bt.id} className="text-xs px-2 py-1 rounded bg-slate-100 border">
                      Table {(bt.table?.table_number) ?? '—'}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-xs text-slate-500">No table assigned</div>
              )}
            </div>

            {/* Status history */}
            <div className="border rounded p-3 md:col-span-2">
              <div className="text-xs font-semibold text-slate-600 mb-2">Status History</div>
              {Array.isArray((row as any).booking_status_history) && (row as any).booking_status_history.length > 0 ? (
                <div className="space-y-2">
                  {(row as any).booking_status_history
                    .slice()
                    .sort((a: any, b: any) => new Date(a.changed_at).getTime() - new Date(b.changed_at).getTime())
                    .map((h: any, idx: number) => (
                      <div key={idx} className="flex items-center justify-between text-xs">
                        <div className="text-slate-700">
                          {h.old_status?.replaceAll('_',' ') || '—'} → {h.new_status?.replaceAll('_',' ')}
                        </div>
                        <div className="text-slate-500">{new Date(h.changed_at).toLocaleString()}</div>
                      </div>
                    ))}
                </div>
              ) : (
                <div className="text-xs text-slate-500">No history</div>
              )}
            </div>

            {/* Raw payload (collapsible secondary) */}
            <div className="border rounded p-3 md:col-span-2">
              <div className="text-xs font-semibold text-slate-600 mb-2">Raw Payload</div>
              <pre className="p-3 bg-slate-50 rounded border overflow-auto text-xs max-h-64">
{JSON.stringify(row, null, 2)}
              </pre>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}


