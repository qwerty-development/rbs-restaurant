// components/dashboard/waitlist-panel.tsx
"use client"

import React, { useState, useCallback, useMemo } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Calendar as CalendarComponent } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { cn } from "@/lib/utils"
import { format, parseISO, differenceInMinutes, isToday, isTomorrow } from "date-fns"
import { createClient } from "@/lib/supabase/client"
import { toast } from "react-hot-toast"
import { useQuery } from "@tanstack/react-query"
import { TableAvailabilityService } from "@/lib/table-availability"
import { RestaurantAvailability } from "@/lib/restaurant-availability"
import {
  Clock,
  Users,
  Calendar,
  Phone,
  AlertCircle,
  CheckCircle,
  XCircle,
  UserPlus,
  Bell,
  ArrowRight,
  Timer,
  Plus,
  Search,
  Filter,
  ChevronRight,
  Info,
  RefreshCw,
  CalendarIcon,
  UserCheck,
  Star,
  X,
  Edit,
  Trash
} from "lucide-react"

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

interface WaitlistPanelProps {
  restaurantId: string
  currentTime: Date
  tables: any[]
  bookings: any[]
  onConvertToBooking: (entry: WaitlistEntry, tableIds?: string[]) => void
  onRefresh?: () => void
  className?: string
}

