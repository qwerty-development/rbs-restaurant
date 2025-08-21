// components/bookings/manual-booking-form.tsx
"use client"

import { useState, useEffect } from "react"
import { useForm, SubmitHandler } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { format, addMinutes, differenceInMinutes } from "date-fns"
import { createClient } from "@/lib/supabase/client"
import { useQuery } from "@tanstack/react-query"
import { TableAvailabilityService } from "@/lib/table-availability"
import { RestaurantAvailability } from "@/lib/restaurant-availability"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { 
  CalendarIcon, 
  Clock, 
  AlertCircle, 
  Table2,
  RefreshCw,
  Users,
  Search,
  X,
  Star,
  UserCheck
} from "lucide-react"
import { toast } from "react-hot-toast"

// Updated form schema with proper null handling
const formSchema = z.object({
  customer_id: z.string().optional(),
  guest_name: z.string().optional(),
  guest_email: z.string().optional(),
  guest_phone: z.string().optional(),
  booking_date: z.date(),
  booking_time: z.string(),
  party_size: z.number().min(1).max(20),
  turn_time_minutes: z.number().min(30).max(240),
  special_requests: z.string().optional(),
  occasion: z.string().optional(),
  table_ids: z.array(z.string()).optional(),
  status: z.enum(["pending", "confirmed", "completed"]),
})

type FormData = z.infer<typeof formSchema>

interface ManualBookingFormProps {
  restaurantId: string
  onSubmit: (data: any) => void
  onCancel: () => void
  isLoading: boolean
  currentBookings?: any[] // Add current bookings to check occupancy
  prefillData?: {
    guest_name?: string
    guest_email?: string
    guest_phone?: string
    booking_date?: Date
    booking_time?: string
    party_size?: number
    user?: any
  }
}

