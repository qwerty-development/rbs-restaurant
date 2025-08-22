'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { 
  Clock, 
  Users, 
  Calendar,
  Phone,
  Mail,
  Search,
  CheckCircle,
  XCircle,
  AlertCircle,
  RefreshCw,
  Plus,
  X,
  Star,
  UserCheck,
  CalendarIcon
} from 'lucide-react'
import { toast } from 'react-hot-toast'
import { format, parseISO, isToday, isTomorrow } from 'date-fns'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Calendar as CalendarComponent } from '@/components/ui/calendar'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import { TableAvailabilityService } from '@/lib/table-availability'
import { RestaurantAvailability } from '@/lib/restaurant-availability'
import { customerUtils } from '@/lib/customer-utils'

// Types
interface WaitlistEntry {
  id: string
  user_id: string | null
  restaurant_id: string
  desired_date: string
  desired_time_range: string
  party_size: number
  table_type: string
  status: 'active' | 'notified' | 'booked' | 'expired' | 'cancelled'
  guest_name?: string
  guest_email?: string
  guest_phone?: string
  special_requests?: string
  notified_at?: string
  notification_expires_at?: string
  expires_at?: string
  created_at: string
  user?: {
    id: string
    full_name: string
    phone_number?: string
    avatar_url?: string
  }
}

