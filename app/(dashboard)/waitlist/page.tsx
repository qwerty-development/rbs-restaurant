// app/(dashboard)/waitlist/page.tsx

'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { 
  Clock, 
  Users, 
  Calendar,
  Phone,
  Mail,
  Filter,
  Search,
  CheckCircle,
  XCircle,
  AlertCircle,
  MoreVertical,
  User
} from 'lucide-react'
import { toast } from 'react-hot-toast'
import { format, parseISO, isToday, isTomorrow, isFuture, isPast } from 'date-fns'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { WaitlistEntryCard } from '@/components/waitlist/waitlist-entry-card'
import { EmptyWaitlist } from '@/components/waitlist/empty-waitlist'
import { WaitlistSetupRequired } from '@/components/waitlist/waitlist-setup-required'
import { ManualBookingForm } from '@/components/bookings/manual-booking-form'
import type { WaitlistEntry } from '@/types'

export default function WaitlistPage() {
  const router = useRouter()
  const supabase = createClient()
  const queryClient = useQueryClient()
  
  // State
  const [waitlistEntries, setWaitlistEntries] = useState<WaitlistEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [restaurantId, setRestaurantId] = useState<string>('')
  const [tableNotFound, setTableNotFound] = useState(false)
  const [showBookingForm, setShowBookingForm] = useState(false)
  const [selectedWaitlistEntry, setSelectedWaitlistEntry] = useState<WaitlistEntry | null>(null)
  
  // Filters
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [dateFilter, setDateFilter] = useState<string>('all')
  const [activeTab, setActiveTab] = useState('all')

  // Create booking mutation
  const createBookingMutation = useMutation({
    mutationFn: async (bookingData: any) => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error("Must be logged in to create bookings")
      
      // Verify user exists in profiles table
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', user.id)
        .single()
      
      if (profileError || !profile) {
        throw new Error("User profile not found. Please ensure your profile is set up correctly.")
      }
      
      // Generate confirmation code
      const confirmationCode = `${restaurantId.slice(0, 4).toUpperCase()}${Math.random().toString(36).substring(2, 8).toUpperCase()}`

      // Create booking
      const { data: booking, error } = await supabase
        .from("bookings")
        .insert({
          restaurant_id: restaurantId,
          user_id: user.id, // Always use the current logged-in user (staff member)
          guest_name: bookingData.guest_name,
          guest_email: bookingData.guest_email,
          guest_phone: bookingData.guest_phone,
          booking_time: bookingData.booking_time,
          party_size: bookingData.party_size,
          turn_time_minutes: bookingData.turn_time_minutes || 120,
          status: bookingData.status || "confirmed",
          special_requests: bookingData.special_requests,
          occasion: bookingData.occasion,
          confirmation_code: confirmationCode,
        })
        .select()
        .single()

      if (error) throw error

      // Assign tables if provided
      if (bookingData.table_ids && bookingData.table_ids.length > 0) {
        const tableAssignments = bookingData.table_ids.map((tableId: string) => ({
          booking_id: booking.id,
          table_id: tableId,
        }))

        const { error: tableError } = await supabase
          .from("booking_tables")
          .insert(tableAssignments)

        if (tableError) {
          // Rollback booking if table assignment fails
          await supabase.from("bookings").delete().eq("id", booking.id)
          throw tableError
        }
      }

      // Update waitlist entry status to 'booked' if this was from waitlist
      if (selectedWaitlistEntry) {
        await supabase
          .from('waitlist')
          .update({ status: 'booked' })
          .eq('id', selectedWaitlistEntry.id)
      }

      return booking
    },
    onSuccess: () => {
      toast.success("Booking created successfully from waitlist")
      setShowBookingForm(false)
      setSelectedWaitlistEntry(null)
      // Refresh waitlist data
      if (restaurantId) {
        loadWaitlistEntries(restaurantId)
      }
    },
    onError: (error: any) => {
      console.error("Create booking error:", error)
      toast.error(error.message || "Failed to create booking")
    },
  })

  // Get restaurant ID using the same pattern as bookings page
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

  // Load waitlist entries when restaurant ID is available
  useEffect(() => {
    if (restaurantId) {
      loadWaitlistEntries(restaurantId)
    }
  }, [restaurantId])

  const loadWaitlistEntries = async (restaurantId: string) => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('waitlist')
        .select(`
          *,
          user:profiles(
            id,
            full_name,
            phone_number,
            avatar_url
          )
        `)
        .eq('restaurant_id', restaurantId)
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Error loading waitlist:', error)
        
        // Check if it's a missing table error
        if (error.message?.includes('relation "public.waitlist" does not exist')) {
          setTableNotFound(true)
          return
        }
        
        // Check if it's a missing enum type error
        if (error.message?.includes('type "waiting_status" does not exist') || 
            error.message?.includes('type "table_type" does not exist')) {
          toast.error('Waitlist database types are not properly set up. Please run the setup script.')
          setTableNotFound(true)
          return
        }
        
        toast.error(`Failed to load waiting list: ${error.message}`)
        return
      }

      setWaitlistEntries(data || [])
    } catch (error) {
      console.error('Error loading waitlist:', error)
      toast.error('Failed to load waiting list')
    } finally {
      setLoading(false)
    }
  }

  const updateWaitlistStatus = async (entryId: string, newStatus: string) => {
    try {
      const { error } = await supabase
        .from('waitlist')
        .update({ status: newStatus })
        .eq('id', entryId)
        .eq('restaurant_id', restaurantId)

      if (error) {
        console.error('Error updating waitlist status:', error)
        toast.error('Failed to update status')
        return
      }

      // Update local state
      setWaitlistEntries(prev => 
        prev.map(entry => 
          entry.id === entryId 
            ? { ...entry, status: newStatus as any }
            : entry
        )
      )

      toast.success('Status updated successfully')
    } catch (error) {
      console.error('Error updating waitlist status:', error)
      toast.error('Failed to update status')
    }
  }

  const handleCreateBooking = (entry: WaitlistEntry) => {
    setSelectedWaitlistEntry(entry)
    setShowBookingForm(true)
  }

  const clearFilters = () => {
    setSearchTerm('')
    setStatusFilter('all')
    setDateFilter('all')
  }

  const hasActiveFilters = !!(searchTerm || statusFilter !== 'all' || dateFilter !== 'all')

  // Filter waitlist entries
  const filteredEntries = waitlistEntries.filter(entry => {
    // Search filter
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase()
      const userName = entry.user?.full_name?.toLowerCase() || ''
      const userPhone = entry.user?.phone_number?.toLowerCase() || ''
      if (!userName.includes(searchLower) && !userPhone.includes(searchLower)) {
        return false
      }
    }

    // Status filter
    if (statusFilter !== 'all' && entry.status !== statusFilter) {
      return false
    }

    // Date filter
    if (dateFilter !== 'all') {
      const entryDate = parseISO(entry.desired_date)
      switch (dateFilter) {
        case 'today':
          if (!isToday(entryDate)) return false
          break
        case 'tomorrow':
          if (!isTomorrow(entryDate)) return false
          break
        case 'future':
          if (!isFuture(entryDate) || isToday(entryDate)) return false
          break
        case 'past':
          if (!isPast(entryDate) || isToday(entryDate)) return false
          break
      }
    }

    // Tab filter
    if (activeTab !== 'all') {
      switch (activeTab) {
        case 'active':
          if (entry.status !== 'active') return false
          break
        case 'notified':
          if (entry.status !== 'notified') return false
          break
        case 'completed':
          if (!['booked', 'expired'].includes(entry.status)) return false
          break
      }
    }

    return true
  })

  // Get stats for tabs
  const stats = {
    all: waitlistEntries.length,
    active: waitlistEntries.filter(e => e.status === 'active').length,
    notified: waitlistEntries.filter(e => e.status === 'notified').length,
    completed: waitlistEntries.filter(e => ['booked', 'expired'].includes(e.status)).length
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <Clock className="h-8 w-8 animate-spin mx-auto mb-4 text-muted-foreground" />
          <p className="text-muted-foreground">Loading waiting list...</p>
        </div>
      </div>
    )
  }

  if (tableNotFound) {
    return <WaitlistSetupRequired />
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Waiting List</h1>
          <p className="text-muted-foreground">
            Manage customer waiting list for your restaurant
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Entries</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.all}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active</CardTitle>
            <AlertCircle className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{stats.active}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Notified</CardTitle>
            <Phone className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{stats.notified}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completed</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.completed}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Filters</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Search</label>
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name or phone..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Status</label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="notified">Notified</SelectItem>
                  <SelectItem value="booked">Booked</SelectItem>
                  <SelectItem value="expired">Expired</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Date</label>
              <Select value={dateFilter} onValueChange={setDateFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All dates" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Dates</SelectItem>
                  <SelectItem value="today">Today</SelectItem>
                  <SelectItem value="tomorrow">Tomorrow</SelectItem>
                  <SelectItem value="future">Future</SelectItem>
                  <SelectItem value="past">Past</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Actions</label>
              <Button 
                variant="outline" 
                onClick={() => loadWaitlistEntries(restaurantId)}
                className="w-full"
              >
                Refresh
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="all">All ({stats.all})</TabsTrigger>
          <TabsTrigger value="active">Active ({stats.active})</TabsTrigger>
          <TabsTrigger value="notified">Notified ({stats.notified})</TabsTrigger>
          <TabsTrigger value="completed">Completed ({stats.completed})</TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="space-y-4">
          {filteredEntries.length === 0 ? (
            <EmptyWaitlist 
              hasFilters={hasActiveFilters}
              onClearFilters={hasActiveFilters ? clearFilters : undefined}
            />
          ) : (
            <div className="space-y-4">
              {filteredEntries.map((entry) => (
                <WaitlistEntryCard
                  key={entry.id}
                  entry={entry}
                  onStatusUpdate={updateWaitlistStatus}
                  onCreateBooking={handleCreateBooking}
                />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Create Booking Modal */}
      <Dialog open={showBookingForm} onOpenChange={setShowBookingForm}>
        <DialogContent className="max-w-4xl w-full h-[95vh] flex flex-col p-0">
          <div className="flex-shrink-0 px-6 py-4 border-b">
            <DialogHeader>
              <DialogTitle>Create Booking from Waitlist</DialogTitle>
              <DialogDescription>
                Create a booking for {selectedWaitlistEntry?.user?.full_name || 'this customer'} from the waitlist
              </DialogDescription>
            </DialogHeader>
          </div>
          <div className="flex-1 overflow-y-auto px-6 py-4">
            {selectedWaitlistEntry && (
              <ManualBookingForm
                restaurantId={restaurantId}
                onSubmit={(data) => createBookingMutation.mutate(data)}
                onCancel={() => {
                  setShowBookingForm(false)
                  setSelectedWaitlistEntry(null)
                }}
                isLoading={createBookingMutation.isPending}
                currentBookings={waitlistEntries.filter(e => e.status === 'booked').map(e => ({
                  id: e.id,
                  booking_time: e.desired_date + 'T' + (e.desired_time_range.includes('-') 
                    ? e.desired_time_range.split('-')[0].trim()
                    : e.desired_time_range) + ':00',
                  turn_time_minutes: 120,
                  status: 'confirmed',
                  tables: []
                }))}
                prefillData={{
                  guest_name: selectedWaitlistEntry.user?.full_name || '',
                  guest_phone: selectedWaitlistEntry.user?.phone_number || '',
                  party_size: selectedWaitlistEntry.party_size,
                  booking_date: new Date(selectedWaitlistEntry.desired_date),
                  booking_time: selectedWaitlistEntry.desired_time_range.includes('-') 
                    ? selectedWaitlistEntry.desired_time_range.split('-')[0].trim()
                    : selectedWaitlistEntry.desired_time_range,
                  user: selectedWaitlistEntry.user
                }}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