export function ManualBookingForm({
  restaurantId,
  onSubmit,
  onCancel,
  isLoading,
  currentBookings = [],
  prefillData
}: ManualBookingFormProps) {
  const [selectedTables, setSelectedTables] = useState<string[]>([])
  const [checkingAvailability, setCheckingAvailability] = useState(false)
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null)
  const [customerSearch, setCustomerSearch] = useState("")
  const [debouncedCustomerSearch, setDebouncedCustomerSearch] = useState("")
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false)
  const supabase = createClient()
  const tableService = new TableAvailabilityService()
  const availabilityService = new RestaurantAvailability()

  // Add/Use customer prompt state
  const [showAddCustomerPrompt, setShowAddCustomerPrompt] = useState(false)
  const [pendingProcessedData, setPendingProcessedData] = useState<any | null>(null)
  const [pendingGuestDetails, setPendingGuestDetails] = useState<{ name?: string | null; email?: string | null; phone?: string | null } | null>(null)
  const [isAddingCustomer, setIsAddingCustomer] = useState(false)

  // Debounce customer search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedCustomerSearch(customerSearch)
    }, 300) // 300ms delay

    return () => clearTimeout(timer)
  }, [customerSearch])

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
  } = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      guest_name: prefillData?.guest_name || "",
      guest_email: prefillData?.guest_email || "",
      guest_phone: prefillData?.guest_phone || "",
      party_size: prefillData?.party_size || 2,
      turn_time_minutes: 120,
      status: "confirmed",
      booking_date: prefillData?.booking_date || new Date(),
      booking_time: prefillData?.booking_time || format(new Date(), "HH:mm"),
    },
  })

  const bookingDate = watch("booking_date")
  const bookingTime = watch("booking_time")
  const partySize = watch("party_size")
  const turnTime = watch("turn_time_minutes")

  // Set prefilled customer if provided
  useEffect(() => {
    if (prefillData?.user) {
      setSelectedCustomer({
        user_id: prefillData.user.id,
        guest_name: prefillData.user.full_name,
        guest_phone: prefillData.user.phone_number,
        guest_email: prefillData.user.email || "",
        profile: prefillData.user
      })
      setCustomerSearch(prefillData.user.full_name || "")
    }
  }, [prefillData])

  // Fetch all tables
  const { data: allTables } = useQuery({
    queryKey: ["restaurant-tables", restaurantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("restaurant_tables")
        .select("*")
        .eq("restaurant_id", restaurantId)
        .eq("is_active", true)
        .order("table_number")

      if (error) throw error
      return data
    },
  })

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

  // Check restaurant availability when date/time changes
  const { data: restaurantAvailability } = useQuery({
    queryKey: [
      "restaurant-availability",
      restaurantId,
      bookingDate,
      bookingTime
    ],
    queryFn: async () => {
      if (!bookingDate || !bookingTime || !restaurantId) return null

      // Validate date
      if (isNaN(bookingDate.getTime())) {
        console.warn("Invalid booking date provided")
        return null
      }

      const [hours, minutes] = bookingTime.split(":")
      const bookingDateTime = new Date(bookingDate)
      bookingDateTime.setHours(parseInt(hours), parseInt(minutes))

      // Validate the constructed datetime
      if (isNaN(bookingDateTime.getTime())) {
        console.warn("Invalid booking datetime constructed")
        return null
      }

      return await availabilityService.isRestaurantOpen(
        restaurantId,
        bookingDateTime,
        bookingTime
      )
    },
    enabled: !!bookingDate && !!bookingTime && !!restaurantId,
  })

  // Check availability when date/time/tables change
  const { data: availability, refetch: checkAvailability } = useQuery({
    queryKey: [
      "manual-booking-availability",
      bookingDate,
      bookingTime,
      selectedTables,
      turnTime
    ],
    queryFn: async () => {
      if (!bookingDate || !bookingTime || selectedTables.length === 0 || !restaurantId) return null

      // Validate date
      if (isNaN(bookingDate.getTime())) {
        console.warn("Invalid booking date for availability check")
        return null
      }

      const [hours, minutes] = bookingTime.split(":")
      const bookingDateTime = new Date(bookingDate)
      bookingDateTime.setHours(parseInt(hours), parseInt(minutes))

      // Validate the constructed datetime
      if (isNaN(bookingDateTime.getTime())) {
        console.warn("Invalid booking datetime for availability check")
        return null
      }

      return await tableService.checkTableAvailability(
        restaurantId,
        selectedTables,
        bookingDateTime,
        turnTime
      )
    },
    enabled: selectedTables.length > 0 && !!bookingDate && !!bookingTime && !!restaurantId,
  })

  // Auto-suggest optimal tables
  const suggestTables = async () => {
    if (!bookingDate || !bookingTime || !restaurantId) {
      toast.error("Please select date and time first")
      return
    }

    // Validate date
    if (isNaN(bookingDate.getTime())) {
      toast.error("Invalid date selected")
      return
    }

    setCheckingAvailability(true)
    try {
      const [hours, minutes] = bookingTime.split(":")
      const bookingDateTime = new Date(bookingDate)
      bookingDateTime.setHours(parseInt(hours), parseInt(minutes))

      // Validate the constructed datetime
      if (isNaN(bookingDateTime.getTime())) {
        toast.error("Invalid time selected")
        return
      }

      const optimal = await tableService.getOptimalTableAssignment(
        restaurantId,
        bookingDateTime,
        partySize,
        turnTime
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

  // Get available tables for the time slot
  const { data: availableTablesData } = useQuery({
    queryKey: [
      "available-tables-slot",
      bookingDate,
      bookingTime,
      partySize,
      turnTime
    ],
    queryFn: async () => {
      if (!bookingDate || !bookingTime || !restaurantId) return null

      // Validate date
      if (isNaN(bookingDate.getTime())) {
        console.warn("Invalid booking date for available tables")
        return null
      }

      const [hours, minutes] = bookingTime.split(":")
      const bookingDateTime = new Date(bookingDate)
      bookingDateTime.setHours(parseInt(hours), parseInt(minutes))

      // Validate the constructed datetime
      if (isNaN(bookingDateTime.getTime())) {
        console.warn("Invalid booking datetime for available tables")
        return null
      }

      return await tableService.getAvailableTablesForSlot(
        restaurantId,
        bookingDateTime,
        partySize,
        turnTime
      )
    },
    enabled: !!bookingDate && !!bookingTime && !!restaurantId,
  })

  // Handle customer selection
  const handleCustomerSelect = (customer: any) => {
    setSelectedCustomer(customer)
    setCustomerSearch(customer.profile?.full_name || customer.guest_name || "")
    setShowCustomerDropdown(false)
    
    // Auto-fill form fields if guest customer
    if (!customer.user_id) {
      setValue("guest_name", customer.guest_name || "")
      setValue("guest_email", customer.guest_email || "")
      setValue("guest_phone", customer.guest_phone || "")
    } else {
      // Clear guest fields for registered customers
      setValue("guest_name", "")
      setValue("guest_email", "")
      setValue("guest_phone", "")
    }
    
    setValue("customer_id", customer.id)
  }

  const handleClearCustomer = () => {
    setSelectedCustomer(null)
    setCustomerSearch("")
    setValue("customer_id", "")
    setValue("guest_name", "")
    setValue("guest_email", "")
    setValue("guest_phone", "")
  }

  // Fixed handleFormSubmit function with proper null handling
  const handleFormSubmit: SubmitHandler<FormData> = (data: FormData): void => {
    // Validate table selection
    if (selectedTables.length === 0) {
      toast.error("Please select at least one table")
      return
    }

    // Check if any selected tables will be occupied during the booking time
    const [submitHours, submitMinutes] = data.booking_time.split(":")
    const submitBookingDateTime = new Date(data.booking_date)
    submitBookingDateTime.setHours(parseInt(submitHours), parseInt(submitMinutes))
    const submitBookingEndTime = addMinutes(submitBookingDateTime, data.turn_time_minutes || 120)

    const conflictingTables = selectedTables.filter(tableId => {
      return currentBookings.some(booking => {
        const hasTable = booking.tables?.some((t: any) => t.id === tableId)
        if (!hasTable) return false

        const existingBookingTime = new Date(booking.booking_time)
        const existingBookingEndTime = addMinutes(existingBookingTime, booking.turn_time_minutes || 120)

        const conflictingStatuses = [
          'confirmed', 'arrived', 'seated', 'ordered', 'appetizers', 
          'main_course', 'dessert', 'payment'
        ]
        
        if (!conflictingStatuses.includes(booking.status)) {
          return false
        }

        // Check for time overlap
        return (
          submitBookingDateTime < existingBookingEndTime && 
          submitBookingEndTime > existingBookingTime
        )
      })
    })

    if (conflictingTables.length > 0) {
      const tableNumbers = conflictingTables
        .map(tableId => {
          const table = allTables?.find(t => t.id === tableId)
          return table ? `T${table.table_number}` : tableId
        })
        .join(", ")
      toast.error(`Cannot book table(s) that have conflicts: ${tableNumbers}. Please select different tables or time.`)
      return
    }

    // Check if there are conflicts from availability service
    if (availability && !availability.available) {
      toast.error("Selected tables have conflicts. Please choose different tables or time.")
      return
    }

    // Validate capacity
    const selectedTableObjects = allTables?.filter(t => selectedTables.includes(t.id)) || []
    const capacityCheck = tableService.validateCapacity(selectedTableObjects, data.party_size)
    
    if (!capacityCheck.valid) {
      toast.error(capacityCheck.message || "Invalid table selection")
      return
    }

    const [hours, minutes] = data.booking_time.split(":")
    const bookingDateTime = new Date(data.booking_date)
    bookingDateTime.setHours(parseInt(hours), parseInt(minutes))

    // FIXED: Convert empty strings to null to avoid unique constraint violations
    const processedData = {
      ...data,
      customer_id: selectedCustomer?.id || null,
      user_id: selectedCustomer?.user_id || null,
      guest_name: selectedCustomer 
        ? (selectedCustomer.profile?.full_name || selectedCustomer.guest_name)
        : (data.guest_name?.trim() || `Anonymous Guest ${format(new Date(), 'HH:mm')}`),
      guest_phone: selectedCustomer 
        ? (selectedCustomer.profile?.phone_number || selectedCustomer.guest_phone)
        : (data.guest_phone ? data.guest_phone.trim() : null),
      guest_email: selectedCustomer?.guest_email || (data.guest_email ? data.guest_email.trim() : null),
      booking_time: bookingDateTime.toISOString(),
      table_ids: selectedTables,
    }

    // If no selected customer but guest info is provided, prompt to add/use existing
    const hasGuestInfo = !!(data.guest_name?.trim() || data.guest_email?.trim() || data.guest_phone?.trim())
    if (!selectedCustomer && hasGuestInfo) {
      setPendingProcessedData(processedData)
      setPendingGuestDetails({
        name: data.guest_name?.trim() || null,
        email: data.guest_email?.trim() || null,
        phone: data.guest_phone?.trim() || null,
      })
      setShowAddCustomerPrompt(true)
      return
    }

    onSubmit(processedData)
  }

  // Find similar existing customers when prompt is open
  const { data: similarCustomers, isLoading: similarLoading, error: similarError } = useQuery({
    queryKey: [
      "similar-restaurant-customers",
      restaurantId,
      showAddCustomerPrompt,
      pendingGuestDetails?.email || "",
      pendingGuestDetails?.phone || "",
      pendingGuestDetails?.name || "",
    ],
    queryFn: async () => {
      if (!showAddCustomerPrompt || !restaurantId) return []

      const orFilters: string[] = []
      if (pendingGuestDetails?.email) {
        const email = pendingGuestDetails.email.replace(/'/g, "''")
        orFilters.push(`guest_email.ilike.%${email}%`)
      }
      if (pendingGuestDetails?.phone) {
        const digits = (pendingGuestDetails.phone || '').replace(/\D/g, '')
        if (digits) {
          orFilters.push(`guest_phone.ilike.%${digits}%`)
        } else {
          const phone = pendingGuestDetails.phone.replace(/'/g, "''")
          orFilters.push(`guest_phone.ilike.%${phone}%`)
        }
      }
      if (pendingGuestDetails?.name) {
        const name = pendingGuestDetails.name.replace(/'/g, "''")
        orFilters.push(`guest_name.ilike.%${name}%`)
      }

      if (orFilters.length === 0) return []

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
        .or(orFilters.join(","))
        .limit(5)
        .order("last_visit", { ascending: false })

      if (error) throw error
      return data || []
    },
    enabled: !!restaurantId && showAddCustomerPrompt,
  })

  const finalizeBookingWithCustomer = (customer: any) => {
    if (!pendingProcessedData) return
    const updated = {
      ...pendingProcessedData,
      customer_id: customer?.id || null,
      user_id: customer?.user_id || null,
      guest_name: customer?.profile?.full_name || customer?.guest_name || pendingProcessedData.guest_name,
      guest_phone: customer?.profile?.phone_number || customer?.guest_phone || pendingProcessedData.guest_phone,
      guest_email: customer?.guest_email || pendingProcessedData.guest_email,
    }
    setShowAddCustomerPrompt(false)
    setPendingProcessedData(null)
    setPendingGuestDetails(null)
    onSubmit(updated)
  }

  const handleSkipAddingCustomer = () => {
    if (!pendingProcessedData) return
    setShowAddCustomerPrompt(false)
    const toSubmit = { ...pendingProcessedData }
    setPendingProcessedData(null)
    setPendingGuestDetails(null)
    onSubmit(toSubmit)
  }

  const handleAddNewCustomer = async () => {
    if (!pendingProcessedData || !restaurantId) return
    const name = pendingGuestDetails?.name || pendingProcessedData.guest_name || null
    const email = pendingGuestDetails?.email || pendingProcessedData.guest_email || null
    const phone = pendingGuestDetails?.phone || pendingProcessedData.guest_phone || null

    if (!name && !email && !phone) {
      toast.error("Provide at least a name, email, or phone to add a customer")
      return
    }

    setIsAddingCustomer(true)
    try {
      // First: try to find existing exact match to avoid duplicates
      let existingQuery = supabase
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
        .limit(1)

      if (email && phone) {
        existingQuery = existingQuery.eq("guest_email", email).eq("guest_phone", phone)
      } else if (email) {
        existingQuery = existingQuery.eq("guest_email", email)
      } else if (phone) {
        existingQuery = existingQuery.eq("guest_phone", phone)
      }

      const { data: existing } = await existingQuery.single()
      if (existing) {
        toast.success("Using existing customer record")
        finalizeBookingWithCustomer(existing)
        return
      }

      // Insert new customer; if a race creates it, handle unique violation gracefully
      const { data, error } = await supabase
        .from("restaurant_customers")
        .insert({
          restaurant_id: restaurantId,
          guest_name: name,
          guest_email: email,
          guest_phone: phone,
          first_visit: new Date().toISOString(),
          last_visit: new Date().toISOString(),
        })
        .select(`
          *,
          profile:profiles!restaurant_customers_user_id_fkey(
            id,
            full_name,
            phone_number,
            avatar_url
          )
        `)
        .single()

      if (error) {
        // If duplicate, fetch existing and use it
        // @ts-ignore Supabase error shape
        if (error?.code === '23505') {
          const { data: dupExisting } = await supabase
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
            .eq("guest_email", email)
            .eq("guest_phone", phone)
            .single()

          if (dupExisting) {
            toast.success("Customer already exists. Using existing record.")
            finalizeBookingWithCustomer(dupExisting)
            return
          }
        }
        throw error
      }

      toast.success("Customer added to restaurant")
      finalizeBookingWithCustomer(data)
    } catch (err) {
      console.error("Error adding restaurant customer:", err)
      toast.error("Failed to add customer")
    } finally {
      setIsAddingCustomer(false)
    }
  }

  const handleTableToggle = (tableId: string) => {
    setSelectedTables(prev => {
      if (prev.includes(tableId)) {
        // Always allow deselecting
        return prev.filter(id => id !== tableId)
      } else {
        // Check if table is available for the selected booking time
        const isAvailable = getTableAvailability(tableId)
        if (!isAvailable) {
          const table = allTables?.find(t => t.id === tableId)
          toast.error(`Table ${table ? `T${table.table_number}` : tableId} is not available for the selected time`)
          return prev
        }
        return [...prev, tableId]
      }
    })
  }

  // Calculate total capacity
  const selectedTablesCapacity = allTables
    ?.filter(t => selectedTables.includes(t.id))
    .reduce((sum, t) => sum + t.capacity, 0) || 0

  // Determine which tables are available
  const getTableAvailability = (tableId: string) => {
    // If no booking date/time selected yet, allow all tables
    if (!bookingDate || !bookingTime) return true

    // Create the booking datetime
    const [hours, minutes] = bookingTime.split(":")
    const bookingDateTime = new Date(bookingDate)
    bookingDateTime.setHours(parseInt(hours), parseInt(minutes))
    const bookingEndTime = addMinutes(bookingDateTime, turnTime || 120)

    // Check if table will be occupied during the selected booking time
    const isOccupiedDuringBookingTime = currentBookings.some(booking => {
      // Check if this booking has this table assigned
      const hasTable = booking.tables?.some((t: any) => t.id === tableId)
      if (!hasTable) return false

      // Get the existing booking's time window
      const existingBookingTime = new Date(booking.booking_time)
      const existingBookingEndTime = addMinutes(existingBookingTime, booking.turn_time_minutes || 120)

      // Check if booking is in an active status that would conflict
      const conflictingStatuses = [
        'confirmed', 'arrived', 'seated', 'ordered', 'appetizers', 
        'main_course', 'dessert', 'payment'
      ]
      
      if (!conflictingStatuses.includes(booking.status)) {
        return false
      }

      // Check for time overlap between new booking and existing booking
      return (
        bookingDateTime < existingBookingEndTime && 
        bookingEndTime > existingBookingTime
      )
    })

    if (isOccupiedDuringBookingTime) {
      return false
    }

    // Then check against the availability data for the selected time slot
    if (!availableTablesData) return true
    
    const isInSingleTables = availableTablesData.singleTables.some(t => t.id === tableId)
    const isInCombinations = availableTablesData.combinations.some(c => 
      c.tables.includes(tableId)
    )
    
    return isInSingleTables || isInCombinations
  }

  return (
    <div className="manual-booking-form relative max-w-full overflow-x-hidden bg-gradient-to-br from-slate-50 to-slate-100/50 dark:from-slate-900 dark:to-slate-800/50 min-h-full">
      <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6 max-w-full overflow-x-hidden pb-24">
        {/* Customer Search */}
        <div className="space-y-4 rounded-xl border border-slate-200/60 dark:border-slate-700/60 p-6 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm shadow-sm dark:shadow-slate-900/20">
          <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <Search className="h-5 w-5 text-slate-600 dark:text-slate-400" />
            Customer Selection (Optional)
          </h3>
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Search for an existing customer or leave blank to create a new booking
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
                disabled={isLoading}
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
                        className="flex items-center gap-3 p-4 hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer border-b border-slate-100 dark:border-slate-700 last:border-b-0 transition-colors duration-150"
                        onClick={() => handleCustomerSelect(customer)}
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <p className="font-semibold text-slate-800 dark:text-slate-100 truncate">
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
            <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-200 dark:border-blue-800 shadow-sm">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <UserCheck className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  <span className="font-semibold text-slate-800 dark:text-slate-100">Selected Customer:</span>
                  <span className="text-slate-700 dark:text-slate-200">{selectedCustomer.profile?.full_name || selectedCustomer.guest_name}</span>
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
        <div className="space-y-4 rounded-xl border border-slate-200/60 dark:border-slate-700/60 p-6 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm shadow-sm dark:shadow-slate-900/20">
          <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <UserCheck className="h-5 w-5 text-slate-600 dark:text-slate-400" />
            {selectedCustomer ? 'Guest Information (Auto-filled)' : 'Guest Information (Optional)'}
          </h3>
        
          <div>
            <Label htmlFor="guest_name">Guest Name (Optional)</Label>
            <Input
              id="guest_name"
              placeholder={selectedCustomer ? "Auto-filled from selected customer" : "Enter guest name or leave blank for anonymous"}
              {...register("guest_name")}
              disabled={isLoading || !!selectedCustomer}
              value={selectedCustomer 
                ? (selectedCustomer.profile?.full_name || selectedCustomer.guest_name || "")
                : watch("guest_name") || ""
              }
            />
            {errors.guest_name && (
              <p className="text-sm text-red-600 mt-1">{errors.guest_name.message}</p>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="guest_phone">Phone Number (Optional)</Label>
              <Input
                id="guest_phone"
                type="tel"
                placeholder={selectedCustomer ? "Auto-filled from selected customer" : "Enter phone number"}
                {...register("guest_phone")}
                disabled={isLoading || !!selectedCustomer}
                value={selectedCustomer 
                  ? (selectedCustomer.profile?.phone_number || selectedCustomer.guest_phone || "")
                  : watch("guest_phone") || ""
                }
              />
              {errors.guest_phone && (
                <p className="text-sm text-red-600 mt-1">{errors.guest_phone.message}</p>
              )}
            </div>

            <div>
              <Label htmlFor="guest_email">Email (Optional)</Label>
              <Input
                id="guest_email"
                type="email"
                placeholder={selectedCustomer ? "Auto-filled from selected customer" : "Enter email address"}
                {...register("guest_email")}
                disabled={isLoading || !!selectedCustomer}
                value={selectedCustomer 
                  ? (selectedCustomer.guest_email || "")
                  : watch("guest_email") || ""
                }
              />
              {errors.guest_email && (
                <p className="text-sm text-red-600 mt-1">{errors.guest_email.message}</p>
              )}
            </div>
          </div>
        </div>

        {/* Booking Details */}
        <div className="space-y-4 rounded-xl border border-slate-200/60 dark:border-slate-700/60 p-6 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm shadow-sm dark:shadow-slate-900/20">
          <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <CalendarIcon className="h-5 w-5 text-slate-600 dark:text-slate-400" />
            Booking Details
          </h3>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label>Date *</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant={"outline"}
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !bookingDate && "text-muted-foreground"
                    )}
                    disabled={isLoading}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {bookingDate ? format(bookingDate, "PPP") : <span>Pick a date</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 max-w-[95vw] sm:max-w-none">
                  <Calendar
                    mode="single"
                    selected={bookingDate}
                    onSelect={(date) => date && setValue("booking_date", date)}
                    disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div>
              <Label htmlFor="booking_time">Time *</Label>
              <div className="relative">
                <Clock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="booking_time"
                  type="time"
                  {...register("booking_time")}
                  className="pl-10"
                  disabled={isLoading}
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="party_size">Party Size *</Label>
              <div className="relative">
                <Users className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="party_size"
                  type="number"
                  min="1"
                  max="20"
                  {...register("party_size", { valueAsNumber: true })}
                  className="pl-10"
                  disabled={isLoading}
                />
              </div>
            </div>

            <div>
              <Label htmlFor="turn_time_minutes">Turn Time</Label>
              <Select
                value={turnTime.toString()}
                onValueChange={(value) => setValue("turn_time_minutes", parseInt(value))}
                disabled={isLoading}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="60">1 hour</SelectItem>
                  <SelectItem value="90">1.5 hours</SelectItem>
                  <SelectItem value="120">2 hours</SelectItem>
                  <SelectItem value="150">2.5 hours</SelectItem>
                  <SelectItem value="180">3 hours</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="status">Status</Label>
              <Select
                value={watch("status")}
                onValueChange={(value: any) => setValue("status", value)}
                disabled={isLoading}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="confirmed">Confirmed</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Table Assignment */}
        <div className="space-y-4 rounded-xl border border-slate-200/60 dark:border-slate-700/60 p-6 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm shadow-sm dark:shadow-slate-900/20">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                <Table2 className="h-5 w-5 text-slate-600 dark:text-slate-400" />
                Table Assignment
              </h3>
              <p className="text-sm text-slate-600 dark:text-slate-300">
                Select tables for {partySize} guests
                (Selected capacity: {selectedTablesCapacity})
              </p>
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={suggestTables}
              disabled={checkingAvailability || isLoading}
              className="bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 shadow-sm"
            >
              <RefreshCw className={`h-4 w-4 mr-1 ${checkingAvailability ? 'animate-spin' : ''}`} />
              Auto-suggest
            </Button>
          </div>

          {/* Show occupied tables warning */}
          {(() => {
            if (!bookingDate || !bookingTime) return null

            const [hours, minutes] = bookingTime.split(":")
            const bookingDateTime = new Date(bookingDate)
            bookingDateTime.setHours(parseInt(hours), parseInt(minutes))
            const bookingEndTime = addMinutes(bookingDateTime, turnTime || 120)

            const conflictingCount = allTables?.filter(table => {
              return currentBookings.some(booking => {
                const hasTable = booking.tables?.some((t: any) => t.id === table.id)
                if (!hasTable) return false

                const existingBookingTime = new Date(booking.booking_time)
                const existingBookingEndTime = addMinutes(existingBookingTime, booking.turn_time_minutes || 120)

                const conflictingStatuses = [
                  'confirmed', 'arrived', 'seated', 'ordered', 'appetizers', 
                  'main_course', 'dessert', 'payment'
                ]
                
                if (!conflictingStatuses.includes(booking.status)) {
                  return false
                }

                // Check for time overlap
                return (
                  bookingDateTime < existingBookingEndTime && 
                  bookingEndTime > existingBookingTime
                )
              })
            }).length || 0

            return conflictingCount > 0 ? (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  {conflictingCount} table(s) have conflicts with the selected time slot. 
                  Conflicting tables are marked with a red background.
                </AlertDescription>
              </Alert>
            ) : null
          })()}

          {/* Restaurant availability warning */}
          {restaurantAvailability && !restaurantAvailability.isOpen && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <strong>Restaurant is closed</strong> at the selected date and time.
                {restaurantAvailability.reason && (
                  <div className="mt-1">Reason: {restaurantAvailability.reason}</div>
                )}
                {restaurantAvailability.hours && (
                  <div className="mt-1">
                    Regular hours: {restaurantAvailability.hours.open} - {restaurantAvailability.hours.close}
                  </div>
                )}
              </AlertDescription>
            </Alert>
          )}

          {/* Show conflicts if any */}
          {availability && !availability.available && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Selected tables have conflicts at this time:
                <ul className="mt-2 text-sm">
                  {availability.conflicts.map((conflict: any) => (
                    <li key={conflict.id}>
                      • {conflict.guestName} - {format(new Date(conflict.booking_time), "h:mm a")}
                      ({conflict.party_size} guests)
                    </li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          )}

          {/* Capacity warning */}
          {selectedTablesCapacity > 0 && selectedTablesCapacity < partySize && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Selected tables only have capacity for {selectedTablesCapacity} guests, 
                but you need seating for {partySize} guests.
              </AlertDescription>
            </Alert>
          )}
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {allTables?.map((table) => {
              const isSelected = selectedTables.includes(table.id)
              const isAvailable = getTableAvailability(table.id)
              const availabilityInfo = availability?.tables.find(t => t.tableId === table.id)
              
              // Check if table will be occupied during the selected booking time
              let isOccupiedDuringBookingTime = false
              let conflictingBooking = null
              
              if (bookingDate && bookingTime) {
                const [hours, minutes] = bookingTime.split(":")
                const bookingDateTime = new Date(bookingDate)
                bookingDateTime.setHours(parseInt(hours), parseInt(minutes))
                const bookingEndTime = addMinutes(bookingDateTime, turnTime || 120)

                const conflict = currentBookings.find(booking => {
                  const hasTable = booking.tables?.some((t: any) => t.id === table.id)
                  if (!hasTable) return false

                  const existingBookingTime = new Date(booking.booking_time)
                  const existingBookingEndTime = addMinutes(existingBookingTime, booking.turn_time_minutes || 120)

                  const conflictingStatuses = [
                    'confirmed', 'arrived', 'seated', 'ordered', 'appetizers', 
                    'main_course', 'dessert', 'payment'
                  ]
                  
                  if (!conflictingStatuses.includes(booking.status)) {
                    return false
                  }

                  // Check for time overlap
                  return (
                    bookingDateTime < existingBookingEndTime && 
                    bookingEndTime > existingBookingTime
                  )
                })

                if (conflict) {
                  isOccupiedDuringBookingTime = true
                  conflictingBooking = conflict
                }
              }

              return (
                <label
                  key={table.id}
                  className={cn(
                    "flex items-center p-4 border rounded-xl cursor-pointer transition-all duration-200 w-full min-w-0 hover:shadow-md",
                    isSelected && "bg-blue-50 dark:bg-blue-900/30 border-blue-300 dark:border-blue-700 shadow-sm ring-1 ring-blue-200 dark:ring-blue-800",
                    !isSelected && isAvailable && "hover:bg-slate-50 dark:hover:bg-slate-700 border-slate-200 dark:border-slate-700",
                    !isAvailable && !isSelected && "opacity-50 cursor-not-allowed bg-slate-50 dark:bg-slate-800",
                    isOccupiedDuringBookingTime && "bg-red-50 dark:bg-red-900/30 border-red-300 dark:border-red-700 ring-1 ring-red-200 dark:ring-red-800"
                  )}
                >
                  <Checkbox
                    checked={isSelected}
                    onCheckedChange={() => {
                      if (!isAvailable && !isSelected) {
                        toast.error("This table is not available for the selected time")
                        return
                      }
                      handleTableToggle(table.id)
                    }}
                    disabled={isLoading || (!isAvailable && !isSelected)}
                    className="mr-3 flex-shrink-0"
                  />
                  <div className="flex-1 min-w-0 overflow-hidden">
                    <div className="flex items-center gap-2 mb-1">
                      <Table2 className="h-4 w-4 text-slate-600 dark:text-slate-400 flex-shrink-0" />
                      <span className="font-semibold text-slate-800 dark:text-slate-100">T{table.table_number}</span>
                      {isOccupiedDuringBookingTime && (
                        <Badge variant="destructive" className="text-xs px-2 py-0.5 flex-shrink-0 bg-red-100 dark:bg-red-900/40 text-red-800 dark:text-red-300 border-red-300 dark:border-red-700">Booked</Badge>
                      )}
                    </div>
                    <p className="text-sm text-slate-600 dark:text-slate-300 mb-2 truncate">
                      <Users className="h-3 w-3 inline mr-1" />
                      {table.capacity} seats • {table.table_type}
                    </p>
                    {table.features && table.features.length > 0 && (
                      <div className="flex flex-wrap gap-1 mb-2 max-w-full">
                        {table.features.slice(0, 2).map((feature: string, idx: number) => (
                          <Badge key={idx} variant="outline" className="text-xs px-2 py-0.5 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-600 truncate max-w-[80px]">
                            {feature}
                          </Badge>
                        ))}
                        {table.features.length > 2 && (
                          <Badge variant="outline" className="text-xs px-2 py-0.5 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-600">
                            +{table.features.length - 2}
                          </Badge>
                        )}
                      </div>
                    )}
                    {isOccupiedDuringBookingTime && conflictingBooking && (
                      <p className="text-xs text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-900/20 px-2 py-1 rounded border border-red-200 dark:border-red-800 truncate">
                        <span className="font-medium">Booked by:</span> {(conflictingBooking.user?.full_name || conflictingBooking.guest_name || 'Guest').substring(0, 20)}
                        {(conflictingBooking.user?.full_name || conflictingBooking.guest_name || '').length > 20 && '...'}
                        <br />
                        <span className="font-medium">Time:</span> {format(new Date(conflictingBooking.booking_time), "h:mm a")}
                      </p>
                    )}
                    {availabilityInfo && !availabilityInfo.isAvailable && !isOccupiedDuringBookingTime && (
                      <p className="text-xs text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-900/20 px-2 py-1 rounded border border-red-200 dark:border-red-800">
                        Not available at this time
                      </p>
                    )}
                  </div>
                </label>
              )
            })}
          </div>

          {/* Show suggested combinations if no single table works */}
          {availableTablesData?.combinations && 
           availableTablesData.combinations.length > 0 &&
           availableTablesData.singleTables.length === 0 && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                No single table available for {partySize} guests. 
                Consider combining tables using auto-suggest.
              </AlertDescription>
            </Alert>
          )}
        </div>

        {/* Additional Information */}
        <div className="space-y-4 rounded-xl border border-slate-200/60 dark:border-slate-700/60 p-6 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm shadow-sm dark:shadow-slate-900/20">
          <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-slate-600 dark:text-slate-400" />
            Additional Information
          </h3>
          
          <div>
            <Label htmlFor="occasion">Occasion</Label>
            <Input
              id="occasion"
              placeholder="Birthday, Anniversary, etc."
              {...register("occasion")}
              disabled={isLoading}
            />
          </div>

          <div>
            <Label htmlFor="special_requests">Special Requests</Label>
            <Textarea
              id="special_requests"
              placeholder="Any special requirements or requests..."
              {...register("special_requests")}
              disabled={isLoading}
            />
          </div>
        </div>

        {/* Actions */}
        <div className="sticky bottom-0 bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm border-t border-slate-200/60 dark:border-slate-700/60 pt-4 pb-4 flex justify-end gap-3 shadow-lg dark:shadow-slate-900/40">
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={isLoading}
            className="bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 shadow-sm px-6"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={
              isLoading ||
              selectedTables.length === 0 ||
              (availability && !availability.available) ||
              (selectedTablesCapacity > 0 && selectedTablesCapacity < partySize) ||
              // Check if any selected tables will conflict with the booking time
              (!!bookingDate && !!bookingTime && selectedTables.some(tableId => {
                const [hours, minutes] = bookingTime.split(":")
                const bookingDateTime = new Date(bookingDate)
                bookingDateTime.setHours(parseInt(hours), parseInt(minutes))
                const bookingEndTime = addMinutes(bookingDateTime, turnTime || 120)

                return currentBookings.some(booking => {
                  const hasTable = booking.tables?.some((t: any) => t.id === tableId)
                  if (!hasTable) return false

                  const existingBookingTime = new Date(booking.booking_time)
                  const existingBookingEndTime = addMinutes(existingBookingTime, booking.turn_time_minutes || 120)

                  const conflictingStatuses = [
                    'confirmed', 'arrived', 'seated', 'ordered', 'appetizers',
                    'main_course', 'dessert', 'payment'
                  ]

                  if (!conflictingStatuses.includes(booking.status)) {
                    return false
                  }

                  // Check for time overlap
                  return (
                    bookingDateTime < existingBookingEndTime &&
                    bookingEndTime > existingBookingTime
                  )
                })
              }))
            }
            className="bg-blue-600 hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-800 text-white shadow-md px-8 font-semibold"
          >
            {isLoading ? "Creating..." : "Create Booking"}
          </Button>
        </div>
      </form>
      {/* Add/Use customer prompt */}
      <Dialog
        open={showAddCustomerPrompt}
        onOpenChange={(open) => {
          if (!open) {
            // Treat closing the dialog as skipping adding a customer
            handleSkipAddingCustomer()
          } else {
            setShowAddCustomerPrompt(true)
          }
        }}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Add guest to restaurant customers?</DialogTitle>
            <DialogDescription>
              This booking has guest info. You can save them as a customer for future use, or select an existing similar customer.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-4">
              <p className="text-sm text-slate-600 dark:text-slate-300 mb-2 font-medium">Guest details</p>
              <div className="text-sm text-slate-700 dark:text-slate-200">
                <div><span className="text-slate-500 dark:text-slate-400">Name:</span> {pendingGuestDetails?.name || "—"}</div>
                <div><span className="text-slate-500 dark:text-slate-400">Email:</span> {pendingGuestDetails?.email || "—"}</div>
                <div><span className="text-slate-500 dark:text-slate-400">Phone:</span> {pendingGuestDetails?.phone || "—"}</div>
              </div>
            </div>

            <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-4">
              <p className="text-sm text-slate-600 dark:text-slate-300 mb-3 font-medium">Similar existing customers</p>
              {similarLoading && (
                <p className="text-sm text-slate-500">Searching…</p>
              )}
              {similarError && (
                <p className="text-sm text-red-600">Failed to search similar customers</p>
              )}
              {!similarLoading && !similarError && (similarCustomers?.length || 0) === 0 && (
                <p className="text-sm text-slate-500">No similar customers found</p>
              )}
              {!similarLoading && !similarError && (similarCustomers?.length || 0) > 0 && (
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {similarCustomers?.map((c: any) => (
                    <div key={c.id} className="flex items-center justify-between gap-4 p-3 rounded-md border border-slate-200 dark:border-slate-700">
                      <div className="min-w-0">
                        <div className="font-medium text-slate-800 dark:text-slate-100 truncate">
                          {c.profile?.full_name || c.guest_name || "Guest"}
                        </div>
                        <div className="text-sm text-slate-600 dark:text-slate-300 truncate">
                          {(c.guest_email || c.profile?.email) && <span>{c.guest_email || c.profile?.email}</span>}
                          {(c.guest_email || c.profile?.email) && (c.profile?.phone_number || c.guest_phone) && <span> • </span>}
                          {(c.profile?.phone_number || c.guest_phone) && <span>{c.profile?.phone_number || c.guest_phone}</span>}
                        </div>
                      </div>
                      <Button type="button" size="sm" onClick={() => finalizeBookingWithCustomer(c)}>
                        Use this
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          <DialogFooter className="sm:justify-between">
            <div className="text-sm text-slate-600 dark:text-slate-300">You can also skip and only create the booking.</div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={handleSkipAddingCustomer} disabled={isAddingCustomer || isLoading}>
                Skip
              </Button>
              <Button type="button" onClick={handleAddNewCustomer} disabled={isAddingCustomer || isLoading}>
                {isAddingCustomer ? "Adding…" : "Add as new customer"}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}