export default function WaitlistPage() {
  const router = useRouter()
  const supabase = createClient()
  
  // State
  const [waitlistEntries, setWaitlistEntries] = useState<WaitlistEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [restaurantId, setRestaurantId] = useState<string>('')
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [activeTab, setActiveTab] = useState('active')
  const [showAddDialog, setShowAddDialog] = useState(false)
  
  // Form state for manual entry
  const [manualEntry, setManualEntry] = useState({
    guest_name: '',
    guest_phone: '',
    guest_email: '',
    desired_date: new Date(),
    desired_time_start: '19:00',
    desired_time_end: '21:00',
    party_size: 2,
    table_type: 'any',
    special_requests: ''
  })

  // Customer search state
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null)
  const [customerSearch, setCustomerSearch] = useState("")
  const [debouncedCustomerSearch, setDebouncedCustomerSearch] = useState("")
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false)

  // Convert to booking state
  const [showConvertDialog, setShowConvertDialog] = useState(false)
  const [convertingEntry, setConvertingEntry] = useState<WaitlistEntry | null>(null)
  const [isConverting, setIsConverting] = useState(false)
  
  // Conversion form state
  const [selectedTime, setSelectedTime] = useState('')
  const [selectedTables, setSelectedTables] = useState<string[]>([])
  const [checkingAvailability, setCheckingAvailability] = useState(false)

  // Services
  const tableService = new TableAvailabilityService()
  const availabilityService = new RestaurantAvailability()

  // Get restaurant ID
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
  }, [])

  // Load waitlist entries
  const loadWaitlistEntries = useCallback(async (silent = false) => {
    if (!restaurantId) return
    
    try {
      if (!silent) {
      setLoading(true)
      }
      
      // First, expire stale notified entries locally to avoid RPC issues for guests without user_id
      try {
        const nowIso = new Date().toISOString()
        const { data: staleNotified } = await supabase
          .from('waitlist')
          .select('id')
          .eq('restaurant_id', restaurantId)
          .eq('status', 'notified')
          .lt('notification_expires_at', nowIso)

        if ((staleNotified?.length || 0) > 0) {
          await supabase
            .from('waitlist')
            .update({ status: 'expired' })
            .in('id', staleNotified!.map((e: any) => e.id))
        }
      } catch (e) {
        // Non-fatal; continue to fetch list
        console.warn('Local waitlist expiry skipped:', e)
      }
      
      // Then fetch current entries
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
        if (!silent) {
        toast.error('Failed to load waitlist')
        }
        return
      }

      setWaitlistEntries(data || [])
    } catch (error) {
      console.error('Error:', error)
      if (!silent) {
      toast.error('Failed to load waitlist')
      }
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [restaurantId])

  // Load entries when restaurant ID is available
  useEffect(() => {
    if (restaurantId) {
      loadWaitlistEntries()
    }
  }, [restaurantId, loadWaitlistEntries])

  // Auto-refresh every 30 seconds (silent refresh)
  useEffect(() => {
    const interval = setInterval(() => {
      if (restaurantId && !refreshing) {
        loadWaitlistEntries(true) // Silent refresh - no loading state
      }
    }, 30000)
    
    return () => clearInterval(interval)
  }, [restaurantId, refreshing, loadWaitlistEntries])

  // Debounce customer search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedCustomerSearch(customerSearch)
    }, 300) // 300ms delay

    return () => clearTimeout(timer)
  }, [customerSearch])

  // Fetch customers for search
  const { data: customers, error: customersError, isLoading: customersLoading } = useQuery({
    queryKey: ["restaurant-customers", restaurantId, debouncedCustomerSearch],
    queryFn: async () => {
      if (!debouncedCustomerSearch.trim() || debouncedCustomerSearch.length < 2) return []
      
      console.log("Searching for customers with:", debouncedCustomerSearch)
      
      const { data, error } = await supabase
        .from("restaurant_customers")
        .select(`
          *,
          profile:profiles!restaurant_customers_user_id_fkey(
            id,
            full_name,
            phone_number,
            avatar_url
          )
        `)
        .eq("restaurant_id", restaurantId)
        .or(`guest_name.ilike.%${debouncedCustomerSearch}%,guest_email.ilike.%${debouncedCustomerSearch}%,guest_phone.ilike.%${debouncedCustomerSearch}%`)
        .limit(10)
        .order("last_visit", { ascending: false })

      if (error) {
        console.error("Customer search error:", error)
        throw error
      }
      
      console.log("Customer search results:", data)
      return data || []
    },
    enabled: debouncedCustomerSearch.length >= 2 && !!restaurantId,
  })

  // Fetch current bookings for conflict checking in conversion
  const { data: currentBookings } = useQuery({
    queryKey: ["current-bookings", restaurantId],
    queryFn: async () => {
      if (!restaurantId) return []
      
      const { data, error } = await supabase
        .from("bookings")
        .select(`
          *,
          tables:booking_tables(
            table:restaurant_tables(*)
          ),
          user:profiles(*)
        `)
        .eq("restaurant_id", restaurantId)
        .in("status", ["confirmed", "arrived", "seated", "ordered", "appetizers", "main_course", "dessert", "payment"])
        .order("booking_time")

      if (error) throw error
      return data || []
    },
    enabled: !!restaurantId,
  })

  // Fetch all tables for conversion
  const { data: allTables } = useQuery({
    queryKey: ["restaurant-tables", restaurantId],
    queryFn: async () => {
      if (!restaurantId) return []
      
      const { data, error } = await supabase
        .from("restaurant_tables")
        .select("*")
        .eq("restaurant_id", restaurantId)
        .eq("is_active", true)
        .order("table_number")

      if (error) throw error
      return data || []
    },
    enabled: !!restaurantId,
  })

  // Auto-suggest tables for conversion
  const suggestTablesForConversion = async () => {
    if (!convertingEntry || !selectedTime) {
      toast.error('Please select a time first')
      return
    }

    setCheckingAvailability(true)
    try {
      const bookingDate = new Date(convertingEntry.desired_date)
      const [hours, minutes] = selectedTime.split(':')
      bookingDate.setHours(parseInt(hours), parseInt(minutes))

      const optimal = await tableService.getOptimalTableAssignment(
        restaurantId,
        bookingDate,
        convertingEntry.party_size,
        120 // 2 hour turn time
      )

      if (optimal) {
        setSelectedTables(optimal.tableIds)
        toast.success(
          optimal.requiresCombination
            ? `Found ${optimal.tableIds.length} tables that can be combined`
            : "Found optimal table"
        )
      } else {
        toast.error("No available tables for this time slot")
      }
    } catch (error) {
      console.error("Error suggesting tables:", error)
      toast.error("Failed to find available tables")
    } finally {
      setCheckingAvailability(false)
    }
  }

  // Check if table is available for conversion
  const isTableAvailableForConversion = (tableId: string) => {
    if (!convertingEntry || !selectedTime) return true

    const bookingDate = new Date(convertingEntry.desired_date)
    const [hours, minutes] = selectedTime.split(':')
    bookingDate.setHours(parseInt(hours), parseInt(minutes))
    const bookingEndTime = new Date(bookingDate.getTime() + 120 * 60000) // 2 hours

    return !currentBookings?.some(booking => {
      const hasTable = booking.tables?.some((t: any) => t.table.id === tableId)
      if (!hasTable) return false

      const existingStart = new Date(booking.booking_time)
      const existingEnd = new Date(existingStart.getTime() + (booking.turn_time_minutes || 120) * 60000)

      const conflictingStatuses = [
        'confirmed', 'arrived', 'seated', 'ordered', 'appetizers',
        'main_course', 'dessert', 'payment'
      ]

      if (!conflictingStatuses.includes(booking.status)) return false

      return bookingDate < existingEnd && bookingEndTime > existingStart
    })
  }

  // Update waitlist status
  const updateStatus = async (entryId: string, newStatus: string) => {
    try {
      const updateData: any = { status: newStatus }
      
      // Add notification expiration if marking as notified
      if (newStatus === 'notified') {
        updateData.notified_at = new Date().toISOString()
        updateData.notification_expires_at = new Date(Date.now() + 15 * 60 * 1000).toISOString()
      }

      const { error } = await supabase
        .from('waitlist')
        .update(updateData)
        .eq('id', entryId)

      if (error) throw error

      toast.success(`Status updated to ${newStatus}`)
      loadWaitlistEntries()
    } catch (error) {
      console.error('Error updating status:', error)
      toast.error('Failed to update status')
    }
  }

  // Open convert to booking dialog
  const convertToBooking = async (entryId: string) => {
    const entry = waitlistEntries.find(e => e.id === entryId)
    if (!entry) {
      toast.error('Waitlist entry not found')
      return
    }
    setConvertingEntry(entry)
    setSelectedTime('')
    setSelectedTables([])
    setShowConvertDialog(true)
  }

  // Generate available time slots within waitlist range
  const getAvailableTimeSlots = () => {
    if (!convertingEntry) return []

    const [startTime, endTime] = convertingEntry.desired_time_range.split('-')
    const slots = []
    
    // Parse start and end times
    const [startHour, startMin] = startTime.trim().split(':').map(Number)
    const [endHour, endMin] = endTime.trim().split(':').map(Number)
    
    // Generate 30-minute slots
    let currentHour = startHour
    let currentMin = startMin
    
    while (currentHour < endHour || (currentHour === endHour && currentMin < endMin)) {
      const timeString = `${currentHour.toString().padStart(2, '0')}:${currentMin.toString().padStart(2, '0')}`
      slots.push(timeString)
      
      currentMin += 30
      if (currentMin >= 60) {
        currentMin = 0
        currentHour++
      }
    }
    
    return slots
  }

  // Handle simple booking conversion
  const handleSimpleConversion = async () => {
    if (!convertingEntry || !selectedTime || selectedTables.length === 0) {
      toast.error('Please select a time and at least one table')
      return
    }

    try {
      setIsConverting(true)
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) {
        toast.error('You must be logged in')
        return
      }

      // Avoid duplicate restaurant_customers rows: if a matching customer exists, link it; don't create new
      let linkedCustomerId: string | null = null
      try {
        if (convertingEntry.user_id) {
          const { data: existingByUser } = await supabase
            .from('restaurant_customers')
            .select('id')
            .eq('restaurant_id', restaurantId)
            .eq('user_id', convertingEntry.user_id)
            .limit(1)
            .single()
          if (existingByUser?.id) linkedCustomerId = existingByUser.id
        } else if (convertingEntry.guest_email || convertingEntry.guest_phone || convertingEntry.user?.phone_number) {
          let query = supabase
            .from('restaurant_customers')
            .select('id')
            .eq('restaurant_id', restaurantId)
            .limit(1)

          if (convertingEntry.guest_email && (convertingEntry.guest_phone || convertingEntry.user?.phone_number)) {
            query = query
              .eq('guest_email', convertingEntry.guest_email)
              .eq('guest_phone', convertingEntry.guest_phone || convertingEntry.user?.phone_number || '')
          } else if (convertingEntry.guest_email) {
            query = query.eq('guest_email', convertingEntry.guest_email)
          } else if (convertingEntry.guest_phone || convertingEntry.user?.phone_number) {
            query = query.eq('guest_phone', convertingEntry.guest_phone || convertingEntry.user?.phone_number || '')
          }

          const { data: existingByContact } = await query.single()
          if (existingByContact?.id) linkedCustomerId = existingByContact.id
        }
      } catch (e) {
        // best-effort only
      }

      // Create booking datetime
      const bookingDate = new Date(convertingEntry.desired_date)
      const [hours, minutes] = selectedTime.split(':')
      bookingDate.setHours(parseInt(hours), parseInt(minutes))

      // Generate confirmation code
      const confirmationCode = `${restaurantId.slice(0, 4).toUpperCase()}${Math.random().toString(36).substring(2, 8).toUpperCase()}`

      // Create the booking (never create customer here; only link if found)
      const { data: booking, error: bookingError } = await supabase
        .from("bookings")
        .insert({
          restaurant_id: restaurantId,
          user_id: convertingEntry.user_id || user.id, // Use staff user ID if no customer user ID
      
          guest_name: convertingEntry.user?.full_name || convertingEntry.guest_name,
          // If we linked a customer, avoid passing guest contact to prevent duplicate customer upsert by DB triggers
          guest_email: linkedCustomerId ? null : convertingEntry.guest_email,
          guest_phone: linkedCustomerId ? null : (convertingEntry.user?.phone_number || convertingEntry.guest_phone),
          booking_time: bookingDate.toISOString(),
          party_size: convertingEntry.party_size,
          turn_time_minutes: 120,
          status: 'confirmed',
          special_requests: convertingEntry.special_requests,
          confirmation_code: confirmationCode,
        })
        .select()
        .single()

      if (bookingError) throw bookingError

      // Assign tables to the booking
      const tableAssignments = selectedTables.map((tableId: string) => ({
        booking_id: booking.id,
        table_id: tableId,
      }))

      const { error: tableError } = await supabase
        .from("booking_tables")
        .insert(tableAssignments)

      if (tableError) throw tableError

      // Update waitlist status to 'booked'
      const { error: waitlistUpdateError } = await supabase
        .from('waitlist')
        .update({ status: 'booked' })
        .eq('id', convertingEntry.id)

      if (waitlistUpdateError) throw waitlistUpdateError

      // Create status history entry
      await supabase
        .from('booking_status_history')
        .insert({
          booking_id: booking.id,
          old_status: null,
          new_status: 'confirmed',
          changed_by: user.id,
          change_reason: 'Booking created from waitlist conversion'
        })

      toast.success('Successfully converted waitlist entry to booking!')
      setShowConvertDialog(false)
      setConvertingEntry(null)
      loadWaitlistEntries()
    } catch (error) {
      console.error('Error converting to booking:', error)
      toast.error('Failed to convert to booking')
    } finally {
      setIsConverting(false)
    }
  }

  // Handle customer selection
  const handleCustomerSelect = (customer: any) => {
    setSelectedCustomer(customer)
    setCustomerSearch(customer.profile?.full_name || customer.guest_name || "")
    setShowCustomerDropdown(false)
    
    // Auto-fill form fields if guest customer
    if (!customer.user_id) {
      setManualEntry(prev => ({
        ...prev,
        guest_name: customer.guest_name || "",
        guest_email: customer.guest_email || "",
        guest_phone: customer.guest_phone || ""
      }))
    } else {
      // Clear guest fields for registered customers
      setManualEntry(prev => ({
        ...prev,
        guest_name: "",
        guest_email: "",
        guest_phone: ""
      }))
    }
  }

  const handleClearCustomer = () => {
    setSelectedCustomer(null)
    setCustomerSearch("")
    setManualEntry(prev => ({
      ...prev,
      guest_name: "",
      guest_email: "",
      guest_phone: ""
    }))
  }

  // Add manual waitlist entry
  const addManualEntry = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      
      // Check restaurant availability for the desired date and time range
      const startDateTime = new Date(manualEntry.desired_date)
      const [startHours, startMinutes] = manualEntry.desired_time_start.split(':')
      startDateTime.setHours(parseInt(startHours), parseInt(startMinutes))

      const endDateTime = new Date(manualEntry.desired_date)
      const [endHours, endMinutes] = manualEntry.desired_time_end.split(':')
      endDateTime.setHours(parseInt(endHours), parseInt(endMinutes))

      // Check if restaurant is open during the desired time range
      const startAvailability = await availabilityService.isRestaurantOpen(
        restaurantId,
        startDateTime,
        manualEntry.desired_time_start
      )

      const endAvailability = await availabilityService.isRestaurantOpen(
        restaurantId,
        endDateTime,
        manualEntry.desired_time_end
      )

      if (!startAvailability.isOpen) {
        toast.error(`Restaurant is closed at ${manualEntry.desired_time_start}. ${startAvailability.reason || ''}`)
        return
      }

      if (!endAvailability.isOpen) {
        toast.error(`Restaurant is closed at ${manualEntry.desired_time_end}. ${endAvailability.reason || ''}`)
        return
      }

      // Prepare the data
      const entryData = {
        restaurant_id: restaurantId,
        user_id: selectedCustomer?.user_id || null,
        guest_name: selectedCustomer 
          ? (selectedCustomer.profile?.full_name || selectedCustomer.guest_name)
          : (manualEntry.guest_name || `Anonymous Guest ${format(new Date(), 'HH:mm')}`),
        guest_phone: selectedCustomer 
          ? (selectedCustomer.profile?.phone_number || selectedCustomer.guest_phone)
          : (manualEntry.guest_phone || null),
        guest_email: selectedCustomer?.guest_email || manualEntry.guest_email || null,
        desired_date: format(manualEntry.desired_date, 'yyyy-MM-dd'),
        desired_time_range: `${manualEntry.desired_time_start}-${manualEntry.desired_time_end}`,
        party_size: manualEntry.party_size,
        table_type: manualEntry.table_type,
        special_requests: manualEntry.special_requests || null,
        status: 'active'
      }

      const { error } = await supabase
        .from('waitlist')
        .insert(entryData)

      if (error) throw error

      toast.success('Waitlist entry added successfully')
      setShowAddDialog(false)
      setSelectedCustomer(null)
      setCustomerSearch("")
      setManualEntry({
        guest_name: '',
        guest_phone: '',
        guest_email: '',
        desired_date: new Date(),
        desired_time_start: '19:00',
        desired_time_end: '21:00',
        party_size: 2,
        table_type: 'any',
        special_requests: ''
      })
      loadWaitlistEntries()
    } catch (error) {
      console.error('Error adding entry:', error)
      toast.error('Failed to add waitlist entry')
    }
  }

  // Filter entries
  const filteredEntries = waitlistEntries.filter(entry => {
    // Search filter
    if (searchTerm) {
      const search = searchTerm.toLowerCase()
      const name = (entry.user?.full_name || entry.guest_name || '').toLowerCase()
      const phone = (entry.user?.phone_number || entry.guest_phone || '').toLowerCase()
      if (!name.includes(search) && !phone.includes(search)) return false
    }

    // Status filter
    if (statusFilter !== 'all' && entry.status !== statusFilter) return false

    // Tab filter
    if (activeTab === 'active' && !['active', 'notified'].includes(entry.status)) return false
    if (activeTab === 'completed' && !['booked', 'expired', 'cancelled'].includes(entry.status)) return false

    return true
  })

  // Get status color
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-blue-100 text-blue-800'
      case 'notified': return 'bg-yellow-100 text-yellow-800'
      case 'booked': return 'bg-green-100 text-green-800'
      case 'expired': return 'bg-gray-100 text-gray-800'
      case 'cancelled': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  // Format date
  const formatDate = (date: string) => {
    const d = parseISO(date)
    if (isToday(d)) return 'Today'
    if (isTomorrow(d)) return 'Tomorrow'
    return format(d, 'MMM d')
  }

  // Stats
  const stats = {
    total: waitlistEntries.length,
    active: waitlistEntries.filter(e => e.status === 'active').length,
    notified: waitlistEntries.filter(e => e.status === 'notified').length,
    completed: waitlistEntries.filter(e => ['booked', 'expired'].includes(e.status)).length
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Clock className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Waiting List</h1>
          <p className="text-muted-foreground">Manage your restaurant's waitlist</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => {
              setRefreshing(true)
              loadWaitlistEntries(false) // Explicit manual refresh with loading
            }}
            disabled={refreshing}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button onClick={() => setShowAddDialog(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Entry
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Active</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{stats.active}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Notified</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{stats.notified}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Completed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.completed}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex gap-4">
        <div className="flex-1">
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
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]">
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

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="active">Active</TabsTrigger>
          <TabsTrigger value="completed">Completed</TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="space-y-4">
          {filteredEntries.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No waitlist entries found</p>
              </CardContent>
            </Card>
          ) : (
            filteredEntries.map((entry) => (
              <Card key={entry.id}>
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-4">
                      <Avatar>
                        <AvatarImage src={entry.user?.avatar_url} />
                        <AvatarFallback>
                          {(entry.user?.full_name || entry.guest_name || 'G')[0]}
                        </AvatarFallback>
                      </Avatar>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold">
                            {entry.user?.full_name || entry.guest_name || 'Guest'}
                          </h3>
                          <Badge className={getStatusColor(entry.status)}>
                            {entry.status}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {formatDate(entry.desired_date)}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {entry.desired_time_range}
                          </span>
                          <span className="flex items-center gap-1">
                            <Users className="h-3 w-3" />
                            {entry.party_size} people
                          </span>
                        </div>
                        {(entry.user?.phone_number || entry.guest_phone) && (
                          <div className="flex items-center gap-2 text-sm">
                            <Phone className="h-3 w-3" />
                            {entry.user?.phone_number || entry.guest_phone}
                          </div>
                        )}
                        {entry.notification_expires_at && entry.status === 'notified' && (
                          <p className="text-sm text-yellow-600">
                            Expires: {format(parseISO(entry.notification_expires_at), 'h:mm a')}
                          </p>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex gap-2">
                      {entry.status === 'active' && (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => updateStatus(entry.id, 'notified')}
                          >
                            <AlertCircle className="h-4 w-4 mr-1" />
                            Notify
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => convertToBooking(entry.id)}
                          >
                            <CheckCircle className="h-4 w-4 mr-1" />
                            Book
                          </Button>
                        </>
                      )}
                      {entry.status === 'notified' && (
                        <Button
                          size="sm"
                          onClick={() => convertToBooking(entry.id)}
                        >
                          <CheckCircle className="h-4 w-4 mr-1" />
                          Convert to Booking
                        </Button>
                      )}
                      {['active', 'notified'].includes(entry.status) && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-red-600"
                          onClick={() => updateStatus(entry.id, 'expired')}
                        >
                          <XCircle className="h-4 w-4 mr-1" />
                          Expire
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>

      {/* Add Entry Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add Waitlist Entry</DialogTitle>
            <DialogDescription>
              Search for an existing customer or add a new entry to the waitlist
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6">
            {/* Customer Search */}
            <div className="space-y-4 rounded-xl border border-slate-200/60 dark:border-slate-700/60 p-4 bg-slate-50/50 dark:bg-slate-800/50">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <Search className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                Customer Selection (Optional)
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-300">
                Search for an existing customer or leave blank to create a new entry
              </p>
              
              <div className="relative">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                    placeholder="Search customers by name, email, or phone (min 2 characters)..."
                    value={customerSearch}
                    onChange={(e) => {
                      setCustomerSearch(e.target.value)
                      setShowCustomerDropdown(e.target.value.length >= 2)
                    }}
                    onFocus={() => setShowCustomerDropdown(customerSearch.length >= 2)}
                    onBlur={() => setTimeout(() => setShowCustomerDropdown(false), 150)}
                    className="pl-10"
                  />
                  {selectedCustomer && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-2 top-1/2 -translate-y-1/2 h-6 w-6 p-0"
                      onClick={handleClearCustomer}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  )}
                </div>
                
                {/* Customer dropdown */}
                {showCustomerDropdown && customerSearch.length >= 2 && (
                  <div className="absolute z-50 w-full mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl dark:shadow-slate-900/40 max-h-60 overflow-y-auto backdrop-blur-sm">
                    {customersLoading && (
                      <div className="p-4">
                        <p className="text-sm text-slate-600 dark:text-slate-300 flex items-center gap-2">
                          <RefreshCw className="h-4 w-4 animate-spin" />
                          Searching customers...
                        </p>
                      </div>
                    )}
                    
                    {customersError && (
                      <div className="p-4">
                        <p className="text-sm text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-lg border border-red-200 dark:border-red-800">
                          Error searching customers: {customersError.message}
                        </p>
                      </div>
                    )}
                    
                    {!customersLoading && !customersError && customers && customers.length > 0 && (
                      <>
                        {customers.map((customer) => (
                          <div
                            key={customer.id}
                            className="flex items-center gap-3 p-3 hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer border-b border-slate-100 dark:border-slate-700 last:border-b-0 transition-colors duration-150"
                            onClick={() => handleCustomerSelect(customer)}
                          >
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <p className="font-semibold text-gray-900 dark:text-white truncate">
                                  {customer.profile?.full_name || customer.guest_name || 'Guest'}
                                </p>
                                {customer.vip_status && (
                                  <Badge variant="secondary" className="text-xs bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-700">
                                    <Star className="h-3 w-3 mr-1 fill-current" />
                                    VIP
                                  </Badge>
                                )}
                                {customer.user_id && (
                                  <Badge variant="outline" className="text-xs bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300 border-green-300 dark:border-green-700">
                                    <UserCheck className="h-3 w-3 mr-1" />
                                    Registered
                                  </Badge>
                                )}
                              </div>
                              <div className="text-sm text-slate-600 dark:text-slate-300 truncate">
                                {customer.guest_email && <span>{customer.guest_email}</span>}
                                {customer.guest_email && (customer.profile?.phone_number || customer.guest_phone) && <span> • </span>}
                                {(customer.profile?.phone_number || customer.guest_phone) && (
                                  <span>{customer.profile?.phone_number || customer.guest_phone}</span>
                                )}
                              </div>
                              <div className="text-xs text-slate-500 dark:text-slate-400 truncate">
                                {customer.total_bookings} bookings
                                {customer.last_visit && (
                                  <span> • Last visit: {format(new Date(customer.last_visit), 'MMM d, yyyy')}</span>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </>
                    )}
                    
                    {!customersLoading && !customersError && customers && customers.length === 0 && (
                      <div className="p-4">
                        <p className="text-sm text-slate-600 dark:text-slate-300">No customers found matching "{customerSearch}"</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
              
              {/* Selected customer display */}
              {selectedCustomer && (
                <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-200 dark:border-blue-800 shadow-sm">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <UserCheck className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                      <span className="font-semibold text-gray-900 dark:text-white">Selected Customer:</span>
                      <span className="text-gray-800 dark:text-gray-200">{selectedCustomer.profile?.full_name || selectedCustomer.guest_name}</span>
                      {selectedCustomer.vip_status && (
                        <Badge variant="secondary" className="text-xs bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-700">
                          <Star className="h-3 w-3 mr-1 fill-current" />
                          VIP
                        </Badge>
                      )}
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={handleClearCustomer}
                    >
                      Clear
                    </Button>
                  </div>
            </div>
              )}
            </div>

            {/* Guest Information */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <UserCheck className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                {selectedCustomer ? 'Guest Information (Auto-filled)' : 'Guest Information (Optional)'}
              </h3>
            
              <div>
                <Label htmlFor="guest_name">Guest Name</Label>
                <Input
                  id="guest_name"
                  placeholder={selectedCustomer ? "Auto-filled from selected customer" : "Enter guest name or leave blank for anonymous"}
                  value={selectedCustomer 
                    ? (selectedCustomer.profile?.full_name || selectedCustomer.guest_name || "")
                    : manualEntry.guest_name
                  }
                  onChange={(e) => setManualEntry({ ...manualEntry, guest_name: e.target.value })}
                  disabled={!!selectedCustomer}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="guest_phone">Phone Number</Label>
                  <Input
                    id="guest_phone"
                    type="tel"
                    placeholder={selectedCustomer ? "Auto-filled from selected customer" : "Enter phone number"}
                    value={selectedCustomer 
                      ? (selectedCustomer.profile?.phone_number || selectedCustomer.guest_phone || "")
                      : manualEntry.guest_phone
                    }
                    onChange={(e) => setManualEntry({ ...manualEntry, guest_phone: e.target.value })}
                    disabled={!!selectedCustomer}
                  />
                </div>

              <div>
                  <Label htmlFor="guest_email">Email</Label>
                <Input
                    id="guest_email"
                    type="email"
                    placeholder={selectedCustomer ? "Auto-filled from selected customer" : "Enter email address"}
                    value={selectedCustomer 
                      ? (selectedCustomer.guest_email || "")
                      : manualEntry.guest_email
                    }
                    onChange={(e) => setManualEntry({ ...manualEntry, guest_email: e.target.value })}
                    disabled={!!selectedCustomer}
                  />
                </div>
              </div>
            </div>

            {/* Waitlist Details */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <CalendarIcon className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                Waitlist Details
              </h3>
              
              <div>
                <Label>Date *</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant={"outline"}
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !manualEntry.desired_date && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {manualEntry.desired_date ? format(manualEntry.desired_date, "PPP") : <span>Pick a date</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <CalendarComponent
                      mode="single"
                      selected={manualEntry.desired_date}
                      onSelect={(date) => date && setManualEntry({ ...manualEntry, desired_date: date })}
                      disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="desired_time_start">Start Time *</Label>
                  <div className="relative">
                    <Clock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="desired_time_start"
                      type="time"
                      value={manualEntry.desired_time_start}
                      onChange={(e) => setManualEntry({ ...manualEntry, desired_time_start: e.target.value })}
                      className="pl-10"
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="desired_time_end">End Time *</Label>
                  <div className="relative">
                    <Clock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="desired_time_end"
                      type="time"
                      value={manualEntry.desired_time_end}
                      onChange={(e) => setManualEntry({ ...manualEntry, desired_time_end: e.target.value })}
                      className="pl-10"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="party_size">Party Size *</Label>
                  <div className="relative">
                    <Users className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                      id="party_size"
                  type="number"
                      min="1"
                      max="20"
                  value={manualEntry.party_size}
                  onChange={(e) => setManualEntry({ ...manualEntry, party_size: parseInt(e.target.value) || 1 })}
                      className="pl-10"
                />
              </div>
                </div>

              <div>
                  <Label htmlFor="table_type">Table Type</Label>
                <Select 
                  value={manualEntry.table_type} 
                  onValueChange={(value) => setManualEntry({ ...manualEntry, table_type: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="any">Any</SelectItem>
                    <SelectItem value="indoor">Indoor</SelectItem>
                    <SelectItem value="outdoor">Outdoor</SelectItem>
                    <SelectItem value="bar">Bar</SelectItem>
                    <SelectItem value="private">Private</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

              <div>
                <Label htmlFor="special_requests">Special Requests</Label>
                <Input
                  id="special_requests"
                  placeholder="Any special requirements..."
                  value={manualEntry.special_requests}
                  onChange={(e) => setManualEntry({ ...manualEntry, special_requests: e.target.value })}
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button variant="outline" onClick={() => {
                setShowAddDialog(false)
                setSelectedCustomer(null)
                setCustomerSearch("")
              }}>
                Cancel
              </Button>
              <Button onClick={addManualEntry}>
                Add Entry
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Convert to Booking Dialog */}
      <Dialog open={showConvertDialog} onOpenChange={(open) => {
        if (!open) {
          setShowConvertDialog(false)
          setConvertingEntry(null)
        }
      }}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Convert to Booking</DialogTitle>
            <DialogDescription>
              {convertingEntry && (
                <>
                  Converting waitlist entry for{" "}
                  <span className="font-medium">
                    {convertingEntry.user?.full_name || convertingEntry.guest_name || 'Guest'}
                  </span>{" "}
                  - {convertingEntry.party_size} people on{" "}
                  {format(new Date(convertingEntry.desired_date), 'MMM d, yyyy')}
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          
          {convertingEntry && (
            <div className="space-y-6">
              {/* Guest Summary */}
              <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-lg">
                <h3 className="font-medium text-gray-900 dark:text-white mb-2">Guest Information</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-slate-600 dark:text-slate-400">Name:</span>{" "}
                    <span className="text-gray-900 dark:text-white">
                      {convertingEntry.user?.full_name || convertingEntry.guest_name || 'Guest'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-600 dark:text-slate-400">Party Size:</span>{" "}
                    <span className="text-gray-900 dark:text-white">{convertingEntry.party_size} people</span>
                  </div>
                  <div>
                    <span className="text-slate-600 dark:text-slate-400">Phone:</span>{" "}
                    <span className="text-gray-900 dark:text-white">
                      {convertingEntry.user?.phone_number || convertingEntry.guest_phone || 'N/A'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-600 dark:text-slate-400">Desired Range:</span>{" "}
                    <span className="text-gray-900 dark:text-white">{convertingEntry.desired_time_range}</span>
                  </div>
                </div>
                {convertingEntry.special_requests && (
                  <div className="mt-2">
                    <span className="text-slate-600 dark:text-slate-400">Special Requests:</span>{" "}
                    <span className="text-gray-900 dark:text-white">{convertingEntry.special_requests}</span>
                  </div>
                )}
              </div>

              {/* Time Selection */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                  <Clock className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  Select Booking Time
                </h3>
                <p className="text-sm text-slate-600 dark:text-slate-300">
                  Choose a time within the desired range: {convertingEntry.desired_time_range}
                </p>
                
                <div className="grid grid-cols-4 gap-2">
                  {getAvailableTimeSlots().map((timeSlot) => (
                    <Button
                      key={timeSlot}
                      variant={selectedTime === timeSlot ? "default" : "outline"}
                      size="sm"
                      onClick={() => setSelectedTime(timeSlot)}
                      className="text-sm"
                    >
                      {timeSlot}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Table Selection */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                      <Users className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                      Select Tables
                    </h3>
                    <p className="text-sm text-slate-600 dark:text-slate-300">
                      Choose tables for {convertingEntry.party_size} guests
                      {selectedTables.length > 0 && (
                        <span> (Selected capacity: {
                          allTables?.filter(t => selectedTables.includes(t.id))
                            .reduce((sum, t) => sum + t.capacity, 0) || 0
                        })</span>
                      )}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={suggestTablesForConversion}
                    disabled={!selectedTime || checkingAvailability}
                  >
                    <RefreshCw className={`h-4 w-4 mr-1 ${checkingAvailability ? 'animate-spin' : ''}`} />
                    Auto-suggest
                  </Button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {allTables?.map((table) => {
                    const isSelected = selectedTables.includes(table.id)
                    const isAvailable = isTableAvailableForConversion(table.id)
                    
                    return (
                      <label
                        key={table.id}
                        className={cn(
                          "flex items-center p-3 border rounded-lg cursor-pointer transition-all",
                          isSelected && "bg-blue-50 dark:bg-blue-900/30 border-blue-300 dark:border-blue-700",
                          !isSelected && isAvailable && "hover:bg-slate-50 dark:hover:bg-slate-700",
                          !isAvailable && "opacity-50 cursor-not-allowed bg-red-50 dark:bg-red-900/20"
                        )}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => {
                            if (!isAvailable) {
                              toast.error("This table is not available for the selected time")
                              return
                            }
                            setSelectedTables(prev => 
                              prev.includes(table.id) 
                                ? prev.filter(id => id !== table.id)
                                : [...prev, table.id]
                            )
                          }}
                          disabled={!isAvailable}
                          className="mr-3"
                        />
                        <div className="flex-1">
                          <div className="font-medium text-gray-900 dark:text-white">
                            Table {table.table_number}
                          </div>
                          <div className="text-sm text-slate-600 dark:text-slate-300">
                            {table.capacity} seats • {table.table_type}
                          </div>
                          {!isAvailable && (
                            <div className="text-xs text-red-600 dark:text-red-400">
                              Not available at selected time
                            </div>
                          )}
                        </div>
                      </label>
                    )
                  })}
                </div>
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-3 pt-4 border-t">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowConvertDialog(false)
                    setConvertingEntry(null)
                  }}
                  disabled={isConverting}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSimpleConversion}
                  disabled={!selectedTime || selectedTables.length === 0 || isConverting}
                >
                  {isConverting ? "Converting..." : "Convert to Booking"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}