export function WaitlistPanel({
  restaurantId,
  currentTime,
  tables,
  bookings,
  onConvertToBooking,
  onRefresh,
  className
}: WaitlistPanelProps) {
  const [waitlistEntries, setWaitlistEntries] = useState<WaitlistEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("active")
  
  // Dialog states
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [showConvertDialog, setShowConvertDialog] = useState(false)
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [showNotifyDialog, setShowNotifyDialog] = useState(false)
  
  // Selected entries
  const [selectedEntry, setSelectedEntry] = useState<WaitlistEntry | null>(null)
  const [convertingEntry, setConvertingEntry] = useState<WaitlistEntry | null>(null)
  const [editingEntry, setEditingEntry] = useState<WaitlistEntry | null>(null)
  const [notifyingEntry, setNotifyingEntry] = useState<WaitlistEntry | null>(null)

  // Customer search
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null)
  const [customerSearch, setCustomerSearch] = useState("")
  const [debouncedCustomerSearch, setDebouncedCustomerSearch] = useState("")
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false)

  // Conversion state
  const [selectedTime, setSelectedTime] = useState('')
  const [selectedTables, setSelectedTables] = useState<string[]>([])
  const [checkingAvailability, setCheckingAvailability] = useState(false)
  const [isConverting, setIsConverting] = useState(false)
  const [isAddingEntry, setIsAddingEntry] = useState(false)

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
  
  const supabase = createClient()
  const tableService = new TableAvailabilityService()
  const availabilityService = new RestaurantAvailability()

  // Load waitlist entries with better error handling
  const loadWaitlist = useCallback(async (silent = false) => {
    if (!restaurantId) return
    
    try {
      if (!silent) {
        setLoading(true)
      } else {
        setRefreshing(true)
      }
      
      // Expire stale notified entries first
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
        console.warn('Local waitlist expiry skipped:', e)
      }
      
      // Fetch entries for today and tomorrow (use fresh date each time)
      const now = new Date()
      const today = format(now, 'yyyy-MM-dd')
      const tomorrow = format(new Date(now.getTime() + 24 * 60 * 60 * 1000), 'yyyy-MM-dd')
      
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
        .in('desired_date', [today, tomorrow])
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

  // Load on mount and when restaurant changes
  React.useEffect(() => {
    loadWaitlist()
  }, [loadWaitlist])

  // Auto-refresh every 3 minutes (reduced from 30 seconds)
  React.useEffect(() => {
    const interval = setInterval(() => {
      if (restaurantId && !refreshing) {
        loadWaitlist(true) // Silent refresh
      }
    }, 180000) // 3 minutes
    
    return () => clearInterval(interval)
  }, [restaurantId, refreshing, loadWaitlist])

  // Debounce customer search
  React.useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedCustomerSearch(customerSearch)
    }, 300)
    return () => clearTimeout(timer)
  }, [customerSearch])

  // Fetch customers for search
  const { data: customers, error: customersError, isLoading: customersLoading } = useQuery({
    queryKey: ["restaurant-customers", restaurantId, debouncedCustomerSearch],
    queryFn: async () => {
      if (!debouncedCustomerSearch.trim() || debouncedCustomerSearch.length < 2) return []
      
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

      if (error) throw error
      return data || []
    },
    enabled: debouncedCustomerSearch.length >= 2 && !!restaurantId,
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

  // Update status
  const updateStatus = async (entryId: string, newStatus: string) => {
    try {
      const updateData: any = { status: newStatus }
      
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
      loadWaitlist()
    } catch (error) {
      console.error('Error updating status:', error)
      toast.error('Failed to update status')
    }
  }

  // Delete entry
  const deleteEntry = async (entryId: string) => {
    try {
      const { error } = await supabase
        .from('waitlist')
        .delete()
        .eq('id', entryId)

      if (error) throw error

      toast.success('Entry deleted successfully')
      loadWaitlist()
    } catch (error) {
      console.error('Error deleting entry:', error)
      toast.error('Failed to delete entry')
    }
  }

  // Handle customer selection
  const handleCustomerSelect = (customer: any) => {
    setSelectedCustomer(customer)
    setCustomerSearch(customer.profile?.full_name || customer.guest_name || "")
    setShowCustomerDropdown(false)
    
    if (!customer.user_id) {
      setManualEntry(prev => ({
        ...prev,
        guest_name: customer.guest_name || "",
        guest_email: customer.guest_email || "",
        guest_phone: customer.guest_phone || ""
      }))
    } else {
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

  // Check table availability for waitlist entry
  const checkAvailability = useCallback((entry: WaitlistEntry) => {
    // Find available tables for the party size
    const availableTables = tables.filter(table => {
      if (!table.is_active) return false
      
      // Check if table is occupied
      const isOccupied = bookings.some(booking => {
        const diningStatuses = ['arrived', 'seated', 'ordered', 'appetizers', 'main_course', 'dessert', 'payment']
        return diningStatuses.includes(booking.status) && 
               booking.tables?.some((t: any) => t.id === table.id)
      })
      
      return !isOccupied && table.max_capacity >= entry.party_size
    })
    
    return availableTables.length > 0
  }, [tables, bookings])

  // Add manual waitlist entry
  const addManualEntry = async () => {
    if (isAddingEntry) return // Prevent multiple submissions
    
    try {
      setIsAddingEntry(true)
      const { data: { user } } = await supabase.auth.getUser()
      
      const startDateTime = new Date(manualEntry.desired_date)
      const [startHours, startMinutes] = manualEntry.desired_time_start.split(':')
      startDateTime.setHours(parseInt(startHours), parseInt(startMinutes))

      const endDateTime = new Date(manualEntry.desired_date)
      const [endHours, endMinutes] = manualEntry.desired_time_end.split(':')
      endDateTime.setHours(parseInt(endHours), parseInt(endMinutes))

      // Check if the desired time is in the past
      const now = new Date()
      if (startDateTime <= now) {
        toast.error('Cannot create waitlist entry for past time. Please select a future date and time.')
        return
      }

      if (endDateTime <= startDateTime) {
        toast.error('End time must be after start time.')
        return
      }

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
      resetForm()
      loadWaitlist()
    } catch (error) {
      console.error('Error adding entry:', error)
      toast.error('Failed to add waitlist entry')
    } finally {
      setIsAddingEntry(false)
    }
  }

  // Reset form
  const resetForm = () => {
    setSelectedCustomer(null)
    setCustomerSearch("")
    setIsAddingEntry(false)
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
  }

  // Notify customer
  const notifyCustomer = async (entry: WaitlistEntry) => {
    if (!checkAvailability(entry)) {
      toast.error("No tables available for this party size")
      return
    }
    
    setNotifyingEntry(entry)
    setShowNotifyDialog(true)
  }

  // Confirm notification
  const confirmNotification = async () => {
    if (!notifyingEntry) return
    
    await updateStatus(notifyingEntry.id, 'notified')
    setShowNotifyDialog(false)
    setNotifyingEntry(null)
  }

  // Open convert dialog
  const openConvertDialog = (entry: WaitlistEntry) => {
    setConvertingEntry(entry)
    setSelectedTime('')
    setSelectedTables([])
    setShowConvertDialog(true)
  }

  // Open edit dialog
  const openEditDialog = (entry: WaitlistEntry) => {
    setEditingEntry(entry)
    setManualEntry({
      guest_name: entry.guest_name || '',
      guest_phone: entry.guest_phone || '',
      guest_email: entry.guest_email || '',
      desired_date: new Date(entry.desired_date),
      desired_time_start: entry.desired_time_range.split('-')[0],
      desired_time_end: entry.desired_time_range.split('-')[1],
      party_size: entry.party_size,
      table_type: entry.table_type,
      special_requests: entry.special_requests || ''
    })
    setShowEditDialog(true)
  }

  // Update entry
  const updateEntry = async () => {
    if (!editingEntry) return

    try {
      // Validate that the updated time is not in the past
      const startDateTime = new Date(manualEntry.desired_date)
      const [startHours, startMinutes] = manualEntry.desired_time_start.split(':')
      startDateTime.setHours(parseInt(startHours), parseInt(startMinutes))

      const endDateTime = new Date(manualEntry.desired_date)
      const [endHours, endMinutes] = manualEntry.desired_time_end.split(':')
      endDateTime.setHours(parseInt(endHours), parseInt(endMinutes))

      const now = new Date()
      if (startDateTime <= now) {
        toast.error('Cannot update waitlist entry to past time. Please select a future date and time.')
        return
      }

      if (endDateTime <= startDateTime) {
        toast.error('End time must be after start time.')
        return
      }

      const updateData = {
        guest_name: manualEntry.guest_name || editingEntry.guest_name,
        guest_phone: manualEntry.guest_phone || editingEntry.guest_phone,
        guest_email: manualEntry.guest_email || editingEntry.guest_email,
        desired_date: format(manualEntry.desired_date, 'yyyy-MM-dd'),
        desired_time_range: `${manualEntry.desired_time_start}-${manualEntry.desired_time_end}`,
        party_size: manualEntry.party_size,
        table_type: manualEntry.table_type,
        special_requests: manualEntry.special_requests
      }

      const { error } = await supabase
        .from('waitlist')
        .update(updateData)
        .eq('id', editingEntry.id)

      if (error) throw error

      toast.success('Entry updated successfully')
      setShowEditDialog(false)
      setEditingEntry(null)
      resetForm()
      loadWaitlist()
    } catch (error) {
      console.error('Error updating entry:', error)
      toast.error('Failed to update entry')
    }
  }

  // Generate available time slots
  const getAvailableTimeSlots = () => {
    if (!convertingEntry) return []

    const [startTime, endTime] = convertingEntry.desired_time_range.split('-')
    const slots = []
    
    const [startHour, startMin] = startTime.trim().split(':').map(Number)
    const [endHour, endMin] = endTime.trim().split(':').map(Number)
    
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

  // Handle conversion to booking
  const handleConvertToBooking = async () => {
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

      const bookingDate = new Date(convertingEntry.desired_date)
      const [hours, minutes] = selectedTime.split(':')
      bookingDate.setHours(parseInt(hours), parseInt(minutes))

      const confirmationCode = `${restaurantId.slice(0, 4).toUpperCase()}${Math.random().toString(36).substring(2, 8).toUpperCase()}`

      const { data: booking, error: bookingError } = await supabase
        .from("bookings")
        .insert({
          restaurant_id: restaurantId,
          user_id: convertingEntry.user_id || user.id,
          guest_name: convertingEntry.user?.full_name || convertingEntry.guest_name,
          guest_email: convertingEntry.guest_email,
          guest_phone: convertingEntry.user?.phone_number || convertingEntry.guest_phone,
          booking_time: bookingDate.toISOString(),
          party_size: convertingEntry.party_size,
          turn_time_minutes: 120,
          status: 'confirmed',
          special_requests: convertingEntry.special_requests,
          confirmation_code: confirmationCode,
          source:'manual'
        })
        .select()
        .single()

      if (bookingError) throw bookingError

      const tableAssignments = selectedTables.map((tableId: string) => ({
        booking_id: booking.id,
        table_id: tableId,
      }))

      const { error: tableError } = await supabase
        .from("booking_tables")
        .insert(tableAssignments)

      if (tableError) throw tableError

      await updateStatus(convertingEntry.id, 'booked')

      toast.success('Successfully converted waitlist entry to booking!')
      setShowConvertDialog(false)
      setConvertingEntry(null)
      setSelectedTime('')
      setSelectedTables([])
    } catch (error) {
      console.error('Error converting to booking:', error)
      toast.error('Failed to convert to booking')
    } finally {
      setIsConverting(false)
    }
  }

  // Filter entries
  const filteredEntries = useMemo(() => {
    return waitlistEntries.filter(entry => {
      // Status filter
      if (statusFilter !== 'all' && entry.status !== statusFilter) return false
      
      // Search filter
      if (searchTerm) {
        const search = searchTerm.toLowerCase()
        const name = (entry.user?.full_name || entry.guest_name || '').toLowerCase()
        const phone = (entry.user?.phone_number || entry.guest_phone || '').toLowerCase()
        return name.includes(search) || phone.includes(search)
      }
      
      return true
    })
  }, [waitlistEntries, statusFilter, searchTerm])

  // Stats
  const stats = {
    active: waitlistEntries.filter(e => e.status === 'active').length,
    notified: waitlistEntries.filter(e => e.status === 'notified').length,
    total: waitlistEntries.length
  }

  // Get entry urgency
  const getEntryUrgency = (entry: WaitlistEntry) => {
    const [startTime] = entry.desired_time_range.split('-')
    const desiredTime = new Date(`${entry.desired_date}T${startTime}:00`)
    const minutesUntil = differenceInMinutes(desiredTime, currentTime)
    
    if (minutesUntil < 0) return 'overdue'
    if (minutesUntil <= 15) return 'urgent'
    if (minutesUntil <= 30) return 'soon'
    return 'normal'
  }

  // Render individual entry
  const renderEntry = (entry: WaitlistEntry) => {
    const urgency = getEntryUrgency(entry)
    const hasAvailability = checkAvailability(entry)
    const isNotified = entry.status === 'notified'
    const isExpired = entry.status === 'expired'
    
    return (
      <div
        key={entry.id}
        className={cn(
          "p-2 rounded-lg border transition-all group hover:shadow-sm",
          urgency === 'overdue' && "border-red-500 bg-red-50 dark:bg-red-900/20",
          urgency === 'urgent' && "border-orange-500 bg-orange-50 dark:bg-orange-900/20",
          urgency === 'soon' && "border-yellow-500 bg-yellow-50 dark:bg-yellow-900/20",
          urgency === 'normal' && "border-border bg-card",
          isNotified && "border-blue-500 bg-blue-50 dark:bg-blue-900/20",
          isExpired && "opacity-50"
        )}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 flex-1">
            <Avatar className="h-6 w-6">
              <AvatarImage src={entry.user?.avatar_url} />
              <AvatarFallback className="text-xs">
                {(entry.user?.full_name || entry.guest_name || 'G')[0]}
              </AvatarFallback>
            </Avatar>
            
            <div className="flex-1 min-w-0">
              {/* Customer info */}
              <div className="flex items-center gap-1 mb-1">
                <p className="font-medium text-sm truncate">
                  {entry.user?.full_name || entry.guest_name || 'Guest'}
                </p>
                <Badge 
                  className={cn(
                    "text-xs px-1 py-0 h-4",
                    entry.status === 'active' && "bg-green-100 text-green-800",
                    entry.status === 'notified' && "bg-blue-100 text-blue-800",
                    entry.status === 'booked' && "bg-purple-100 text-purple-800",
                    entry.status === 'expired' && "bg-gray-100 text-gray-800"
                  )}
                >
                  {entry.status}
                </Badge>
              </div>
              
              {/* Details */}
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-0.5">
                  <Clock className="h-3 w-3" />
                  {entry.desired_time_range}
                </span>
                <span className="flex items-center gap-0.5">
                  <Users className="h-3 w-3" />
                  {entry.party_size}
                </span>
                {(entry.user?.phone_number || entry.guest_phone) && (
                  <span className="flex items-center gap-0.5">
                    <Phone className="h-3 w-3" />
                    {(entry.user?.phone_number || entry.guest_phone)?.slice(-4)}
                  </span>
                )}
              </div>
              
              {/* Notification expiry warning */}
              {isNotified && entry.notification_expires_at && (
                <div className="mt-1">
                  <span className="text-xs text-blue-600 font-medium">
                    Expires: {format(parseISO(entry.notification_expires_at), 'h:mm a')}
                  </span>
                </div>
              )}
            </div>
          </div>
          
          {/* Actions */}
          <div className="flex items-center gap-1">
            {/* Main action buttons */}
            {entry.status === 'active' && hasAvailability && (
              <Button
                size="sm"
                onClick={() => notifyCustomer(entry)}
                className="h-5 px-1 text-xs bg-blue-600 hover:bg-blue-700"
              >
                <Bell className="h-3 w-3" />
              </Button>
            )}
            
            {(entry.status === 'active' || entry.status === 'notified') && (
              <Button
                size="sm"
                onClick={() => openConvertDialog(entry)}
                className="h-5 px-1 text-xs bg-green-600 hover:bg-green-700"
              >
                <CheckCircle className="h-3 w-3" />
              </Button>
            )}
            
            {/* Secondary actions (visible on hover) */}
            <div className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
              {['active', 'notified'].includes(entry.status) && (
                <>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => openEditDialog(entry)}
                    className="h-5 px-1 text-xs text-blue-600 hover:text-blue-700"
                  >
                    <Edit className="h-3 w-3" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => updateStatus(entry.id, 'expired')}
                    className="h-5 px-1 text-xs text-orange-600 hover:text-orange-700"
                  >
                    <XCircle className="h-3 w-3" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => deleteEntry(entry.id)}
                    className="h-5 px-1 text-xs text-red-600 hover:text-red-700"
                  >
                    <Trash className="h-3 w-3" />
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={cn("flex flex-col h-full", className)}>
      {/* Header */}
      <div className="px-2 py-1.5 border-b border-border flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Timer className="h-3.5 w-3.5 text-orange-500" />
            <h3 className="text-xs font-semibold">Waitlist</h3>
            <Badge className="text-xs px-1 py-0 bg-orange-100 text-orange-800">
              {stats.active}
            </Badge>
          </div>
          <div className="flex items-center gap-1">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setShowAddDialog(true)}
              className="h-5 w-5 p-0 text-green-600 hover:text-green-700"
            >
              <Plus className="h-3 w-3" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setRefreshing(true)
                loadWaitlist(false)
              }}
              disabled={refreshing}
              className="h-5 w-5 p-0"
            >
              <RefreshCw className={cn("h-3 w-3", refreshing && "animate-spin")} />
            </Button>
          </div>
        </div>
      </div>
      
      {/* Quick stats */}
      {stats.total > 0 && (
        <div className="px-2 py-1 flex items-center gap-2 text-xs border-b border-border">
          <span className="flex items-center gap-1">
            <div className="h-1.5 w-1.5 bg-green-500 rounded-full" />
            <span className="text-green-600">{stats.active} waiting</span>
          </span>
          {stats.notified > 0 && (
            <span className="flex items-center gap-1">
              <div className="h-1.5 w-1.5 bg-blue-500 rounded-full animate-pulse" />
              <span className="text-blue-600">{stats.notified} notified</span>
            </span>
          )}
        </div>
      )}
      
      {/* Filters */}
      <div className="px-2 py-1 flex items-center gap-1 border-b border-border">
        <div className="flex-1 relative">
          <Search className="absolute left-1.5 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
          <Input
            placeholder="Search..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="h-6 pl-6 text-xs"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="h-6 w-20 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="notified">Notified</SelectItem>
            <SelectItem value="expired">Expired</SelectItem>
          </SelectContent>
        </Select>
      </div>
      
      {/* Entries list */}
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1.5">
          {loading ? (
            <div className="text-center py-4">
              <Clock className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
            </div>
          ) : filteredEntries.length === 0 ? (
            <div className="text-center py-6">
              <Timer className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No waitlist entries</p>
              <p className="text-xs text-muted-foreground mt-1">
                {searchTerm || statusFilter !== 'all' ? 'Try adjusting filters' : 'Customers can join when tables are full'}
              </p>
            </div>
          ) : (
            filteredEntries.map(renderEntry)
          )}
        </div>
      </ScrollArea>
      
      {/* Add Entry Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add Waitlist Entry</DialogTitle>
            <DialogDescription>
              Add a new customer to the waitlist
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {/* Customer Search */}
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-popover-foreground flex items-center gap-2">
                <Search className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                Customer Search (Optional)
              </h3>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search existing customers..."
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
                <div className="absolute z-50 w-full mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg max-h-40 overflow-y-auto">
                  {customersLoading && (
                    <div className="p-3 text-sm text-muted-foreground">Searching...</div>
                  )}
                  {customers && customers.length > 0 && (
                    customers.map((customer) => (
                      <div
                        key={customer.id}
                        className="p-2 hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer"
                        onClick={() => handleCustomerSelect(customer)}
                      >
                        <div className="font-medium text-sm">
                          {customer.profile?.full_name || customer.guest_name}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {customer.guest_email || customer.guest_phone}
                        </div>
                      </div>
                    ))
                  )}
                  {customers && customers.length === 0 && !customersLoading && (
                    <div className="p-3 text-sm text-muted-foreground">No customers found</div>
                  )}
                </div>
              )}

              {selectedCustomer && (
                <div className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">
                      {selectedCustomer.profile?.full_name || selectedCustomer.guest_name}
                    </span>
                    <Button variant="ghost" size="sm" onClick={handleClearCustomer}>
                      Clear
                    </Button>
                  </div>
                </div>
              )}
            </div>

            {/* Guest Information */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-popover-foreground flex items-center gap-2">
                <UserCheck className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                Guest Information (Optional)
              </h3>
              <Input
                placeholder="Guest name"
                value={selectedCustomer 
                  ? (selectedCustomer.profile?.full_name || selectedCustomer.guest_name || "")
                  : manualEntry.guest_name
                }
                onChange={(e) => setManualEntry({ ...manualEntry, guest_name: e.target.value })}
                disabled={!!selectedCustomer}
              />
              <div className="grid grid-cols-2 gap-2">
                <Input
                  placeholder="Phone"
                  value={selectedCustomer 
                    ? (selectedCustomer.profile?.phone_number || selectedCustomer.guest_phone || "")
                    : manualEntry.guest_phone
                  }
                  onChange={(e) => setManualEntry({ ...manualEntry, guest_phone: e.target.value })}
                  disabled={!!selectedCustomer}
                />
                <Input
                  placeholder="Email"
                  value={selectedCustomer 
                    ? (selectedCustomer.guest_email || "")
                    : manualEntry.guest_email
                  }
                  onChange={(e) => setManualEntry({ ...manualEntry, guest_email: e.target.value })}
                  disabled={!!selectedCustomer}
                />
              </div>
            </div>

            {/* Waitlist Details */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-popover-foreground flex items-center gap-2">
                <Calendar className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                Waitlist Details
              </h3>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start text-left">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {format(manualEntry.desired_date, "PPP")}
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
              
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs">Start Time</Label>
                  <Input
                    type="time"
                    value={manualEntry.desired_time_start}
                    onChange={(e) => setManualEntry({ ...manualEntry, desired_time_start: e.target.value })}
                  />
                </div>
                <div>
                  <Label className="text-xs">End Time</Label>
                  <Input
                    type="time"
                    value={manualEntry.desired_time_end}
                    onChange={(e) => setManualEntry({ ...manualEntry, desired_time_end: e.target.value })}
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs">Party Size</Label>
                  <Input
                    type="number"
                    min="1"
                    max="20"
                    value={manualEntry.party_size}
                    onChange={(e) => setManualEntry({ ...manualEntry, party_size: parseInt(e.target.value) || 1 })}
                  />
                </div>
                <div>
                  <Label className="text-xs">Table Type</Label>
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
              
              <Input
                placeholder="Special requests"
                value={manualEntry.special_requests}
                onChange={(e) => setManualEntry({ ...manualEntry, special_requests: e.target.value })}
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setShowAddDialog(false)
              resetForm()
            }}>
              Cancel
            </Button>
            <Button 
              onClick={addManualEntry}
              disabled={isAddingEntry}
            >
              {isAddingEntry ? "Adding..." : "Add Entry"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Entry Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Waitlist Entry</DialogTitle>
            <DialogDescription>
              Update waitlist entry details
            </DialogDescription>
          </DialogHeader>
          
          {editingEntry && (
            <div className="space-y-4">
              <Input
                placeholder="Guest name"
                value={manualEntry.guest_name}
                onChange={(e) => setManualEntry({ ...manualEntry, guest_name: e.target.value })}
              />
              
              <div className="grid grid-cols-2 gap-2">
                <Input
                  placeholder="Phone"
                  value={manualEntry.guest_phone}
                  onChange={(e) => setManualEntry({ ...manualEntry, guest_phone: e.target.value })}
                />
                <Input
                  placeholder="Email"
                  value={manualEntry.guest_email}
                  onChange={(e) => setManualEntry({ ...manualEntry, guest_email: e.target.value })}
                />
              </div>
              
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs">Start Time</Label>
                  <Input
                    type="time"
                    value={manualEntry.desired_time_start}
                    onChange={(e) => setManualEntry({ ...manualEntry, desired_time_start: e.target.value })}
                  />
                </div>
                <div>
                  <Label className="text-xs">End Time</Label>
                  <Input
                    type="time"
                    value={manualEntry.desired_time_end}
                    onChange={(e) => setManualEntry({ ...manualEntry, desired_time_end: e.target.value })}
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs">Party Size</Label>
                  <Input
                    type="number"
                    min="1"
                    max="20"
                    value={manualEntry.party_size}
                    onChange={(e) => setManualEntry({ ...manualEntry, party_size: parseInt(e.target.value) || 1 })}
                  />
                </div>
                <div>
                  <Label className="text-xs">Table Type</Label>
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
              
              <Input
                placeholder="Special requests"
                value={manualEntry.special_requests}
                onChange={(e) => setManualEntry({ ...manualEntry, special_requests: e.target.value })}
              />
            </div>
          )}
          
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setShowEditDialog(false)
              setEditingEntry(null)
              resetForm()
            }}>
              Cancel
            </Button>
            <Button onClick={updateEntry}>
              Update Entry
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Convert to Booking Dialog */}
      <Dialog open={showConvertDialog} onOpenChange={(open) => {
        if (!open) {
          setShowConvertDialog(false)
          setConvertingEntry(null)
          setSelectedTime('')
          setSelectedTables([])
        }
      }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Convert to Booking</DialogTitle>
            <DialogDescription>
              {convertingEntry && (
                <>
                  Converting waitlist entry for {convertingEntry.user?.full_name || convertingEntry.guest_name || 'Guest'} - {convertingEntry.party_size} people
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          
          {convertingEntry && (
            <div className="space-y-6">
              {/* Time Selection */}
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-popover-foreground flex items-center gap-2">
                  <Clock className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  Select Time
                </h3>
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
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-popover-foreground flex items-center gap-2">
                  <Users className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  Select Tables (Capacity needed: {convertingEntry.party_size})
                </h3>
                <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto">
                  {allTables?.map((table) => {
                    const isSelected = selectedTables.includes(table.id)
                    
                    return (
                      <label
                        key={table.id}
                        className={cn(
                          "flex items-center p-2 border rounded cursor-pointer transition-all",
                          isSelected && "bg-blue-50 dark:bg-blue-900/30 border-blue-300 dark:border-blue-700"
                        )}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => {
                            setSelectedTables(prev => 
                              prev.includes(table.id) 
                                ? prev.filter(id => id !== table.id)
                                : [...prev, table.id]
                            )
                          }}
                          className="mr-2"
                        />
                        <div className="text-sm">
                          <div className="font-medium">Table {table.table_number}</div>
                          <div className="text-xs text-muted-foreground">
                            {table.capacity} seats • {table.table_type}
                          </div>
                        </div>
                      </label>
                    )
                  })}
                </div>
                
                {selectedTables.length > 0 && (
                  <div className="text-sm text-muted-foreground">
                    Selected capacity: {
                      allTables?.filter(t => selectedTables.includes(t.id))
                        .reduce((sum, t) => sum + t.capacity, 0) || 0
                    } seats
                  </div>
                )}
              </div>
            </div>
          )}
          
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setShowConvertDialog(false)
              setConvertingEntry(null)
              setSelectedTime('')
              setSelectedTables([])
            }}>
              Cancel
            </Button>
            <Button
              onClick={handleConvertToBooking}
              disabled={!selectedTime || selectedTables.length === 0 || isConverting}
            >
              {isConverting ? "Converting..." : "Convert to Booking"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Notify confirmation dialog */}
      <Dialog open={showNotifyDialog} onOpenChange={setShowNotifyDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Bell className="h-4 w-4 text-blue-600" />
              Notify Customer
            </DialogTitle>
            <DialogDescription>
              Send notification that a table is available
            </DialogDescription>
          </DialogHeader>
          {notifyingEntry && (
            <div className="space-y-3 py-3">
              <div className="p-3 bg-muted rounded-lg">
                <p className="font-medium text-sm">
                  {notifyingEntry.user?.full_name || notifyingEntry.guest_name}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Party of {notifyingEntry.party_size} • {notifyingEntry.desired_time_range}
                </p>
              </div>
              <Alert className="border-blue-200 bg-blue-50">
                <Info className="h-4 w-4 text-blue-600" />
                <AlertDescription className="text-xs">
                  Customer will have 15 minutes to respond before the notification expires.
                </AlertDescription>
              </Alert>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNotifyDialog(false)}>
              Cancel
            </Button>
            <Button onClick={confirmNotification} className="bg-blue-600 hover:bg-blue-700">
              Send Notification
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}