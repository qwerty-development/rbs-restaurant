// components/bookings/manual-booking-form.tsx
"use client"

import { useState, useEffect, useRef } from "react"
import { createPortal } from "react-dom"
import { useForm, SubmitHandler } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { format, addMinutes, differenceInMinutes } from "date-fns"
import { createClient } from "@/lib/supabase/client"
import { useQuery } from "@tanstack/react-query"
import { TableAvailabilityService } from "@/lib/table-availability"
import { RestaurantAvailability } from "@/lib/restaurant-availability"
import { useSharedTableAvailability } from "@/hooks/use-shared-tables"
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
import { MinimumCapacityWarningDialog } from "./minimum-capacity-warning-dialog"
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
  UserCheck,
  Info
} from "lucide-react"
import { toast } from "react-hot-toast"
import { BookingTermsCheckbox } from "@/components/ui/terms-checkbox"

// Updated form schema with proper null handling and shared tables
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
  acceptTerms: z.boolean().default(true), // Staff-created bookings default to accepted
  is_shared_booking: z.boolean().default(false),
})

type FormData = z.input<typeof formSchema>

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
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0, width: 0 })
  const [mounted, setMounted] = useState(false)
  const [selectedSharedTable, setSelectedSharedTable] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const supabase = createClient()
  const tableService = new TableAvailabilityService()
  const availabilityService = new RestaurantAvailability()

  // Add/Use customer prompt state
  const [showAddCustomerPrompt, setShowAddCustomerPrompt] = useState(false)
  const [pendingProcessedData, setPendingProcessedData] = useState<any | null>(null)
  const [pendingGuestDetails, setPendingGuestDetails] = useState<{ name?: string | null; email?: string | null; phone?: string | null } | null>(null)
  const [isAddingCustomer, setIsAddingCustomer] = useState(false)

  // Minimum capacity warning dialog state
  const [showMinimumCapacityWarning, setShowMinimumCapacityWarning] = useState(false)
  const [pendingSubmission, setPendingSubmission] = useState<{
    data: any
    violatingTables: any[]
  } | null>(null)

  // Debounce customer search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedCustomerSearch(customerSearch)
    }, 300) // 300ms delay

    return () => clearTimeout(timer)
  }, [customerSearch])

  // Calculate dropdown position when showing
  useEffect(() => {
    setMounted(true)
    if (showCustomerDropdown && inputRef.current) {
      const updatePosition = () => {
        if (inputRef.current) {
          const rect = inputRef.current.getBoundingClientRect()
          const newPosition = {
            top: rect.bottom + window.scrollY + 8,
            left: rect.left + window.scrollX,
            width: rect.width
          }
          console.log('Dropdown position:', newPosition, 'Input rect:', rect)
          setDropdownPosition(newPosition)
        }
      }
      updatePosition()
      // Update position on next frame to ensure DOM is ready
      requestAnimationFrame(updatePosition)
    }
  }, [showCustomerDropdown])

  // Update position on scroll/resize
  useEffect(() => {
    if (!showCustomerDropdown || !inputRef.current) return

    const updatePosition = () => {
      if (inputRef.current) {
        const rect = inputRef.current.getBoundingClientRect()
        setDropdownPosition({
          top: rect.bottom + window.scrollY + 8,
          left: rect.left + window.scrollX,
          width: rect.width
        })
      }
    }

    const throttledUpdate = () => {
      requestAnimationFrame(updatePosition)
    }

    window.addEventListener('scroll', throttledUpdate, true)
    window.addEventListener('resize', throttledUpdate)
    
    return () => {
      window.removeEventListener('scroll', throttledUpdate, true)
      window.removeEventListener('resize', throttledUpdate)
    }
  }, [showCustomerDropdown])

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
      acceptTerms: true, // Default to true for staff-created bookings
      is_shared_booking: false,
    },
  })

  const bookingDate = watch("booking_date")
  const bookingTime = watch("booking_time")
  const partySize = watch("party_size")
  const turnTime = watch("turn_time_minutes")
  const isSharedBooking = watch("is_shared_booking")

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

  // Fetch all tables including shared tables
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

  // Filter tables by type
  const regularTables = allTables?.filter(table => table.table_type !== 'shared') || []
  const sharedTables = allTables?.filter(table => table.table_type === 'shared') || []

  // Check available shared tables for the booking time
  const getSharedTableAvailability = async (tableId: string) => {
    if (!bookingDate || !bookingTime) return null
    
    try {
      const { data } = await supabase.rpc('get_shared_table_availability', {
        p_table_id: tableId,
        p_booking_time: `${bookingDate.toISOString().split('T')[0]}T${bookingTime}:00`
      })
      return data
    } catch (error) {
      console.error('Error checking shared table availability:', error)
      return null
    }
  }

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
    
    // Refocus the input to keep it active
    if (inputRef.current) {
      inputRef.current.focus()
    }
  }

  const handleClearCustomer = () => {
    setSelectedCustomer(null)
    setCustomerSearch("")
    setValue("customer_id", "")
    setValue("guest_name", "")
    setValue("guest_email", "")
    setValue("guest_phone", "")
  }

  // Fixed handleFormSubmit function with proper null handling and shared tables
  const handleFormSubmit: SubmitHandler<FormData> = async (data: FormData): Promise<void> => {
    // Validate table selection for regular bookings or shared table selection
    if (data.is_shared_booking) {
      if (!selectedSharedTable) {
        toast.error("Please select a shared table")
        return
      }
      
      // Use party_size for shared table validation
      if (!data.party_size || data.party_size <= 0) {
        toast.error("Please specify party size")
        return
      }

      // Check if enough seats are available
      const availabilityCheck = await getSharedTableAvailability(selectedSharedTable)
      if (availabilityCheck && data.party_size > availabilityCheck.available_seats) {
        toast.error(`Only ${availabilityCheck.available_seats} seats available at this table`)
        return
      }
    } else {
      if (selectedTables.length === 0) {
        toast.error("Please select at least one table")
        return
      }
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
      // Check if this is a minimum capacity violation (party size too small)
      const violatingTables = selectedTableObjects.filter(table => 
        (table.min_capacity || 1) > data.party_size
      )
      
      if (violatingTables.length > 0) {
        // Show warning dialog for minimum capacity override
        setPendingSubmission({
          data,
          violatingTables
        })
        setShowMinimumCapacityWarning(true)
        return
      }
      
      // For other capacity issues (party size too large), show error
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
        : (data.guest_phone?.trim() || null),
      guest_email: selectedCustomer 
        ? (selectedCustomer.guest_email || null)
        : (data.guest_email?.trim() || null),
      booking_time: bookingDateTime.toISOString(),
      table_ids: data.is_shared_booking ? [selectedSharedTable] : selectedTables,
      is_shared_booking: data.is_shared_booking || false,
    }

    // If no selected customer but meaningful guest info is provided, prompt to add/use existing
    const cleanGuestName = data.guest_name?.trim()
    const cleanGuestEmail = data.guest_email?.trim()
    const cleanGuestPhone = data.guest_phone?.trim()
    const hasGuestInfo = !!(cleanGuestName || cleanGuestEmail || cleanGuestPhone)
    
    if (!selectedCustomer && hasGuestInfo) {
      setPendingProcessedData(processedData)
      setPendingGuestDetails({
        name: cleanGuestName || null,
        email: cleanGuestEmail || null,
        phone: cleanGuestPhone || null,
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
    const name = pendingGuestDetails?.name?.trim() || pendingProcessedData.guest_name?.trim() || null
    const email = pendingGuestDetails?.email?.trim() || pendingProcessedData.guest_email?.trim() || null
    const phone = pendingGuestDetails?.phone?.trim() || pendingProcessedData.guest_phone?.trim() || null

    // FIXED: Ensure we have at least one meaningful identifier
    // Empty strings should be converted to null to avoid unique constraint violations
    const cleanName = name && name.length > 0 ? name : null
    const cleanEmail = email && email.length > 0 ? email : null
    const cleanPhone = phone && phone.length > 0 ? phone : null

    if (!cleanName && !cleanEmail && !cleanPhone) {
      toast.error("Provide at least a name, email, or phone to add a customer")
      return
    }

    // Allow customer creation with just a name - contact information is optional

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

      if (cleanEmail && cleanPhone) {
        existingQuery = existingQuery.eq("guest_email", cleanEmail).eq("guest_phone", cleanPhone)
      } else if (cleanEmail) {
        existingQuery = existingQuery.eq("guest_email", cleanEmail).is("guest_phone", null)
      } else if (cleanPhone) {
        existingQuery = existingQuery.eq("guest_phone", cleanPhone).is("guest_email", null)
      } else if (cleanName) {
        // For name-only customers, check for exact name match with no contact info
        existingQuery = existingQuery.eq("guest_name", cleanName).is("guest_email", null).is("guest_phone", null)
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
          guest_name: cleanName,
          guest_email: cleanEmail,
          guest_phone: cleanPhone,
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
          let dupQuery = supabase
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

          if (cleanEmail && cleanPhone) {
            dupQuery = dupQuery.eq("guest_email", cleanEmail).eq("guest_phone", cleanPhone)
          } else if (cleanEmail) {
            dupQuery = dupQuery.eq("guest_email", cleanEmail).is("guest_phone", null)
          } else if (cleanPhone) {
            dupQuery = dupQuery.eq("guest_phone", cleanPhone).is("guest_email", null)
          }

          const { data: dupExisting } = await dupQuery.single()

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

  // Helper functions for minimum capacity override
  const confirmMinimumCapacityOverride = () => {
    if (!pendingSubmission) return

    // Proceed with the booking submission despite the violation
    const [hours, minutes] = pendingSubmission.data.booking_time.split(":")
    const bookingDateTime = new Date(pendingSubmission.data.booking_date)
    bookingDateTime.setHours(parseInt(hours), parseInt(minutes))

    // FIXED: Convert empty strings to null to avoid unique constraint violations
    const processedData = {
      ...pendingSubmission.data,
      customer_id: selectedCustomer?.id || null,
      user_id: selectedCustomer?.user_id || null,
      guest_name: selectedCustomer 
        ? (selectedCustomer.profile?.full_name || selectedCustomer.guest_name)
        : (pendingSubmission.data.guest_name?.trim() || `Anonymous Guest ${format(new Date(), 'HH:mm')}`),
      guest_phone: selectedCustomer 
        ? (selectedCustomer.profile?.phone_number || selectedCustomer.guest_phone)
        : (pendingSubmission.data.guest_phone?.trim() || null),
      guest_email: selectedCustomer 
        ? (selectedCustomer.profile?.email || selectedCustomer.guest_email)
        : (pendingSubmission.data.guest_email?.trim() || null),
      special_requests: pendingSubmission.data.special_requests?.trim() || null,
      occasion: pendingSubmission.data.occasion?.trim() || null,
      table_ids: selectedTables,
      shared_table_id: selectedSharedTable,
      booking_time: bookingDateTime.toISOString(),
      restaurant_id: restaurantId
    }

    // Check if we need to add the customer to the restaurant's customer list
    if (!selectedCustomer && !pendingSubmission.data.is_shared_booking) {
      const name = pendingSubmission.data.guest_name?.trim()
      const email = pendingSubmission.data.guest_email?.trim()
      const phone = pendingSubmission.data.guest_phone?.trim()

      if (name || email || phone) {
        setPendingProcessedData(processedData)
        setPendingGuestDetails({ name, email, phone })
        setShowAddCustomerPrompt(true)
        setShowMinimumCapacityWarning(false)
        setPendingSubmission(null)
        return
      }
    }

    setShowMinimumCapacityWarning(false)
    setPendingSubmission(null)
    onSubmit(processedData)
  }

  const cancelMinimumCapacityOverride = () => {
    setPendingSubmission(null)
    setShowMinimumCapacityWarning(false)
  }

  return (
    <div className="manual-booking-form relative max-w-full overflow-x-hidden bg-gradient-to-br from-slate-50 to-slate-100/50 dark:from-slate-900 dark:to-slate-800/50 min-h-full">
      <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6 max-w-full overflow-x-hidden pb-24">
        {/* Customer Search */}
        <div className="space-y-4 rounded-xl border border-slate-200/60 dark:border-slate-700/60 p-6 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm shadow-sm dark:shadow-slate-900/20 relative z-[100] overflow-visible">
          <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <Search className="h-5 w-5 text-slate-600 dark:text-slate-400" />
            Customer Selection (Optional)
          </h3>
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Search for an existing customer or leave blank to create a new booking
          </p>
          
          <div className="relative z-[1000]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                ref={inputRef}
                placeholder="Search customers by name, email, or phone (min 2 characters)..."
                value={customerSearch}
                onChange={(e) => {
                  setCustomerSearch(e.target.value)
                  setShowCustomerDropdown(e.target.value.length >= 2)
                }}
                onFocus={() => setShowCustomerDropdown(customerSearch.length >= 2)}
                onBlur={() => {
                  // Delay hiding to allow click events to process
                  setTimeout(() => setShowCustomerDropdown(false), 200)
                }}
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

        {/* Shared Table Booking Toggle */}
        <div className="space-y-4 rounded-xl border border-slate-200/60 dark:border-slate-700/60 p-6 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm shadow-sm dark:shadow-slate-900/20">
          <div className="flex items-center space-x-3">
            <Checkbox
              id="is_shared_booking"
              checked={isSharedBooking}
              onCheckedChange={(checked) => {
                setValue("is_shared_booking", checked as boolean)
                if (!checked) {
                  setSelectedSharedTable(null)
                }
              }}
              disabled={isLoading}
            />
            <div>
              <Label htmlFor="is_shared_booking" className="text-base font-medium cursor-pointer">
                Shared Table Booking
              </Label>
              <p className="text-sm text-slate-600 dark:text-slate-300">
                Book individual seats at a communal table
              </p>
            </div>
          </div>

          {isSharedBooking && (
            <div className="mt-4 space-y-4 border-t pt-4">
              <div>
                <Label htmlFor="shared_table">Shared Table *</Label>
                <Select
                  value={selectedSharedTable || ""}
                  onValueChange={(value) => {
                    setSelectedSharedTable(value)
                  }}
                  disabled={isLoading}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a shared table" />
                  </SelectTrigger>
                  <SelectContent>
                    {sharedTables.map((table) => (
                      <SelectItem key={table.id} value={table.id}>
                        Table {table.table_number} (Capacity: {table.capacity})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-sm text-slate-600 dark:text-slate-300 mt-2">
                  Your party of {partySize} will be seated at this shared table
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Table Assignment */}
        <div className="space-y-4 rounded-xl border border-slate-200/60 dark:border-slate-700/60 p-6 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm shadow-sm dark:shadow-slate-900/20">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                <Table2 className="h-5 w-5 text-slate-600 dark:text-slate-400" />
                {isSharedBooking ? "Shared Table Selection" : "Table Assignment"}
              </h3>
              <p className="text-sm text-slate-600 dark:text-slate-300">
                {isSharedBooking 
                  ? `Shared table selected for ${partySize} guests`
                  : `Select tables for ${partySize} guests (Selected capacity: ${selectedTablesCapacity})`
                }
              </p>
            </div>
            {!isSharedBooking && (
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
            )}
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
          
          {/* Debug Information */}


          {!isSharedBooking ? (
            // Regular table selection
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {(() => {
                // Sort tables: available first, then occupied
                const sortedTables = [...(regularTables || [])].sort((a, b) => {
                  const aOccupied = bookingDate && bookingTime ? (() => {
                    const [hours, minutes] = bookingTime.split(":")
                    const bookingDateTime = new Date(bookingDate)
                    bookingDateTime.setHours(parseInt(hours), parseInt(minutes))
                    const bookingEndTime = addMinutes(bookingDateTime, turnTime || 120)

                    return currentBookings.some(booking => {
                      const hasTable = booking.tables?.some((t: any) => t.id === a.id)
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

                      return (
                        bookingDateTime < existingBookingEndTime && 
                        bookingEndTime > existingBookingTime
                      )
                    })
                  })() : false

                  const bOccupied = bookingDate && bookingTime ? (() => {
                    const [hours, minutes] = bookingTime.split(":")
                    const bookingDateTime = new Date(bookingDate)
                    bookingDateTime.setHours(parseInt(hours), parseInt(minutes))
                    const bookingEndTime = addMinutes(bookingDateTime, turnTime || 120)

                    return currentBookings.some(booking => {
                      const hasTable = booking.tables?.some((t: any) => t.id === b.id)
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

                      return (
                        bookingDateTime < existingBookingEndTime && 
                        bookingEndTime > existingBookingTime
                      )
                    })
                  })() : false

                  // Available tables first, then occupied
                  if (aOccupied && !bOccupied) return 1
                  if (!aOccupied && bOccupied) return -1
                  return 0
                })

                return sortedTables.map((table) => {
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
                    <div
                      key={table.id}
                      onClick={() => {
                        if (!isAvailable && !isSelected) {
                          toast.error("This table is not available for the selected time")
                          return
                        }
                        handleTableToggle(table.id)
                      }}
                      className={cn(
                        "relative p-4 border rounded-xl cursor-pointer transition-all duration-200 w-full h-32 flex flex-col justify-between",
                        isSelected && "bg-green-50 dark:bg-green-900/30 border-green-300 dark:border-green-700 shadow-sm ring-2 ring-green-200 dark:ring-green-800",
                        !isSelected && isAvailable && "hover:bg-slate-50 dark:hover:bg-slate-700 border-slate-200 dark:border-slate-700",
                        !isAvailable && !isSelected && "opacity-50 cursor-not-allowed bg-slate-50 dark:bg-slate-800",
                        isOccupiedDuringBookingTime && "bg-red-50 dark:bg-red-900/30 border-red-300 dark:border-red-700 ring-1 ring-red-200 dark:ring-red-800"
                      )}
                    >
                      {/* Header with table number and info icon */}
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-2 min-w-0 flex-1">
                          <div className="flex flex-col items-center gap-2 flex-shrink-0">
                            <div className="w-5 h-5 bg-slate-100 dark:bg-slate-700 rounded flex items-center justify-center">
                              <Table2 className="h-3 w-3 text-slate-600 dark:text-slate-400" />
                            </div>
                            <Users className="h-3 w-3 text-slate-600 dark:text-slate-400" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="font-semibold text-slate-800 dark:text-slate-100 truncate">T{table.table_number}</div>
                            <div className="text-slate-600 dark:text-slate-300 text-xs mt-1">
                              {table.capacity}
                            </div>
                          </div>
                        </div>
                        {table.features && table.features.length > 0 && (
                          <Popover>
                            <PopoverTrigger asChild>
                              <button
                                type="button"
                                className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded transition-colors mt-0.5"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <Info className="h-3 w-3 text-slate-500 dark:text-slate-400" />
                              </button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-3" side="top">
                              <div className="space-y-2">
                                <div className="text-sm font-medium text-slate-800 dark:text-slate-100">Table Features</div>
                                <div className="flex flex-wrap gap-1">
                                  {table.features.map((feature: string, idx: number) => (
                                    <Badge key={idx} variant="outline" className="text-xs px-2 py-1 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-600">
                                      {feature}
                                    </Badge>
                                  ))}
                                </div>
                              </div>
                            </PopoverContent>
                          </Popover>
                        )}
                      </div>

                      {/* Table type */}
                      <div className="text-xs text-slate-500 dark:text-slate-400 capitalize truncate">
                        {table.table_type}
                      </div>

                      {/* Conflict info */}
                      {isOccupiedDuringBookingTime && conflictingBooking && (
                        <div className="absolute bottom-1 left-1 right-1 text-xs text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-900/20 px-2 py-1 rounded border border-red-200 dark:border-red-800">
                          <div className="truncate">
                            <span className="font-medium">Booked by:</span> {(conflictingBooking.user?.full_name || conflictingBooking.guest_name || 'Guest').substring(0, 15)}
                            {(conflictingBooking.user?.full_name || conflictingBooking.guest_name || '').length > 15 && '...'}
                          </div>
                          <div className="truncate">
                            <span className="font-medium">Time:</span> {format(new Date(conflictingBooking.booking_time), "h:mm a")}
                          </div>
                        </div>
                      )}
                      {availabilityInfo && !availabilityInfo.isAvailable && !isOccupiedDuringBookingTime && (
                        <div className="absolute bottom-1 left-1 right-1 text-xs text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-900/20 px-2 py-1 rounded border border-red-200 dark:border-red-800">
                          Not available at this time
                        </div>
                      )}
                    </div>
                  )
                })
              })()}
            </div>
          ) : (
            // Shared table selection
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {sharedTables?.map((table) => {
                const isSelected = selectedSharedTable === table.id
                
                return (
                  <div
                    key={table.id}
                    onClick={() => {
                      setSelectedSharedTable(table.id)
                      setValue("table_ids", [table.id])
                      setValue("is_shared_booking", true)
                    }}
                    className={cn(
                      "relative p-4 border rounded-xl cursor-pointer transition-all duration-200 w-full h-32 flex flex-col justify-between",
                      isSelected && "bg-green-50 dark:bg-green-900/30 border-green-300 dark:border-green-700 shadow-sm ring-2 ring-green-200 dark:ring-green-800",
                      !isSelected && "hover:bg-slate-50 dark:hover:bg-slate-700 border-slate-200 dark:border-slate-700"
                    )}
                  >
                    {/* Header with table number and capacity */}
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-2 min-w-0 flex-1">
                        <div className="flex flex-col items-center gap-2 flex-shrink-0">
                          <div className="w-5 h-5 bg-slate-100 dark:bg-slate-700 rounded flex items-center justify-center">
                            <Table2 className="h-3 w-3 text-slate-600 dark:text-slate-400" />
                          </div>
                          <Users className="h-3 w-3 text-slate-600 dark:text-slate-400" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="font-semibold text-slate-800 dark:text-slate-100 truncate">T{table.table_number}</div>
                          <div className="text-slate-600 dark:text-slate-300 text-xs mt-1">
                            {table.capacity}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Shared badge and max party info */}
                    <div className="flex items-center justify-between">
                      <Badge variant="secondary" className="text-xs px-1 py-0.5 bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-300 border-blue-300 dark:border-blue-700">
                        Shared
                      </Badge>
                      {table.max_party_size_per_booking && (
                        <div className="text-xs text-slate-500 dark:text-slate-400">
                          Max {table.max_party_size_per_booking} per booking
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* Show suggested combinations if no single table works */}
          {!isSharedBooking && availableTablesData?.combinations && 
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

        {/* Terms and Conditions */}
        <div className="space-y-4 rounded-xl border border-slate-200/60 dark:border-slate-700/60 p-6 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm shadow-sm dark:shadow-slate-900/20">
          <BookingTermsCheckbox
            checked={watch("acceptTerms") || false}
            onCheckedChange={(checked) => setValue("acceptTerms", checked)}
            disabled={isLoading}
          />
          {errors.acceptTerms && (
            <p className="text-sm text-red-500 mt-1">{errors.acceptTerms.message}</p>
          )}
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
              (isSharedBooking ? !selectedSharedTable : selectedTables.length === 0) ||
              (availability && !availability.available) ||
              (!isSharedBooking && selectedTablesCapacity > 0 && selectedTablesCapacity < partySize) ||
              // Check if any selected tables will conflict with the booking time (only for regular tables)
              (!!bookingDate && !!bookingTime && !isSharedBooking && selectedTables.some(tableId => {
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
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
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
      
      {/* BRUTE FORCE DROPDOWN - PORTAL TO BODY */}
      {mounted && showCustomerDropdown && customerSearch.length >= 2 && createPortal(
        <div 
          className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xl dark:shadow-slate-900/50 max-h-60 overflow-y-auto backdrop-blur-sm"
          style={{
            position: 'fixed',
            top: dropdownPosition.top,
            left: dropdownPosition.left,
            width: Math.max(dropdownPosition.width, 400),
            zIndex: 2147483647,
            transform: 'translateZ(0)',
            willChange: 'transform',
            pointerEvents: 'auto'
          }}
          onMouseDown={(e) => e.preventDefault()}
          onClick={(e) => e.stopPropagation()}
        >
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
                  onMouseDown={(e) => {
                    e.preventDefault() // Prevent input blur
                    e.stopPropagation()
                  }}
                  onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    handleCustomerSelect(customer)
                  }}
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
        </div>,
        document.body
      )}

      {/* Minimum Capacity Warning Dialog */}
      <MinimumCapacityWarningDialog
        open={showMinimumCapacityWarning}
        onOpenChange={setShowMinimumCapacityWarning}
        onConfirm={confirmMinimumCapacityOverride}
        onCancel={cancelMinimumCapacityOverride}
        partySize={pendingSubmission?.data?.party_size || 0}
        violatingTables={pendingSubmission?.violatingTables || []}
        guestName={selectedCustomer?.profile?.full_name || selectedCustomer?.guest_name || pendingSubmission?.data?.guest_name}
        isLoading={isLoading}
      />
    </div>
  )
}