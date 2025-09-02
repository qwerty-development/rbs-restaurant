// components/dashboard/checkin-queue.tsx
"use client"

import React, { useState, useEffect, useMemo, useCallback } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import { format, differenceInMinutes, addMinutes } from "date-fns"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import { useTableCombinations } from "@/lib/hooks/use-table-combinations"
import {
  UserCheck,
  Clock,
  Table2,
  AlertCircle,
  Timer,
  UserPlus,
  Crown,
  ArrowLeftRight,
  CheckCircle,
  AlertTriangle,
  GitMerge,
  Unlock,
  ChefHat,
  Utensils,
  Coffee,
  CreditCard,
  Play,
  Activity,
  TrendingUp,
  Users,
  Info
} from "lucide-react"
import { toast } from "react-hot-toast"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { TableStatusService, type DiningStatus } from "@/lib/table-status"
import { BookingConflictService } from "@/lib/services/booking-conflict-service"
import { useSharedTablesSummary } from "@/hooks/use-shared-tables"

const TABLE_TYPE_COLORS: Record<string, string> = {
  booth: "bg-gradient-to-br from-primary/80 to-primary text-primary-foreground border-primary/70",
  window: "bg-gradient-to-br from-accent/80 to-accent text-accent-foreground border-accent/70",
  patio: "bg-gradient-to-br from-secondary/80 to-secondary text-secondary-foreground border-secondary/70",
  standard: "bg-gradient-to-br from-muted to-muted/80 text-muted-foreground border-border",
  bar: "bg-gradient-to-br from-primary/60 to-primary/80 text-primary-foreground border-primary/50",
  private: "bg-gradient-to-br from-accent/60 to-accent/80 text-accent-foreground border-accent/50",
}

// Enhanced interfaces
interface TableSwapOption {
  type: 'empty' | 'swap' | 'future-swap' | 'combination'
  tables: any[]
  targetBooking?: any
  combinationId?: string
  isPredefined?: boolean
  warnings: string[]
  benefits: string[]
  confidence: number // 0-100 confidence score
}

interface SmartSuggestion {
  id: string
  type: 'table' | 'time' | 'combination' | 'swap'
  title: string
  description: string
  icon: any
  priority: 'high' | 'medium' | 'low'
  action: () => void
}

interface CheckInQueueProps {
  bookings: any[]
  tables: any[]
  currentTime: Date
  restaurantId: string
  onCheckIn: (bookingId: string, tableIds: string[]) => void
  onQuickSeat: (guestData: any, tableIds: string[]) => void
  onTableSwitch?: (bookingId: string, newTableIds: string[], swapBookingId?: string) => void
  onStatusUpdate?: (bookingId: string, newStatus: DiningStatus) => void
  customersData?: Record<string, any>
  onSelectBooking?: (booking: any) => void
}

export function CheckInQueue({
  bookings,
  tables,
  currentTime,
  restaurantId,
  onCheckIn,
  onQuickSeat,
  onTableSwitch,
  onStatusUpdate,
  customersData = {},
  onSelectBooking
}: CheckInQueueProps) {
  // Enhanced state management
  const [selectedTableIds, setSelectedTableIds] = useState<string[]>([])
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null)
  const [customerSearch, setCustomerSearch] = useState("")
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false)
  const [walkInData, setWalkInData] = useState<{
    guestName: string
    guestPhone: string
    partySize: number | string
    estimatedDuration: number
    preferences: string[]
  }>({
    guestName: "",
    guestPhone: "",
    partySize: 2,
    estimatedDuration: 120,
    preferences: []
  })

  // Confirmation dialogs state
  const [walkInConfirmation, setWalkInConfirmation] = useState<{
    show: boolean
    type: 'upcoming_reservations' | 'multi_table' | null
    conflictingReservations: any[]
    selectedTables: any[]
    walkInData: any
  }>({
    show: false,
    type: null,
    conflictingReservations: [],
    selectedTables: [],
    walkInData: null
  })
  
  // Enhanced table switch modal with swap options
  const [tableSwitchModal, setTableSwitchModal] = useState<{
    show: boolean
    booking?: any
    originalTables: any[]
    selectedNewTableIds: string[]
    swapOptions: TableSwapOption[]
    selectedOption?: TableSwapOption
    confirmationStep: boolean
  }>({ 
    show: false, 
    originalTables: [], 
    selectedNewTableIds: [],
    swapOptions: [],
    confirmationStep: false
  })

  // Shared tables state
  const [selectedSharedTableId, setSelectedSharedTableId] = useState<string>("")
  const [sharedTableSeatsRequested, setSharedTableSeatsRequested] = useState<number>(2)
  const [isSharedBookingMode, setIsSharedBookingMode] = useState(false)

  // Advanced settings
  const [advancedMode, setAdvancedMode] = useState(false)
  const [autoSuggestEnabled, setAutoSuggestEnabled] = useState(true)
  const [showDetailedInfo, setShowDetailedInfo] = useState(false)

  const supabase = createClient()
  const queryClient = useQueryClient()
  const tableStatusService = useMemo(() => new TableStatusService(), [])
  const conflictService = useMemo(() => new BookingConflictService(), [])

  // Fetch restaurant sections for table organization
  const { data: restaurantSections = [] } = useQuery({
    queryKey: ["restaurant-sections", restaurantId],
    queryFn: async () => {
      if (!restaurantId) return []
      
      const { data, error } = await supabase
        .from("restaurant_sections")
        .select("*")
        .eq("restaurant_id", restaurantId)
        .eq("is_active", true)
        .order("display_order", { ascending: true })

      if (error) throw error
      return data
    },
    enabled: !!restaurantId,
  })

  // Add/Use customer prompt state for walk-ins
  const [showAddCustomerPrompt, setShowAddCustomerPrompt] = useState(false)
  const [pendingWalkInBooking, setPendingWalkInBooking] = useState<any | null>(null)
  const [pendingGuestDetails, setPendingGuestDetails] = useState<{ name?: string | null; email?: string | null; phone?: string | null } | null>(null)
  const [isAddingCustomer, setIsAddingCustomer] = useState(false)

  // Get current user for status updates
  const [userId, setUserId] = useState<string>("")
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setUserId(user.id)
    })
  }, [supabase])

  // Fetch table combinations with enhanced filtering
  const { data: tableCombinations = [], isLoading: combinationsLoading } = useTableCombinations(restaurantId)

  // Fetch shared tables data
  const { data: sharedTablesSummary = [] } = useSharedTablesSummary(restaurantId, currentTime)

  // Enhanced customer search with caching
  const { data: customers, error: customersError, isLoading: customersLoading } = useQuery({
    queryKey: ["restaurant-customers-walkin", restaurantId, customerSearch],
    queryFn: async () => {
      if (!customerSearch.trim() || customerSearch.length < 1) return []
      if (!restaurantId) throw new Error("Restaurant ID is required")
      
      const { data, error } = await supabase
        .from("restaurant_customers")
        .select(`
          *,
          profile:profiles!restaurant_customers_user_id_fkey(
            id,
            full_name,
            phone_number,
            avatar_url,
            allergies,
            favorite_cuisines
          )
        `)
        .eq("restaurant_id", restaurantId)
        .or(`guest_name.ilike.%${customerSearch}%,guest_email.ilike.%${customerSearch}%,guest_phone.ilike.%${customerSearch}%`)
        .limit(10)
        .order("vip_status", { ascending: false })
        .order("total_bookings", { ascending: false })

      if (error) throw error
      return data || []
    },
    enabled: customerSearch.length >= 1 && !!restaurantId,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  })

  // Enhanced table swap options calculator with perfect logic
  const calculateSwapOptions = useCallback((booking: any, targetTableIds: string[]): TableSwapOption[] => {
    const options: TableSwapOption[] = []
    const targetTables = targetTableIds.map(id => tables.find(t => t.id === id)).filter(Boolean)
    const currentTables = booking.tables || []
    
    if (targetTables.length === 0) return options
    
    // Helper function to get all bookings at specific tables
    const getBookingsAtTables = (tableIds: string[]) => {
      return bookings.filter(b => {
        if (b.id === booking.id) return false
        return b.tables?.some((t: any) => tableIds.includes(t.id))
      })
    }
    
    // Helper function to check if booking is physically present
    const isPhysicallyPresent = (b: any) => {
      const presentStatuses = ['arrived', 'seated', 'ordered', 'payment']
      return presentStatuses.includes(b.status)
    }
    
    // Helper function to check if booking is future confirmed
    const isFutureConfirmed = (b: any) => {
      return b.status === 'confirmed' && new Date(b.booking_time) > currentTime
    }
    
    // Get all bookings at target tables
    const targetBookings = getBookingsAtTables(targetTableIds)
    const physicallyPresentBookings = targetBookings.filter(isPhysicallyPresent)
    const futureBookings = targetBookings.filter(isFutureConfirmed)
    
    // Option 1: Direct move to empty tables
    if (targetBookings.length === 0) {
      options.push({
        type: 'empty',
        tables: targetTables,
        warnings: [],
        benefits: ['Tables are completely free', 'No conflicts or disruptions'],
        confidence: 100
      })
    }
    
    // Option 2: Move to tables with only future bookings (bump future bookings)
    else if (physicallyPresentBookings.length === 0 && futureBookings.length > 0) {
      const warnings = futureBookings.map(b => 
        `Will bump ${b.user?.full_name || b.guest_name} (${format(new Date(b.booking_time), 'h:mm a')})`
      )
      
      options.push({
        type: 'empty',
        tables: targetTables,
        targetBooking: futureBookings[0], // For reference
        warnings,
        benefits: ['Tables available now', 'Future bookings will be reassigned'],
        confidence: 75
      })
    }
    
    // Option 3: Swap with single physically present booking
    else if (physicallyPresentBookings.length === 1) {
      const targetBooking = physicallyPresentBookings[0]
      
      // Check if our current tables can accommodate the target booking
      const currentTablesCapacity = currentTables.reduce((sum: number, t: any) => sum + (t.max_capacity || 0), 0)
      const canAccommodateTarget = currentTablesCapacity >= (targetBooking.party_size || 1)
      
      if (canAccommodateTarget && currentTables.length > 0) {
        // Check if current tables are free for the target booking
        const currentTableIds = currentTables.map((t: any) => t.id)
        const conflictingBookings = getBookingsAtTables(currentTableIds)
          .filter(b => b.id !== targetBooking.id)
        
        if (conflictingBookings.length === 0) {
          options.push({
            type: 'swap',
            tables: targetTables,
            targetBooking,
            warnings: [`Will swap tables with ${targetBooking.user?.full_name || targetBooking.guest_name}`],
            benefits: [
              'Clean table swap - both parties get suitable tables',
              'No one needs to wait or be bumped'
            ],
            confidence: 90
          })
        }
      }
      
      // Also offer option to bump the target booking if they're not seated yet
      if (!['seated', 'ordered', 'payment'].includes(targetBooking.status)) {
        options.push({
          type: 'empty',
          tables: targetTables,
          targetBooking,
          warnings: [`Will reassign ${targetBooking.user?.full_name || targetBooking.guest_name} to another table`],
          benefits: ['Get desired tables immediately', 'Other party will be accommodated elsewhere'],
          confidence: 60
        })
      }
    }
    
    // Option 4: Handle multiple bookings at target tables
    else if (physicallyPresentBookings.length > 1) {
      // This is complex - offer to bump all if none are actively dining
      const activeDiners = physicallyPresentBookings.filter(b => 
        ['ordered', 'payment'].includes(b.status)
      )
      
      if (activeDiners.length === 0) {
        options.push({
          type: 'empty',
          tables: targetTables,
          warnings: [
            `Will reassign ${physicallyPresentBookings.length} bookings to other tables`,
            'This may cause delays for affected parties'
          ],
          benefits: ['Get desired tables', 'All affected parties will be reseated'],
          confidence: 30
        })
      }
    }
    
    // Option 5: Predefined combinations for large parties
    if (booking.party_size > 4) {
      tableCombinations.forEach((combo: any) => {
        const primaryTable = tables.find(t => t.id === combo.primary_table_id)
        const secondaryTable = tables.find(t => t.id === combo.secondary_table_id)
        
        if (!primaryTable || !secondaryTable) return
        
        const comboTableIds = [combo.primary_table_id, combo.secondary_table_id]
        const comboBookings = getBookingsAtTables(comboTableIds)
        const comboPresentBookings = comboBookings.filter(isPhysicallyPresent)
        
        if (comboPresentBookings.length === 0 && combo.combined_capacity >= booking.party_size) {
          const comboFutureBookings = comboBookings.filter(isFutureConfirmed)
          
          options.push({
            type: 'combination',
            tables: [primaryTable, secondaryTable],
            combinationId: combo.id,
            isPredefined: true,
            warnings: comboFutureBookings.length > 0 
              ? [`Will bump ${comboFutureBookings.length} future booking(s)`]
              : [],
            benefits: [
              'Restaurant-approved combination',
              `Perfect for party of ${booking.party_size}`,
              'Optimized table layout'
            ],
            confidence: 95
          })
        }
      })
    }
    
    return options.sort((a, b) => b.confidence - a.confidence)
  }, [bookings, tables, tableCombinations, currentTime])

  // Generate smart suggestions
  const generateSmartSuggestions = useCallback((booking: any): SmartSuggestion[] => {
    const suggestions: SmartSuggestion[] = []
    
    // Check if tables are needed
    if (!booking.tables || booking.tables.length === 0) {
      // Find best available tables
      const availableTables = tables.filter(table => {
        if (!table.is_active) return false
        const isOccupied = bookings.some(b => {
          const occupiedStatuses = ['arrived', 'seated', 'ordered', 'payment']
          return occupiedStatuses.includes(b.status) && 
                 b.tables?.some((t: any) => t.id === table.id)
        })
        return !isOccupied && table.max_capacity >= booking.party_size
      })
      
      if (availableTables.length > 0) {
        const bestTable = availableTables.sort((a, b) => {
          const aDiff = Math.abs(a.max_capacity - booking.party_size)
          const bDiff = Math.abs(b.max_capacity - booking.party_size)
          return aDiff - bDiff
        })[0]
        
        suggestions.push({
          id: 'assign-best-table',
          type: 'table',
          title: `Assign Table ${bestTable.table_number}`,
          description: `Perfect fit for party of ${booking.party_size} (${bestTable.min_capacity}-${bestTable.max_capacity} seats)`,
          icon: Table2,
          priority: 'high',
          action: () => {
            setSelectedTableIds([bestTable.id])
            handleQuickCheckIn(booking)
          }
        })
      }
    }
    
    // Check for VIP status
    const customerData = booking.user?.id ? customersData[booking.user.id] : null
    if (customerData?.vip_status) {
      suggestions.push({
        id: 'vip-priority',
        type: 'table',
        title: 'VIP Priority Seating',
        description: 'Prioritize best available table for VIP guest',
        icon: Crown,
        priority: 'high',
        action: () => {
          // Find premium tables
          const premiumTables = tables.filter(t => 
            ['booth', 'window', 'private'].includes(t.table_type) && 
            t.is_active
          )
          if (premiumTables.length > 0) {
            handleOpenEnhancedTableSwitch(booking, premiumTables)
          }
        }
      })
    }
    
    return suggestions.sort((a, b) => {
      const priorityOrder = { high: 0, medium: 1, low: 2 }
      return priorityOrder[a.priority] - priorityOrder[b.priority]
    })
  }, [tables, bookings, customersData])

  // Handle status updates
  const handleStatusUpdate = useCallback(async (bookingId: string, newStatus: DiningStatus) => {
    if (!userId) return

    try {
      await tableStatusService.updateBookingStatus(bookingId, newStatus, userId)
      if (onStatusUpdate) {
        onStatusUpdate(bookingId, newStatus)
      }
      toast.success(`Status updated to ${newStatus.replace(/_/g, ' ')}`)
    } catch (error) {
      console.error('Status update error:', error)
      toast.error('Failed to update status')
    }
  }, [tableStatusService, userId, onStatusUpdate])

  // Helper function to determine shift based on time
  const getShift = (bookingTime: Date) => {
    const hour = bookingTime.getHours()
    if (hour >= 6 && hour < 11) return 'morning'
    if (hour >= 11 && hour < 16) return 'lunch'
    if (hour >= 16 && hour < 22) return 'dinner'
    return 'late_night'
  }

  // Filter and categorize bookings
  const categorizedBookings = useMemo(() => {
    // Show ALL confirmed arrivals, not just next hour
    const allArrivals = bookings.filter(booking => {
      return booking.status === 'confirmed'
    }).sort((a, b) => new Date(a.booking_time).getTime() - new Date(b.booking_time).getTime())

    // Group arrivals by shift
    const arrivalsByShift = allArrivals.reduce((acc, booking) => {
      const shift = getShift(new Date(booking.booking_time))
      if (!acc[shift]) acc[shift] = []
      acc[shift].push(booking)
      return acc
    }, {} as Record<string, any[]>)

    // Active dining guests
    const activeDining = bookings.filter(b =>
      ['seated', 'ordered', 'payment'].includes(b.status)
    ).sort((a, b) => {
      // Sort by status progression, then by booking time
      const statusOrder = { seated: 1, ordered: 2, payment: 3 }
      const aOrder = statusOrder[b.status as keyof typeof statusOrder] || 0
      const bOrder = statusOrder[b.status as keyof typeof statusOrder] || 0
      if (aOrder !== bOrder) return aOrder - bOrder
      return new Date(a.booking_time).getTime() - new Date(b.booking_time).getTime()
    })

    // Categorize arrivals by urgency (for backward compatibility)
    const minutesUntil = (booking: any) => differenceInMinutes(new Date(booking.booking_time), currentTime)

    return {
      activeDining,
      waitingForSeating: bookings.filter(b => b.status === 'arrived'),
      // New shift-based grouping
      arrivalsByShift,
      morningArrivals: arrivalsByShift.morning || [],
      lunchArrivals: arrivalsByShift.lunch || [],
      dinnerArrivals: arrivalsByShift.dinner || [],
      lateNightArrivals: arrivalsByShift.late_night || [],
      // Legacy urgency-based grouping (still used in some places)
      lateArrivals: allArrivals.filter(b => minutesUntil(b) < -15),
      currentArrivals: allArrivals.filter(b => {
        const minutes = minutesUntil(b)
        return minutes >= -15 && minutes <= 15
      }),
      upcomingArrivals: allArrivals.filter(b => minutesUntil(b) > 15),
      needingTables: bookings.filter(b =>
        b.status === 'confirmed' && (!b.tables || b.tables.length === 0)
      ),
      vipArrivals: allArrivals.filter(b => {
        const customerData = b.user?.id ? customersData[b.user.id] : null
        return customerData?.vip_status
      })
    }
  }, [bookings, currentTime, customersData])

  // Get available and occupied tables with detailed status
  const tableStatus = useMemo(() => {
    return tables.map(table => {
      const occupyingBooking = bookings.find(booking => {
        const occupiedStatuses = ['arrived', 'seated', 'ordered', 'appetizers', 'main_course', 'dessert', 'payment']
        return occupiedStatuses.includes(booking.status) && 
               booking.tables?.some((t: any) => t.id === table.id)
      })
      
      const upcomingBookings = bookings.filter(booking => {
        const bookingTime = new Date(booking.booking_time)
        const timeDiff = differenceInMinutes(bookingTime, currentTime)
        return booking.status === 'confirmed' && 
               timeDiff > 0 && timeDiff <= 120 &&
               booking.tables?.some((t: any) => t.id === table.id)
      }).sort((a, b) => new Date(a.booking_time).getTime() - new Date(b.booking_time).getTime())
      
      const nextAvailable = occupyingBooking 
        ? addMinutes(currentTime, occupyingBooking.turn_time_minutes || 120)
        : upcomingBookings.length > 0 
          ? new Date(upcomingBookings[0].booking_time)
          : null
      
      return {
        ...table,
        isOccupied: !!occupyingBooking,
        occupyingBooking,
        upcomingBookings,
        nextAvailable,
        availabilityScore: !occupyingBooking && upcomingBookings.length === 0 ? 100 :
                          !occupyingBooking && upcomingBookings.length > 0 ? 50 : 0
      }
    })
  }, [tables, bookings, currentTime])

  const availableTables = tableStatus.filter(t => t.is_active && !t.isOccupied)

  // Enhanced handlers
  const handleCustomerSelect = (customer: any) => {
    setSelectedCustomer(customer)
    setCustomerSearch(customer.profile?.full_name || customer.guest_name || "")
    setShowCustomerDropdown(false)
    
    setWalkInData({
      guestName: customer.profile?.full_name || customer.guest_name || "",
      guestPhone: customer.profile?.phone_number || customer.guest_phone || "",
      partySize: walkInData.partySize,
      estimatedDuration: customer.average_party_size > 4 ? 150 : 120,
      preferences: customer.preferred_table_types || []
    })
    
    // Show VIP toast
    if (customer.vip_status) {
      toast.success(
        <div className="flex items-center gap-2">
          <Crown className="h-4 w-4 text-accent-foreground" />
          <span>VIP Customer Selected</span>
        </div>,
        { duration: 3000 }
      )
    }
  }

  const handleQuickCheckIn = (booking: any) => {
    const hasTable = booking.tables && booking.tables.length > 0
    
    if (hasTable) {
      // Check if tables are still available
      const tablesAvailable = booking.tables.every((table: any) => {
        const status = tableStatus.find(t => t.id === table.id)
        return status && !status.isOccupied
      })
      
      if (tablesAvailable) {
        onCheckIn(booking.id, booking.tables.map((t: any) => t.id))
      } else {
        // Tables occupied - suggest alternatives
        const suggestions = generateSmartSuggestions(booking)
        if (suggestions.length > 0) {
          toast.error(
            <div>
              <p className="font-medium">Tables occupied</p>
              <p className="text-sm mt-1">{suggestions[0].description}</p>
              <Button 
                size="sm" 
                className="mt-2"
                onClick={suggestions[0].action}
              >
                {suggestions[0].title}
              </Button>
            </div>,
            { duration: 5000 }
          )
        } else {
          handleOpenEnhancedTableSwitch(booking)
        }
      }
    } else {
      if (selectedTableIds.length === 0) {
        toast.error("Please select a table first")
        return
      }
      onCheckIn(booking.id, selectedTableIds)
      setSelectedTableIds([])
    }
  }

  const handleSeatGuest = async (booking: any) => {
    if (!booking.tables || booking.tables.length === 0) {
      toast.error("No tables assigned. Please assign tables first.")
      handleOpenEnhancedTableSwitch(booking)
      return
    }
    
    // Check if tables are occupied by other bookings (excluding this booking)
    const tablesAvailable = booking.tables.every((table: any) => {
      // Find any booking that is physically occupying this table (excluding current booking)
      const occupyingBooking = bookings.find(b => {
        if (b.id === booking.id) return false // Exclude the current booking
        const physicallyPresent = ['arrived', 'seated', 'ordered', 'appetizers', 'main_course', 'dessert', 'payment'].includes(b.status)
        return physicallyPresent && b.tables?.some((t: any) => t.id === table.id)
      })
      
      return !occupyingBooking // Table is available if no one else is physically there
    })
    
    if (!tablesAvailable) {
      toast.error("Tables are no longer available. Please reassign tables first.")
      handleOpenEnhancedTableSwitch(booking)
      return
    }
    
    // Guest is already checked in (status: 'arrived'), just seat them
    if (onCheckIn) {
      onCheckIn(booking.id, booking.tables.map((t: any) => t.id))
    }
  }

  const handleOpenEnhancedTableSwitch = (booking: any, suggestedTables?: any[]) => {
    // If suggested tables provided, calculate options for those specific tables
    // Otherwise, find all possible options across all available tables
    let swapOptions: TableSwapOption[] = []
    
    if (suggestedTables && suggestedTables.length > 0) {
      swapOptions = calculateSwapOptions(booking, suggestedTables.map(t => t.id))
    } else {
      // Find all possible table combinations that could work
      const availableTables = tables.filter(t => t.is_active)
      const suitableTables = availableTables.filter(t => t.max_capacity >= booking.party_size)
      
      // Generate options for individual suitable tables
      suitableTables.forEach(table => {
        const options = calculateSwapOptions(booking, [table.id])
        swapOptions.push(...options)
      })
      
      // For larger parties, also consider combinations
      if (booking.party_size > 4) {
        suitableTables.forEach(table1 => {
          suitableTables.forEach(table2 => {
            if (table1.id !== table2.id && 
                (table1.max_capacity + table2.max_capacity) >= booking.party_size) {
              const options = calculateSwapOptions(booking, [table1.id, table2.id])
              swapOptions.push(...options)
            }
          })
        })
      }
      
      // Remove duplicates and sort by confidence
      swapOptions = swapOptions
        .filter((option, index, arr) => 
          arr.findIndex(o => 
            o.type === option.type && 
            JSON.stringify(o.tables.map(t => t.id).sort()) === JSON.stringify(option.tables.map(t => t.id).sort())
          ) === index
        )
        .sort((a, b) => b.confidence - a.confidence)
        .slice(0, 10) // Limit to top 10 options
    }
    
    setTableSwitchModal({
      show: true,
      booking,
      originalTables: booking.tables || [],
      selectedNewTableIds: [],
      swapOptions,
      selectedOption: swapOptions[0] || undefined,
      confirmationStep: false
    })
  }

  const handleTableSwitchConfirm = async () => {
    const { booking, selectedOption, selectedNewTableIds } = tableSwitchModal
    
    if (!booking || !onTableSwitch) return
    
    try {
      if (selectedOption) {
        if (selectedOption.type === 'swap' && selectedOption.targetBooking) {
          // TRUE TABLE SWAP: Both bookings exchange tables atomically
          const currentTableIds = booking.tables?.map((t: any) => t.id) || []
          const targetTableIds = selectedOption.tables.map(t => t.id)
          const targetBooking = selectedOption.targetBooking
          
          // Perform atomic swap - both bookings get reassigned simultaneously
          await Promise.all([
            onTableSwitch(booking.id, targetTableIds),
            onTableSwitch(targetBooking.id, currentTableIds)
          ])
          
          toast.success(
            <div>
              <p className="font-medium">Tables Swapped Successfully</p>
              <p className="text-sm mt-1">
                {booking.user?.full_name || booking.guest_name} → Tables {selectedOption.tables.map(t => t.table_number).join(', ')}
              </p>
              <p className="text-sm">
                {targetBooking.user?.full_name || targetBooking.guest_name} → Tables {currentTableIds.map((id: any) => tables.find(t => t.id === id)?.table_number).join(', ')}
              </p>
            </div>,
            { duration: 5000 }
          )
        }
        
        else if (selectedOption.type === 'empty' && selectedOption.targetBooking) {
          // BUMP OTHER BOOKING: Move target booking away, then assign tables to current booking
          const targetBooking = selectedOption.targetBooking
          const targetTableIds = selectedOption.tables.map(t => t.id)
          
          // First, remove table assignment from the booking being bumped
          await onTableSwitch(targetBooking.id, [])
          
          // Then assign the tables to our booking
          await onTableSwitch(booking.id, targetTableIds)
          
          toast.success(
            <div>
              <p className="font-medium">Tables Reassigned</p>
              <p className="text-sm mt-1">
                {booking.user?.full_name || booking.guest_name} → Tables {selectedOption.tables.map(t => t.table_number).join(', ')}
              </p>
              <p className="text-sm text-muted-foreground">
                {targetBooking.user?.full_name || targetBooking.guest_name} needs new table assignment
              </p>
            </div>,
            { duration: 5000 }
          )
        }
        
        else if (selectedOption.type === 'combination') {
          // COMBINATION ASSIGNMENT: Use predefined table combination
          const targetTableIds = selectedOption.tables.map(t => t.id)
          
          // If there are future bookings at these tables, bump them first
          if (selectedOption.targetBooking) {
            await onTableSwitch(selectedOption.targetBooking.id, [])
          }
          
          await onTableSwitch(booking.id, targetTableIds)
          
          toast.success(
            <div>
              <p className="font-medium">Table Combination Assigned</p>
              <p className="text-sm mt-1">
                {booking.user?.full_name || booking.guest_name} → Tables {selectedOption.tables.map(t => t.table_number).join(', ')}
              </p>
            </div>
          )
        }
        
        else {
          // SIMPLE MOVE: Just assign new tables (tables are empty)
          await onTableSwitch(booking.id, selectedOption.tables.map(t => t.id))
          
          toast.success(
            <div>
              <p className="font-medium">Tables Assigned</p>
              <p className="text-sm mt-1">
                {booking.user?.full_name || booking.guest_name} → Tables {selectedOption.tables.map(t => t.table_number).join(', ')}
              </p>
            </div>
          )
        }
      }
      
      else if (selectedNewTableIds.length > 0) {
        // MANUAL SELECTION: User manually picked tables
        await onTableSwitch(booking.id, selectedNewTableIds)
        
        const tableNumbers = selectedNewTableIds
          .map(id => tables.find(t => t.id === id)?.table_number)
          .filter(Boolean)
          .join(', ')
        
        toast.success(`Tables ${tableNumbers} assigned to ${booking.user?.full_name || booking.guest_name}`)
      }
      
      // Close modal
      setTableSwitchModal({ 
        show: false, 
        originalTables: [], 
        selectedNewTableIds: [],
        swapOptions: [],
        confirmationStep: false
      })
      
    } catch (error) {
      console.error("Table switch error:", error)
      toast.error("Failed to switch tables. Please try again.")
    }
  }

  const handleWalkIn = async () => {
    // For shared table bookings, check shared table selection
    if (isSharedBookingMode) {
      if (!selectedSharedTableId) {
        toast.error("Please select a shared table")
        return
      }

      const partySize = typeof walkInData.partySize === 'number' ? walkInData.partySize : (parseInt(walkInData.partySize as string) || 1)
      
      if (sharedTableSeatsRequested > partySize) {
        toast.error("Seats requested cannot exceed party size")
        return
      }

      // Create shared table booking
      const sharedBookingData = {
        customer_id: selectedCustomer?.id || null,
        user_id: selectedCustomer?.user_id || null,
        guest_name: selectedCustomer
          ? (selectedCustomer.profile?.full_name || selectedCustomer.guest_name)
          : (walkInData.guestName.trim() || `Walk-in ${format(currentTime, 'HH:mm')}`),
        guest_phone: selectedCustomer
          ? (selectedCustomer.profile?.phone_number || selectedCustomer.guest_phone)
          : (walkInData.guestPhone?.trim() || null),
        guest_email: selectedCustomer?.guest_email || null,
        party_size: partySize,
        shared_table_id: selectedSharedTableId,
        seats_requested: sharedTableSeatsRequested,
        booking_time: currentTime.toISOString(),
        turn_time_minutes: walkInData.estimatedDuration,
        status: 'arrived',
        is_shared_booking: true
      }

      onQuickSeat(sharedBookingData, [selectedSharedTableId])
      
      // Reset form
      setWalkInData({ guestName: "", guestPhone: "", partySize: 2, estimatedDuration: 120, preferences: [] })
      setSelectedSharedTableId("")
      setSharedTableSeatsRequested(2)
      setSelectedCustomer(null)
      setCustomerSearch("")
      
      const sharedTable = sharedTablesSummary.find(t => t.table_id === selectedSharedTableId)
      toast.success(
        <div>
          <p className="font-medium">Shared Table Walk-in Seated</p>
          <p className="text-sm mt-1">{sharedBookingData.guest_name} → Table {sharedTable?.table_number} ({sharedTableSeatsRequested} seats)</p>
        </div>,
        { duration: 3000 }
      )
      return
    }

    // Regular table booking logic
    if (selectedTableIds.length === 0) {
      toast.error("Please select at least one table")
      return
    }

    // Check for upcoming reservations on selected tables
    const conflictingReservations: any[] = []
    const selectedTables = selectedTableIds.map(id => tableStatus.find(t => t.id === id)).filter(Boolean)

    selectedTables.forEach(table => {
      if (table.upcomingBookings && table.upcomingBookings.length > 0) {
        // Check for reservations in the next 2 hours
        const soonReservations = table.upcomingBookings.filter((booking: any) => {
          const minutesUntil = differenceInMinutes(new Date(booking.booking_time), currentTime)
          return minutesUntil <= 120 // Next 2 hours
        })
        conflictingReservations.push(...soonReservations.map((booking: any) => ({
          ...booking,
          table: table
        })))
      }
    })

    // Check if this is a large party requiring multiple tables or has capacity issues
    const totalCapacity = selectedTableIds.reduce((sum, id) => {
      const table = tableStatus.find(t => t.id === id)
      return sum + (table?.max_capacity || 0)
    }, 0)
    const partySize = typeof walkInData.partySize === 'number' ? walkInData.partySize : (parseInt(walkInData.partySize as string) || 1)
    const hasCapacityIssue = totalCapacity < partySize
    const isLargeParty = partySize > 6 || selectedTableIds.length > 1 || hasCapacityIssue

    // Show confirmation dialog if there are conflicts or large party
    if (conflictingReservations.length > 0) {
      setWalkInConfirmation({
        show: true,
        type: 'upcoming_reservations',
        conflictingReservations,
        selectedTables,
        walkInData: {
          customer_id: selectedCustomer?.id || null,
          user_id: selectedCustomer?.user_id || null,
          guest_name: selectedCustomer
            ? (selectedCustomer.profile?.full_name || selectedCustomer.guest_name)
            : (walkInData.guestName.trim() || `Walk-in ${format(currentTime, 'HH:mm')}`),
          guest_phone: selectedCustomer
            ? (selectedCustomer.profile?.phone_number || selectedCustomer.guest_phone)
            : (walkInData.guestPhone?.trim() || null),
          guest_email: selectedCustomer?.guest_email || null,
          party_size: partySize,
          table_ids: selectedTableIds,
          booking_time: currentTime.toISOString(),
          turn_time_minutes: walkInData.estimatedDuration,
          status: 'arrived',
          table_preferences: walkInData.preferences
        }
      })
      return
    } else if (isLargeParty) {
      setWalkInConfirmation({
        show: true,
        type: 'multi_table',
        conflictingReservations: [],
        selectedTables,
        walkInData: {
          customer_id: selectedCustomer?.id || null,
          user_id: selectedCustomer?.user_id || null,
          guest_name: selectedCustomer
            ? (selectedCustomer.profile?.full_name || selectedCustomer.guest_name)
            : (walkInData.guestName.trim() || `Walk-in ${format(currentTime, 'HH:mm')}`),
          guest_phone: selectedCustomer
            ? (selectedCustomer.profile?.phone_number || selectedCustomer.guest_phone)
            : (walkInData.guestPhone?.trim() || null),
          guest_email: selectedCustomer?.guest_email || null,
          party_size: partySize,
          table_ids: selectedTableIds,
          booking_time: currentTime.toISOString(),
          turn_time_minutes: walkInData.estimatedDuration,
          status: 'arrived',
          table_preferences: walkInData.preferences
        }
      })
      return
    }

    // No conflicts, proceed directly
    await proceedWithWalkIn()
  }

  // Execute the existing walk-in flow from a prepared booking object
  const executeWalkInFlow = async (walkInBooking: any) => {
    // Handle conflicting reservations
    let createdConflicts: any[] = []
    if (walkInConfirmation.conflictingReservations.length > 0) {
      // Remove table assignments from conflicting bookings
      if (onTableSwitch) {
        for (const conflictingReservation of walkInConfirmation.conflictingReservations) {
          onTableSwitch(conflictingReservation.id, []) // Empty array removes table assignment
        }
      }

      // Create conflict tracking after walk-in is seated
      const upcomingBookingIds = walkInConfirmation.conflictingReservations.map(r => r.id)

      // Show immediate notification about reassigned bookings
      const conflictCount = walkInConfirmation.conflictingReservations.length
      const earliestBooking = walkInConfirmation.conflictingReservations
        .sort((a, b) => new Date(a.booking_time).getTime() - new Date(b.booking_time).getTime())[0]

      toast.error(
        <div>
          <p className="font-medium">⚠️ Booking Conflicts Created</p>
          <p className="text-sm mt-1">
            {conflictCount} reservation{conflictCount > 1 ? 's' : ''} reassigned. 
            Next arrival: {format(new Date(earliestBooking.booking_time), 'h:mm a')}
          </p>
          <p className="text-xs mt-1 opacity-80">
            Walk-in must vacate before then. Find alternative tables!
          </p>
        </div>,
        { duration: 8000, style: { backgroundColor: '#7f1d1d', color: 'white' } }
      )
    }

    onQuickSeat(walkInBooking, selectedTableIds)

    // Create conflict tracking after walk-in is seated (if conflicts exist)
    if (walkInConfirmation.conflictingReservations.length > 0) {
      // Wait for the booking to be created, then create conflicts
      setTimeout(async () => {
        try {
          const upcomingBookingIds = walkInConfirmation.conflictingReservations.map(r => r.id)
          await conflictService.createConflict(
            walkInBooking.guest_name, // This will be the walk-in booking ID after it's created
            upcomingBookingIds,
            selectedTableIds
          )
        } catch (error) {
          console.error('Failed to create conflict tracking:', error)
        }
      }, 2000) // Give time for the booking to be created
    }

    const tableNumbers = selectedTableIds
      .map(id => tableStatus.find(t => t.id === id)?.table_number)
      .filter(Boolean)
      .join(', ')

    // Enhanced success toast with conflict info
    if (walkInConfirmation.conflictingReservations.length > 0) {
      const nextBookingTime = walkInConfirmation.conflictingReservations
        .sort((a, b) => new Date(a.booking_time).getTime() - new Date(b.booking_time).getTime())[0]?.booking_time

      const minutesToNext = differenceInMinutes(new Date(nextBookingTime), currentTime)

      toast.success(
        <div>
          <p className="font-medium">Walk-in Seated with Conflicts</p>
          <p className="text-sm mt-1">{walkInBooking.guest_name} → Table {tableNumbers}</p>
          <p className="text-xs mt-1 font-medium text-accent-foreground">
            🕒 Must vacate in {minutesToNext} min (at {format(new Date(nextBookingTime), 'h:mm a')})
          </p>
        </div>,
        { duration: 6000 }
      )
    } else {
      toast.success(
        <div>
          <p className="font-medium">Walk-in Seated</p>
          <p className="text-sm mt-1">{walkInBooking.guest_name} → Table {tableNumbers}</p>
        </div>,
        { duration: 3000 }
      )
    }

    // Reset form and close confirmation
    setWalkInData({ guestName: "", guestPhone: "", partySize: 2, estimatedDuration: 120, preferences: [] })
    setSelectedTableIds([])
    setSelectedCustomer(null)
    setCustomerSearch("")
    setWalkInConfirmation({
      show: false,
      type: null,
      conflictingReservations: [],
      selectedTables: [],
      walkInData: null
    })
  }

  const proceedWithWalkIn = async () => {
    const partySize = typeof walkInData.partySize === 'number' ? walkInData.partySize : (parseInt(walkInData.partySize as string) || 1)
    const walkInBooking = walkInConfirmation.walkInData || {
      customer_id: selectedCustomer?.id || null,
      user_id: selectedCustomer?.user_id || null,
      guest_name: selectedCustomer
        ? (selectedCustomer.profile?.full_name || selectedCustomer.guest_name)
        : (walkInData.guestName.trim() || `Walk-in ${format(currentTime, 'HH:mm')}`),
      guest_phone: selectedCustomer
        ? (selectedCustomer.profile?.phone_number || selectedCustomer.guest_phone)
        : (walkInData.guestPhone?.trim() || null),
      guest_email: selectedCustomer 
        ? (selectedCustomer.guest_email || null)
        : null, // Walk-ins don't have email in this form
      party_size: partySize,
      table_ids: selectedTableIds,
      booking_time: currentTime.toISOString(),
      turn_time_minutes: walkInData.estimatedDuration,
      status: 'arrived',
      table_preferences: walkInData.preferences
    }
    
    // FIXED: Clean the booking data to ensure empty strings are converted to null
    const cleanGuestName = walkInBooking.guest_name?.trim()
    const cleanGuestEmail = walkInBooking.guest_email?.trim()
    const cleanGuestPhone = walkInBooking.guest_phone?.trim()
    
    const cleanedWalkInBooking = {
      ...walkInBooking,
      guest_name: cleanGuestName || `Walk-in ${format(currentTime, 'HH:mm')}`,
      guest_email: cleanGuestEmail || null,
      guest_phone: cleanGuestPhone || null,
    }
    
    // If no selected customer but meaningful guest info is provided, prompt to add/use existing
    const hasGuestInfo = !!(cleanGuestName && cleanGuestName !== `Walk-in ${format(currentTime, 'HH:mm')}`) || !!(cleanGuestEmail) || !!(cleanGuestPhone)
    if (!walkInBooking.customer_id && hasGuestInfo) {
      setPendingWalkInBooking(cleanedWalkInBooking)
      setPendingGuestDetails({
        name: cleanGuestName || null,
        email: cleanGuestEmail || null,
        phone: cleanGuestPhone || null,
      })
      setShowAddCustomerPrompt(true)
      return
    }

    await executeWalkInFlow(cleanedWalkInBooking)
  }

  // Similar customers lookup when prompt open
  const { data: similarCustomers, isLoading: similarLoading, error: similarError } = useQuery({
    queryKey: [
      "walkin-similar-restaurant-customers",
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

  const finalizeWalkInWithCustomer = async (customer: any) => {
    if (!pendingWalkInBooking) return
    const updated = {
      ...pendingWalkInBooking,
      customer_id: customer?.id || null,
      user_id: customer?.user_id || null,
      guest_name: customer?.profile?.full_name || customer?.guest_name || pendingWalkInBooking.guest_name,
      guest_phone: customer?.profile?.phone_number || customer?.guest_phone || pendingWalkInBooking.guest_phone,
      guest_email: customer?.guest_email || pendingWalkInBooking.guest_email,
    }
    setShowAddCustomerPrompt(false)
    setPendingWalkInBooking(null)
    setPendingGuestDetails(null)
    await executeWalkInFlow(updated)
  }

  const handleSkipAddingCustomer = async () => {
    if (!pendingWalkInBooking) return
    setShowAddCustomerPrompt(false)
    const toSubmit = { ...pendingWalkInBooking }
    setPendingWalkInBooking(null)
    setPendingGuestDetails(null)
    await executeWalkInFlow(toSubmit)
  }

  const handleAddNewCustomer = async () => {
    if (!pendingWalkInBooking || !restaurantId) return
    const name = pendingGuestDetails?.name?.trim() || pendingWalkInBooking.guest_name?.trim() || null
    const email = pendingGuestDetails?.email?.trim() || pendingWalkInBooking.guest_email?.trim() || null
    const phone = pendingGuestDetails?.phone?.trim() || pendingWalkInBooking.guest_phone?.trim() || null

    // FIXED: Ensure we have at least one meaningful identifier
    // Empty strings should be converted to null to avoid unique constraint violations
    const cleanName = name && name.length > 0 ? name : null
    const cleanEmail = email && email.length > 0 ? email : null
    const cleanPhone = phone && phone.length > 0 ? phone : null

    if (!cleanName && !cleanEmail && !cleanPhone) {
      toast.error("Provide at least a name, email, or phone to add a customer")
      return
    }

    // FIXED: Don't create customers if we only have empty values or null values
    // This prevents the unique constraint violation on (restaurant_id, '', '')
    if (!cleanEmail && !cleanPhone) {
      // If we only have a name but no contact info, skip creating a customer
      // since the unique constraint is on email+phone combination
      toast("Skipping customer creation - contact information is required")
      await handleSkipAddingCustomer()
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

      if (cleanEmail && cleanPhone) {
        existingQuery = existingQuery.eq("guest_email", cleanEmail).eq("guest_phone", cleanPhone)
      } else if (cleanEmail) {
        existingQuery = existingQuery.eq("guest_email", cleanEmail).is("guest_phone", null)
      } else if (cleanPhone) {
        existingQuery = existingQuery.eq("guest_phone", cleanPhone).is("guest_email", null)
      }

      const { data: existing } = await existingQuery.single()
      if (existing) {
        toast.success("Using existing customer record")
        await finalizeWalkInWithCustomer(existing)
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
            await finalizeWalkInWithCustomer(dupExisting)
            return
          }
        }
        throw error
      }

      toast.success("Customer added to restaurant")
      await finalizeWalkInWithCustomer(data)
    } catch (err) {
      console.error("Error adding restaurant customer:", err)
      toast.error("Failed to add customer")
    } finally {
      setIsAddingCustomer(false)
    }
  }

  const getBookingStatus = (booking: any) => {
    const bookingTime = new Date(booking.booking_time)
    const minutesUntil = differenceInMinutes(bookingTime, currentTime)
    
    if (minutesUntil < -15) {
      return {
        label: "Late",
        subLabel: `${Math.abs(minutesUntil)}m late`,
        color: "text-destructive",
        bgColor: "bg-gradient-to-br from-destructive/20 to-destructive/10 border-destructive/30",
        icon: AlertCircle,
        pulseAnimation: true,
        priority: 1
      }
    } else if (minutesUntil < 0) {
      return {
        label: "Now",
        subLabel: "Ready to check-in",
        color: "text-primary",
        bgColor: "bg-gradient-to-br from-primary/20 to-primary/10 border-primary/30",
        icon: UserCheck,
        pulseAnimation: true,
        priority: 2
      }
    } else if (minutesUntil <= 15) {
      return {
        label: `${minutesUntil}m`,
        subLabel: "Arriving soon",
        color: "text-secondary-foreground",
        bgColor: "bg-gradient-to-br from-secondary/30 to-secondary/20 border-secondary/40",
        icon: Timer,
        pulseAnimation: false,
        priority: 3
      }
    } else {
      return {
        label: `${minutesUntil}m`,
        subLabel: "Upcoming",
        color: "text-muted-foreground",
        bgColor: "bg-gradient-to-br from-muted/30 to-muted/20 border-border",
        icon: Clock,
        pulseAnimation: false,
        priority: 4
      }
    }
  }

  const renderEnhancedBookingCard = (booking: any) => {
    const status = getBookingStatus(booking)
    const StatusIcon = status.icon
    const hasTable = booking.tables && booking.tables.length > 0
    const customerData = booking.user?.id ? customersData[booking.user.id] : null
    
    const canCheckInDirectly = hasTable && booking.tables.every((table: any) => {
      const tableInfo = tableStatus.find(t => t.id === table.id)
      return tableInfo && !tableInfo.isOccupied
    })

    return (
      <div
        key={booking.id}
        className={cn(
          "relative p-1.5 rounded border cursor-pointer transition-colors",
          status.bgColor,
          "hover:border-border"
        )}
        onClick={() => onSelectBooking?.(booking)}
      >
        {/* Compact single row layout */}
        <div className="flex items-center gap-1.5">
          <StatusIcon className={cn("h-3 w-3 flex-shrink-0", status.color)} />
          
          <div className="flex-1 min-w-0">
            {/* Guest name and essential info in single line */}
            <div className="flex items-center gap-1 mb-0.5">
              <p className="font-medium text-foreground text-xs truncate">
                {booking.guest_name || booking.user?.full_name || 'Anonymous'}
              </p>
              {customerData?.vip_status && (
                <Badge className="text-xs px-1 py-0 bg-accent text-accent-foreground h-3 min-w-0">
                  V
                </Badge>
              )}
            </div>
            
            {/* Time and party size in compact format */}
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>{format(new Date(booking.booking_time), 'h:mm')}</span>
              <span>{booking.party_size}p</span>
              {booking.is_shared_booking ? (
                <div className="flex items-center gap-1">
                  <Users className="h-2.5 w-2.5 text-purple-400" />
                  <span className="text-purple-400 text-xs">
                    T{booking.shared_table?.table_number || 'Unknown'} ({booking.seats_requested} seats)
                  </span>
                </div>
              ) : hasTable ? (
                <span className="text-secondary-foreground text-xs">
                  T{booking.tables.map((t: any) => t.table_number).join(",")}
                </span>
              ) : null}
            </div>
          </div>

          {/* Compact button with icon + text */}
          <div className="flex-shrink-0">
            {booking.status === 'arrived' ? (
              <Button
                size="sm"
                onClick={(e) => {
                  e.stopPropagation()
                  handleSeatGuest(booking)
                }}
                className="bg-primary hover:bg-primary/90 text-primary-foreground px-1.5 py-0.5 h-5 text-xs flex items-center gap-0.5"
              >
                <Users className="h-2.5 w-2.5" />
                Seat
              </Button>
            ) : canCheckInDirectly ? (
              <Button
                size="sm"
                onClick={(e) => {
                  e.stopPropagation()
                  handleQuickCheckIn(booking)
                }}
                className="bg-secondary hover:bg-secondary/90 text-secondary-foreground px-1.5 py-0.5 h-5 text-xs flex items-center gap-0.5"
              >
                <CheckCircle className="h-2.5 w-2.5" />
                In
              </Button>
            ) : (
              <Button
                size="sm"
                variant="outline"
                onClick={(e) => {
                  e.stopPropagation()
                  handleOpenEnhancedTableSwitch(booking)
                }}
                className="border-accent text-accent-foreground hover:bg-accent/30 px-1.5 py-0.5 h-5 text-xs flex items-center gap-0.5"
              >
                <Table2 className="h-2.5 w-2.5" />
                Assign
              </Button>
            )}
          </div>
        </div>
      </div>
    )
  }

  // Status icons mapping
  const STATUS_ICONS = {
    seated: Users,
    ordered: ChefHat,
    payment: CreditCard,
    completed: CheckCircle
  }

  // Status colors mapping using brand colors
  const STATUS_COLORS = {
    seated: "text-primary bg-primary/10 border-primary/30",
    ordered: "text-accent-foreground bg-accent/20 border-accent/40",
    payment: "text-primary bg-primary/20 border-primary/40",
    completed: "text-muted-foreground bg-muted/50 border-border"
  }

  const renderDiningCard = (booking: any) => {
    const hasTable = booking.tables && booking.tables.length > 0
    const customerData = booking.user?.id ? customersData[booking.user.id] : null
    const StatusIcon = STATUS_ICONS[booking.status as keyof typeof STATUS_ICONS] || Activity
    const statusColor = STATUS_COLORS[booking.status as keyof typeof STATUS_COLORS] || "text-muted-foreground bg-muted/30 border-border"

    // Calculate dining progress and time
    const progress = TableStatusService.getDiningProgress(booking.status as DiningStatus)
    const bookingTime = new Date(booking.booking_time)
    
    // Use checked_in_at for elapsed time if guest has checked in, otherwise use booking_time
    const timeReference = booking.checked_in_at ? new Date(booking.checked_in_at) : bookingTime
    const elapsedMinutes = differenceInMinutes(currentTime, timeReference)

    // Get valid next transitions
    const validTransitions = tableStatusService.getValidTransitions(booking.status as DiningStatus)
    const nextTransition = validTransitions[0] // Most common next step

    return (
      <div
        key={booking.id}
        className={cn(
          "relative p-1.5 rounded border cursor-pointer transition-all duration-200",
          statusColor,
          "hover:border-border"
        )}
        onClick={() => onSelectBooking?.(booking)}
      >
        <div className="flex items-center gap-1.5">
          <StatusIcon className="h-3 w-3 flex-shrink-0" />
          
          <div className="flex-1 min-w-0">
            {/* Guest name and VIP badge */}
            <div className="flex items-center gap-1 mb-0.5">
              <p className="font-medium text-foreground text-xs truncate">
                {booking.guest_name || booking.user?.full_name || 'Anonymous'}
              </p>
              {customerData?.vip_status && (
                <Badge className="text-xs px-1 py-0 bg-accent text-accent-foreground h-3 min-w-0">
                  V
                </Badge>
              )}
            </div>

            {/* Status and time info */}
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>{format(new Date(booking.booking_time), 'h:mm')}</span>
              <span>{booking.party_size}p</span>
              {booking.is_shared_booking ? (
                <div className="flex items-center gap-1">
                  <Users className="h-2.5 w-2.5 text-purple-400" />
                  <span className="text-purple-400">
                    T{booking.shared_table?.table_number || 'Unknown'} ({booking.seats_requested} seats)
                  </span>
                </div>
              ) : hasTable ? (
                <span className="text-secondary-foreground">
                  T{booking.tables.map((t: any) => t.table_number).join(",")}
                </span>
              ) : null}
              <span className="text-muted-foreground">{elapsedMinutes}m</span>
            </div>

            {/* Mini progress bar */}
            <div className="w-full bg-border rounded-full h-1 mt-0.5">
              <div
                className="bg-gradient-to-r from-primary to-secondary h-1 rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex-shrink-0 flex gap-1">
            {/* Complete booking button - always available for any status except completed */}
            {booking.status !== 'completed' && (
              <Button
                size="sm"
                onClick={(e) => {
                  e.stopPropagation()
                  handleStatusUpdate(booking.id, 'completed')
                }}
                className="bg-green-600 hover:bg-green-700 text-white px-1.5 py-0.5 h-5 text-xs flex items-center justify-center"
              >
                <CheckCircle className="h-2.5 w-2.5" />
              </Button>
            )}
            
            {/* Next step button - simplified flow */}
            {nextTransition && booking.status !== 'completed' && (
              <Button
                size="sm"
                onClick={(e) => {
                  e.stopPropagation()
                  // Simplified status flow: seated -> ordered -> payment -> completed
                  let nextStatus = nextTransition.to
                  if (booking.status === 'seated') {
                    nextStatus = 'ordered'
                  } else if (booking.status === 'ordered') {
                    nextStatus = 'payment'
                  } else if (booking.status === 'payment') {
                    nextStatus = 'completed'
                  }
                  handleStatusUpdate(booking.id, nextStatus)
                }}
                className="bg-accent hover:bg-accent/80 text-accent-foreground px-1.5 py-0.5 h-5 text-xs flex items-center justify-center"
              >
                <Play className="h-2.5 w-2.5" />
              </Button>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col bg-gradient-to-br from-background via-card to-background text-foreground">
      {/* Ultra-Compact Header */}
      <div className="px-2 py-1 border-b border-border flex-shrink-0">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold text-foreground">Queue</h3>
          
          {/* Essential stats only */}
          <div className="flex items-center gap-2 text-xs">
            {categorizedBookings.activeDining.length > 0 && (
              <div className="flex items-center gap-1 text-green-400">
                <Activity className="h-3 w-3" />
                <span className="font-medium">{categorizedBookings.activeDining.length}</span>
              </div>
            )}
            {categorizedBookings.waitingForSeating.length > 0 && (
              <div className="flex items-center gap-1 text-orange-400">
                <UserCheck className="h-3 w-3" />
                <span className="font-medium">{categorizedBookings.waitingForSeating.length}</span>
              </div>
            )}
            {categorizedBookings.vipArrivals.length > 0 && (
              <div className="flex items-center gap-1 text-yellow-400">
                <Crown className="h-3 w-3" />
                <span className="font-medium">{categorizedBookings.vipArrivals.length}</span>
              </div>
            )}
            <div className="flex items-center gap-1 text-muted-foreground">
              <Table2 className="h-3 w-3" />
              <span>{availableTables.length}</span>
            </div>
          </div>
        </div>
      </div>

      <Tabs defaultValue="active" className="flex-1 flex flex-col overflow-hidden">
        <TabsList className="mx-2 mt-1 grid w-[calc(100%-1rem)] grid-cols-3 bg-muted h-7 p-0.5 flex-shrink-0">
          <TabsTrigger value="active" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground text-xs px-1 h-6">
            Active
            {categorizedBookings.activeDining.length > 0 && (
              <Badge className="ml-1 px-1 py-0 text-xs bg-secondary text-secondary-foreground h-3.5 leading-none">
                {categorizedBookings.activeDining.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="arrivals" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground text-xs px-1 h-6">
            Arrivals
            {(categorizedBookings.lateArrivals.length +
              categorizedBookings.currentArrivals.length +
              categorizedBookings.upcomingArrivals.length) > 0 && (
              <Badge className="ml-1 px-1 py-0 text-xs bg-accent text-accent-foreground h-3.5 leading-none">
                {categorizedBookings.lateArrivals.length +
                 categorizedBookings.currentArrivals.length +
                 categorizedBookings.upcomingArrivals.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="walkin" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground text-xs px-1 h-6">
            Walk-in
          </TabsTrigger>
        </TabsList>

        <TabsContent value="active" className="flex-1 overflow-hidden mt-1 mx-2 mb-1">
          <ScrollArea className="h-full">
            <div className="space-y-1 pr-2">
              {/* Active dining guests */}
              {categorizedBookings.activeDining.length > 0 ? (
                <div className="space-y-1">
                  <h4 className="text-xs font-medium text-green-400 border-b border-green-800 pb-1">
                    Currently Dining ({categorizedBookings.activeDining.length})
                  </h4>
                  {categorizedBookings.activeDining.map(renderDiningCard)}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Activity className="h-6 w-6 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">No active dining guests</p>
                  <p className="text-xs text-muted-foreground mt-1">Guests will appear here once seated</p>
                </div>
              )}
            </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="arrivals" className="flex-1 overflow-hidden mt-1 mx-2 mb-1">
          <ScrollArea className="h-full">
            <div className="space-y-1 pr-2">
              {/* Waiting for seating - highest priority */}
              {categorizedBookings.waitingForSeating.length > 0 && (
                <div className="space-y-1">
                  <h4 className="text-xs font-medium text-orange-400 border-b border-orange-800 pb-1">
                    Waiting for Seating ({categorizedBookings.waitingForSeating.length})
                  </h4>
                  {categorizedBookings.waitingForSeating.map(renderEnhancedBookingCard)}
                </div>
              )}

              {/* VIP Arrivals */}
              {categorizedBookings.vipArrivals.length > 0 && (
                <div className="space-y-1 mt-2">
                  <h4 className="text-xs font-medium text-yellow-400 border-b border-yellow-800 pb-1">
                    VIP Guests ({categorizedBookings.vipArrivals.length})
                  </h4>
                  {categorizedBookings.vipArrivals.map(renderEnhancedBookingCard)}
                </div>
              )}

              {/* Morning Shift */}
              {categorizedBookings.morningArrivals.length > 0 && (
                <div className="space-y-1 mt-2">
                  <h4 className="text-xs font-medium text-blue-400 border-b border-blue-800 pb-1">
                    Morning (6AM - 11AM) ({categorizedBookings.morningArrivals.length})
                  </h4>
                  {categorizedBookings.morningArrivals
                    .sort((a: { booking_time: string | number | Date }, b: { booking_time: string | number | Date }) => new Date(a.booking_time).getTime() - new Date(b.booking_time).getTime())
                    .map(renderEnhancedBookingCard)
                  }
                </div>
              )}

              {/* Lunch Shift */}
              {categorizedBookings.lunchArrivals.length > 0 && (
                <div className="space-y-1 mt-2">
                  <h4 className="text-xs font-medium text-green-400 border-b border-green-800 pb-1">
                    Lunch (11AM - 4PM) ({categorizedBookings.lunchArrivals.length})
                  </h4>
                  {categorizedBookings.lunchArrivals
                    .sort((a: { booking_time: string | number | Date }, b: { booking_time: string | number | Date }) => new Date(a.booking_time).getTime() - new Date(b.booking_time).getTime())
                    .map(renderEnhancedBookingCard)
                  }
                </div>
              )}

              {/* Dinner Shift */}
              {categorizedBookings.dinnerArrivals.length > 0 && (
                <div className="space-y-1 mt-2">
                  <h4 className="text-xs font-medium text-purple-400 border-b border-purple-800 pb-1">
                    Dinner (4PM - 10PM) ({categorizedBookings.dinnerArrivals.length})
                  </h4>
                  {categorizedBookings.dinnerArrivals
                    .sort((a: { booking_time: string | number | Date }, b: { booking_time: string | number | Date }) => new Date(a.booking_time).getTime() - new Date(b.booking_time).getTime())
                    .map(renderEnhancedBookingCard)
                  }
                </div>
              )}

              {/* Late Night Shift */}
              {categorizedBookings.lateNightArrivals.length > 0 && (
                <div className="space-y-1 mt-2">
                  <h4 className="text-xs font-medium text-red-400 border-b border-red-800 pb-1">
                    Late Night (10PM - 6AM) ({categorizedBookings.lateNightArrivals.length})
                  </h4>
                  {categorizedBookings.lateNightArrivals
                    .sort((a: { booking_time: string | number | Date }, b: { booking_time: string | number | Date }) => new Date(a.booking_time).getTime() - new Date(b.booking_time).getTime())
                    .map(renderEnhancedBookingCard)
                  }
                </div>
              )}

              {/* Empty state */}
              {(categorizedBookings.morningArrivals.length +
                categorizedBookings.lunchArrivals.length +
                categorizedBookings.dinnerArrivals.length +
                categorizedBookings.lateNightArrivals.length +
                categorizedBookings.waitingForSeating.length) === 0 && (
                <div className="text-center py-8">
                  <UserCheck className="h-6 w-6 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">No arrivals scheduled</p>
                  <p className="text-xs text-muted-foreground mt-1">All arrivals will appear here grouped by shift</p>
                </div>
              )}
            </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="walkin" className="flex-1 overflow-hidden mt-1 mx-2 mb-1">
          <ScrollArea className="h-full">
            <div className="space-y-2 pr-2">
              {/* Enhanced tables summary */}
              <div className="p-2 bg-card hidden rounded-lg border border-border">
                <div className="flex items-center justify-between text-xs mb-2">
                  <span className="text-foreground font-medium">Table Status</span>
                  <span className="text-muted-foreground">
                    Total: {tables.filter(t => t.is_active).length}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="flex items-center gap-1">
                    <CheckCircle className="h-3 w-3 text-green-400" />
                    <span className="text-green-400">{availableTables.length} Available</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <UserCheck className="h-3 w-3 text-red-400" />
                    <span className="text-red-400">{tableStatus.filter(t => t.isOccupied).length} Occupied</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Activity className="h-3 w-3 text-green-400" />
                    <span className="text-green-400">{categorizedBookings.activeDining.length} Dining</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Clock className="h-3 w-3 text-yellow-400" />
                    <span className="text-yellow-400">
                      {tableStatus.filter(t => !t.isOccupied && t.upcomingBookings && t.upcomingBookings.length > 0).length} Reserved
                    </span>
                  </div>
                </div>
              </div>

              {/* Simplified walk-in form */}
              <div className="space-y-2 bg-card p-2 rounded-lg border border-border">
                {/* Customer search */}
                <div>
                  <Label className="text-xs text-foreground mb-1 block">
                    Search Customer (Optional)
                  </Label>
                  <div className="relative">
                    <Input
                      placeholder="Search by name or phone..."
                      value={customerSearch}
                      onChange={(e) => {
                        setCustomerSearch(e.target.value)
                        setShowCustomerDropdown(true)
                      }}
                      onFocus={() => setShowCustomerDropdown(customerSearch.length >= 1)}
                      onBlur={() => setTimeout(() => setShowCustomerDropdown(false), 150)}
                      className="bg-background border-border text-foreground text-xs h-7"
                    />
                    
                    {/* Customer dropdown */}
                    {showCustomerDropdown && customerSearch.length >= 1 && customers && customers.length > 0 && (
                      <div className="absolute z-50 w-full mt-1 bg-popover border border-border rounded-md shadow-lg max-h-32 overflow-y-auto">
                        {customers.map((customer) => (
                          <div
                            key={customer.id}
                            className="p-2 hover:bg-muted cursor-pointer text-xs"
                            onClick={() => handleCustomerSelect(customer)}
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-popover-foreground">
                                {customer.profile?.full_name || customer.guest_name || 'Guest'}
                              </span>
                              {customer.vip_status && (
                                <Badge className="text-xs px-1 py-0 bg-secondary text-secondary-foreground">
                                  VIP
                                </Badge>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  
                  {/* Selected customer */}
                  {selectedCustomer && (
                    <div className="mt-1 p-1.5 bg-primary/20 rounded text-xs flex items-center justify-between">
                      <div>
                        <span className="text-primary">Selected: </span>
                        <span className="text-foreground font-medium">
                          {selectedCustomer.profile?.full_name || selectedCustomer.guest_name}
                        </span>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setSelectedCustomer(null)
                          setCustomerSearch("")
                          setWalkInData(prev => ({
                            ...prev,
                            guestName: "",
                            guestPhone: "",
                            preferences: []
                          }))
                        }}
                        className="h-5 w-5 p-0 text-muted-foreground hover:text-foreground"
                      >
                        ×
                      </Button>
                    </div>
                  )}
                </div>

                {/* Basic details */}
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <Label className="text-xs text-foreground mb-0.5 block">Name</Label>
                    <Input
                      value={walkInData.guestName}
                      onChange={(e) => setWalkInData(prev => ({ ...prev, guestName: e.target.value }))}
                      placeholder="Optional"
                      disabled={!!selectedCustomer}
                      className="bg-background border-border text-foreground text-xs h-7"
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-foreground mb-0.5 block">Phone</Label>
                    <Input
                      value={walkInData.guestPhone}
                      onChange={(e) => setWalkInData(prev => ({ ...prev, guestPhone: e.target.value }))}
                      placeholder="Optional"
                      disabled={!!selectedCustomer}
                      className="bg-background border-border text-foreground text-xs h-7"
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-foreground mb-0.5 block">Party</Label>
                    <Input
                      type="number"
                      max="20"
                      value={walkInData.partySize || ""}
                      onChange={(e) => {
                        const value = e.target.value
                        if (value === "") {
                          setWalkInData(prev => ({ ...prev, partySize: "" as any }))
                        } else {
                          const numValue = parseInt(value)
                          if (!isNaN(numValue) && numValue > 0) {
                            setWalkInData(prev => ({ ...prev, partySize: numValue }))
                          }
                        }
                      }}
                      onBlur={(e) => {
                        // Ensure we have a valid value when user finishes editing
                        if (e.target.value === "" || parseInt(e.target.value) < 1) {
                          setWalkInData(prev => ({ ...prev, partySize: 1 }))
                        }
                      }}
                      placeholder="Party size"
                      className="bg-background border-border text-foreground text-xs h-7"
                    />
                  </div>
                </div>

                {/* Booking Mode Toggle */}
                <div className="space-y-2">
                  <Label className="text-xs text-foreground mb-1 block">
                    Booking Mode
                  </Label>
                  <div className="flex gap-2">
                    <Button
                      variant={!isSharedBookingMode ? "default" : "outline"}
                      size="sm"
                      onClick={() => {
                        setIsSharedBookingMode(false)
                        setSelectedSharedTableId("")
                        setSharedTableSeatsRequested(2)
                      }}
                      className="h-6 text-xs flex-1"
                    >
                      <Table2 className="h-3 w-3 mr-1" />
                      Regular Table
                    </Button>
                    <Button
                      variant={isSharedBookingMode ? "default" : "outline"}
                      size="sm"
                      onClick={() => {
                        setIsSharedBookingMode(true)
                        setSelectedTableIds([])
                      }}
                      className="h-6 text-xs flex-1"
                    >
                      <Users className="h-3 w-3 mr-1" />
                      Shared Table
                    </Button>
                  </div>
                </div>

                {/* Shared Table Selection */}
                {isSharedBookingMode && (
                  <div className="space-y-2">
                    <Label className="text-xs text-foreground mb-1 block">
                      Select Shared Table
                    </Label>
                    
                    {sharedTablesSummary.length > 0 ? (
                      <div className="space-y-1">
                        {sharedTablesSummary.map((table) => {
                          const isSelected = selectedSharedTableId === table.table_id
                          const availableSeats = table.capacity - table.current_occupancy
                          const canBook = availableSeats >= sharedTableSeatsRequested
                          
                          return (
                            <div
                              key={table.table_id}
                              className={cn(
                                "p-2 rounded border cursor-pointer transition-colors text-xs",
                                isSelected 
                                  ? "bg-primary text-primary-foreground border-primary"
                                  : canBook
                                    ? "bg-card border-border hover:border-primary/50"
                                    : "bg-muted border-border opacity-50 cursor-not-allowed"
                              )}
                              onClick={() => {
                                if (canBook) {
                                  setSelectedSharedTableId(table.table_id)
                                }
                              }}
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <Users className="h-3 w-3" />
                                  <span className="font-medium">Table {table.table_number}</span>
                                </div>
                                <div className="text-right">
                                  <div className="font-medium">
                                    {table.current_occupancy}/{table.capacity} seats
                                  </div>
                                  <div className="text-muted-foreground">
                                    {availableSeats} available
                                  </div>
                                </div>
                              </div>
                            </div>
                          )
                        })}
                        
                        {/* Seats requested for shared table */}
                        <div className="mt-2">
                          <Label className="text-xs text-foreground mb-1 block">
                            Seats Requested
                          </Label>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setSharedTableSeatsRequested(Math.max(1, sharedTableSeatsRequested - 1))}
                              disabled={sharedTableSeatsRequested <= 1}
                              className="h-6 w-6 p-0"
                            >
                              -
                            </Button>
                            <span className="text-xs w-8 text-center">{sharedTableSeatsRequested}</span>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                const maxSeats = selectedSharedTableId 
                                  ? (sharedTablesSummary.find(t => t.table_id === selectedSharedTableId)?.capacity || 10) - 
                                    (sharedTablesSummary.find(t => t.table_id === selectedSharedTableId)?.current_occupancy || 0)
                                  : 10
                                setSharedTableSeatsRequested(Math.min(maxSeats, sharedTableSeatsRequested + 1))
                              }}
                              disabled={selectedSharedTableId ? 
                                sharedTableSeatsRequested >= ((sharedTablesSummary.find(t => t.table_id === selectedSharedTableId)?.capacity || 10) - 
                                (sharedTablesSummary.find(t => t.table_id === selectedSharedTableId)?.current_occupancy || 0)) : false}
                              className="h-6 w-6 p-0"
                            >
                              +
                            </Button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="text-xs text-muted-foreground p-2 text-center">
                        No shared tables available
                      </div>
                    )}
                  </div>
                )}

                {/* Regular Table selection */}
                {!isSharedBookingMode && (
                <div>
                  <Label className="text-xs text-foreground mb-1 block">
                    Select Table - {availableTables.length} available
                  </Label>
                  
                  {(() => {
                    // Group tables by sections
                    const activeTables = tableStatus.filter(table => table.is_active)
                    
                    // Group available tables by section
                    const availableTablesBySection = activeTables
                      .filter(table => !table.isOccupied)
                      .reduce((groups: Record<string, any[]>, table) => {
                        const sectionId = table.section_id || 'no-section'
                        if (!groups[sectionId]) groups[sectionId] = []
                        groups[sectionId].push(table)
                        return groups
                      }, {})
                    
                    const occupiedTables = activeTables.filter(table => table.isOccupied)
                    
                    const tablesWithUpcomingBookings = activeTables
                      .filter(table => {
                        if (table.isOccupied) return false
                        const nextBooking = table.upcomingBookings?.[0]
                        return nextBooking && differenceInMinutes(new Date(nextBooking.booking_time), currentTime) <= 120
                      })
                    
                    const renderTableButton = (table: any) => {
                      const isSelected = selectedTableIds.includes(table.id)
                      const isAvailable = !table.isOccupied
                      const canSelect = isAvailable
                      
                      const nextBooking = table.upcomingBookings?.[0]
                      const minutesUntilNext = nextBooking ? differenceInMinutes(new Date(nextBooking.booking_time), currentTime) : null
                      const hasUrgentBooking = nextBooking && minutesUntilNext! <= 60
                      const hasBookingSoon = nextBooking && minutesUntilNext! <= 120

                      let statusColor = "border-border"
                      let bgColor = "bg-card"
                      let statusText = "Available"

                      if (table.isOccupied) {
                        statusColor = "border-destructive"
                        bgColor = "bg-destructive/20"
                        statusText = "Occupied"
                      } else if (hasUrgentBooking) {
                        statusColor = "border-destructive border-2"
                        bgColor = "bg-destructive/30"
                        statusText = `Booked ${minutesUntilNext}m`
                      } else if (hasBookingSoon) {
                        statusColor = "border-orange-500 border-2"
                        bgColor = "bg-orange-500/20"
                        statusText = `Booked ${minutesUntilNext}m`
                      } else {
                        statusColor = "border-accent"
                        bgColor = "bg-accent/20"
                        statusText = "Free"
                      }
                      
                      if (isSelected) {
                        statusColor = "border-primary border-2"
                        bgColor = "bg-primary/30"
                      }
                      
                      return (
                        <Button
                          key={table.id}
                          size="sm"
                          variant="outline"
                          disabled={!canSelect}
                          className={cn(
                            "h-full py-2 transition-all relative",
                            bgColor,
                            statusColor,
                            canSelect && "hover:bg-muted cursor-pointer",
                            !canSelect && "opacity-60 cursor-not-allowed",
                            isSelected && "ring-1 ring-primary"
                          )}
                          onClick={() => {
                            if (canSelect) {
                              setSelectedTableIds(prev => 
                                prev.includes(table.id)
                                  ? prev.filter(id => id !== table.id)
                                  : [...prev, table.id]
                              )
                            }
                          }}
                        >
                          <div className="w-full h-full flex flex-col items-center justify-center relative">
                            {/* Warning indicator for urgent bookings */}
                            {hasUrgentBooking && (
                              <div className="absolute -top-1 -right-1">
                                <AlertTriangle className="h-3 w-3 text-destructive fill-current" />
                              </div>
                            )}
                            
                            <div className="font-bold text-xs">
                              T{table.table_number}
                            </div>
                            <div className="text-xs">
                              {table.max_capacity}p
                            </div>
                            <div className="text-xs font-medium mt-0.5">
                              {statusText}
                            </div>
                            
                            {/* Show next booking time if exists */}
                            {nextBooking && (
                              <div className="text-xs mt-0.5 opacity-75">
                                {format(new Date(nextBooking.booking_time), 'h:mm')}
                              </div>
                            )}
                          </div>
                        </Button>
                      )
                    }

                    const getSectionLabel = (sectionId: string) => {
                      if (sectionId === 'no-section') return 'Unassigned Tables'
                      const section = restaurantSections.find(s => s.id === sectionId)
                      return section?.name || 'Unknown Section'
                    }

                    const getSectionIcon = (sectionId: string) => {
                      if (sectionId === 'no-section') return null
                      const section = restaurantSections.find(s => s.id === sectionId)
                      // You could add section-specific icons based on section.name or section.type
                      return null
                    }

                    return (
                      <div className="space-y-3">
                        {/* Available tables by section */}
                        {Object.entries(availableTablesBySection)
                          .sort(([sectionA], [sectionB]) => {
                            // Sort sections by display order, with unassigned last
                            if (sectionA === 'no-section') return 1
                            if (sectionB === 'no-section') return -1
                            
                            const sectionAData = restaurantSections.find(s => s.id === sectionA)
                            const sectionBData = restaurantSections.find(s => s.id === sectionB)
                            
                            return (sectionAData?.display_order || 999) - (sectionBData?.display_order || 999)
                          })
                          .map(([sectionId, sectionTables]) => (
                            <div key={sectionId} className="space-y-1">
                              <div className="flex items-center gap-2">
                                <h4 className="text-xs font-medium text-muted-foreground">
                                  {getSectionLabel(sectionId)} ({sectionTables.length})
                                </h4>
                                <div className="flex-1 h-px bg-border" />
                              </div>
                              <div className="grid grid-cols-2 gap-2">
                                {sectionTables
                                  .sort((a: any, b: any) => a.table_number - b.table_number)
                                  .map(renderTableButton)}
                              </div>
                            </div>
                          ))}

                        {/* Tables with upcoming bookings */}
                        {tablesWithUpcomingBookings.length > 0 && (
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <h4 className="text-xs font-medium text-orange-600">
                                <Clock className="h-3 w-3 inline mr-1" />
                                Available - Booked Soon ({tablesWithUpcomingBookings.length})
                              </h4>
                              <div className="flex-1 h-px bg-border" />
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                              {tablesWithUpcomingBookings
                                .sort((a: any, b: any) => a.table_number - b.table_number)
                                .map(renderTableButton)}
                            </div>
                          </div>
                        )}

                        {/* Occupied tables */}
                        {occupiedTables.length > 0 && (
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <h4 className="text-xs font-medium text-muted-foreground opacity-60">
                                <UserCheck className="h-3 w-3 inline mr-1" />
                                Occupied ({occupiedTables.length})
                              </h4>
                              <div className="flex-1 h-px bg-border opacity-30" />
                            </div>
                            <div className="grid grid-cols-2 gap-2 opacity-60">
                              {occupiedTables
                                .sort((a: any, b: any) => a.table_number - b.table_number)
                                .map(renderTableButton)}
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })()}
                </div>
                )}

                {/* Capacity warning */}
                {!isSharedBookingMode && selectedTableIds.length > 0 && (() => {
                  const totalCapacity = selectedTableIds.reduce((sum, id) => {
                    const table = tableStatus.find(t => t.id === id)
                    return sum + (table?.max_capacity || 0)
                  }, 0)
                  const currentPartySize = typeof walkInData.partySize === 'number' ? walkInData.partySize : (parseInt(walkInData.partySize as string) || 1)
                  const isInsufficient = totalCapacity < currentPartySize

                  if (isInsufficient) {
                    return (
                      <Alert className="border-accent bg-accent/10">
                        <AlertTriangle className="h-4 w-4" />
                        <AlertDescription className="text-xs">
                          <strong>Capacity Warning:</strong> Selected tables can seat {totalCapacity} people,
                          but party size is {currentPartySize}. You can still proceed if needed.
                        </AlertDescription>
                      </Alert>
                    )
                  }
                  return null
                })()}

                {/* Seat button */}
                <Button
                  className="w-full h-8 text-xs font-medium bg-secondary hover:bg-secondary/90 text-secondary-foreground disabled:bg-muted disabled:text-muted-foreground"
                  onClick={handleWalkIn}
                  disabled={
                    !walkInData.partySize || 
                    walkInData.partySize === '' || 
                    (typeof walkInData.partySize === 'number' && walkInData.partySize < 1) ||
                    (isSharedBookingMode ? !selectedSharedTableId : selectedTableIds.length === 0)
                  }
                >
                  {isSharedBookingMode ? (
                    selectedSharedTableId ? (
                      (() => {
                        const table = sharedTablesSummary.find(t => t.table_id === selectedSharedTableId)
                        return `Book ${sharedTableSeatsRequested} seats at Table ${table?.table_number || selectedSharedTableId}`
                      })()
                    ) : (
                      'Select a Shared Table'
                    )
                  ) : (
                    selectedTableIds.length > 0
                      ? `Seat at Table ${selectedTableIds.map(id =>
                          tableStatus.find(t => t.id === id)?.table_number
                        ).join(', ')}`
                      : 'Select a Table'
                  )}
                </Button>
              </div>
            </div>
          </ScrollArea>
        </TabsContent>
      </Tabs>

      {/* Enhanced Table Switch Modal */}
      <Dialog open={tableSwitchModal.show} onOpenChange={(open) => 
        !open && setTableSwitchModal({ 
          show: false, 
          originalTables: [], 
          selectedNewTableIds: [],
          swapOptions: [],
          confirmationStep: false
        })
      }>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-primary">
              <ArrowLeftRight className="h-5 w-5" />
              Smart Table Management
            </DialogTitle>
            <DialogDescription>
              {tableSwitchModal.booking && (
                <>
                  Managing tables for <span className="font-semibold">
                    {tableSwitchModal.booking.user?.full_name || tableSwitchModal.booking.guest_name}
                  </span> (Party of {tableSwitchModal.booking.party_size})
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          {tableSwitchModal.booking && !tableSwitchModal.confirmationStep && (
            <div className="space-y-4 py-4">
              {/* Current assignment */}
              {tableSwitchModal.originalTables.length > 0 && (
                <div className="p-3 bg-muted border border-border rounded-lg">
                  <h4 className="font-medium text-foreground mb-2">Current Tables:</h4>
                  <div className="flex gap-2">
                    {tableSwitchModal.originalTables.map(table => (
                      <Badge key={table.id} variant="secondary">
                        Table {table.table_number}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Smart swap options */}
              {tableSwitchModal.swapOptions.length > 0 && (
                <div className="space-y-3">
                  <h4 className="font-medium text-foreground">Recommended Options:</h4>
                  {tableSwitchModal.swapOptions.map((option, index) => (
                    <div
                      key={index}
                      className={cn(
                        "p-4 rounded-lg border-2 cursor-pointer transition-all",
                        tableSwitchModal.selectedOption === option
                          ? "border-primary bg-primary/10"
                          : "border-border hover:border-border"
                      )}
                      onClick={() => setTableSwitchModal(prev => ({ 
                        ...prev, 
                        selectedOption: option 
                      }))}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            {option.type === 'empty' && <Unlock className="h-4 w-4 text-green-600" />}
                            {option.type === 'swap' && <ArrowLeftRight className="h-4 w-4 text-primary" />}
                            {option.type === 'combination' && <GitMerge className="h-4 w-4 text-accent-foreground" />}
                            <span className="font-medium">
                              {option.type === 'empty' && (option.targetBooking ? 'Reassign Tables' : 'Direct Assignment')}
                              {option.type === 'swap' && 'True Table Swap'}
                              {option.type === 'combination' && 'Table Combination'}
                            </span>
                            {option.isPredefined && (
                              <Badge className="text-xs bg-primary text-primary-foreground">
                                Approved
                              </Badge>
                            )}
                          </div>
                          
                          <div className="text-sm text-muted-foreground mb-2">
                            Tables: {option.tables.map(t => t.table_number).join(', ')}
                          </div>
                          
                          {option.benefits.length > 0 && (
                            <div className="space-y-1 mb-2">
                              {option.benefits.map((benefit, i) => (
                                <div key={i} className="flex items-start gap-1.5 text-xs text-green-700">
                                  <CheckCircle className="h-3 w-3 mt-0.5" />
                                  <span>{benefit}</span>
                                </div>
                              ))}
                            </div>
                          )}
                          
                          {option.warnings.length > 0 && (
                            <div className="space-y-1">
                              {option.warnings.map((warning, i) => (
                                <div key={i} className="flex items-start gap-1.5 text-xs text-amber-700">
                                  <AlertTriangle className="h-3 w-3 mt-0.5" />
                                  <span>{warning}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                        
                        <div className="ml-4">
                          <div className="text-center">
                            <div className="text-2xl font-bold text-foreground">
                              {option.confidence}%
                            </div>
                            <div className="text-xs text-muted-foreground">Confidence</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Manual table selection */}
              <div>
                <h4 className="font-medium text-foreground mb-3">Or Select Manually:</h4>
                <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 gap-2">
                  {tableStatus
                    .filter(t => t.is_active && !t.isOccupied)
                    .map(table => {
                      const isSelected = tableSwitchModal.selectedNewTableIds.includes(table.id)
                      return (
                        <Button
                          key={table.id}
                          size="sm"
                          variant={isSelected ? "default" : "outline"}
                          className="h-auto py-2"
                          onClick={() => {
                            setTableSwitchModal(prev => ({
                              ...prev,
                              selectedNewTableIds: isSelected
                                ? prev.selectedNewTableIds.filter(id => id !== table.id)
                                : [...prev.selectedNewTableIds, table.id],
                              selectedOption: undefined
                            }))
                          }}
                        >
                          <div className="text-center">
                            <div className="font-bold">T{table.table_number}</div>
                            <div className="text-xs">{table.max_capacity}</div>
                          </div>
                        </Button>
                      )
                    })}
                </div>
              </div>
            </div>
          )}

          {/* Confirmation step */}
          {tableSwitchModal.confirmationStep && tableSwitchModal.selectedOption && (
            <div className="py-4">
              <Alert className="mb-4">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  {tableSwitchModal.selectedOption.type === 'swap' 
                    ? 'This will swap tables between two active bookings. Both parties will be notified.'
                    : 'Please confirm the table assignment.'}
                </AlertDescription>
              </Alert>
              
              <div className="space-y-3">
                <div className="p-3 bg-muted rounded-lg">
                  <p className="text-sm font-medium text-foreground">Action Summary:</p>
                  <div className="mt-2 space-y-1 text-sm text-muted-foreground">
                    {tableSwitchModal.selectedOption.benefits.map((benefit, i) => (
                      <div key={i}>• {benefit}</div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setTableSwitchModal({ 
                show: false, 
                originalTables: [], 
                selectedNewTableIds: [],
                swapOptions: [],
                confirmationStep: false
              })}
            >
              Cancel
            </Button>
            
            {!tableSwitchModal.confirmationStep ? (
              <Button
                onClick={() => {
                  if (tableSwitchModal.selectedOption) {
                    setTableSwitchModal(prev => ({ ...prev, confirmationStep: true }))
                  } else if (tableSwitchModal.selectedNewTableIds.length > 0) {
                    handleTableSwitchConfirm()
                  }
                }}
                disabled={!tableSwitchModal.selectedOption && tableSwitchModal.selectedNewTableIds.length === 0}
                className="bg-primary hover:bg-primary/90"
              >
                {tableSwitchModal.selectedOption ? 'Review' : 'Assign Tables'}
              </Button>
            ) : (
              <Button
                onClick={handleTableSwitchConfirm}
                className="bg-accent hover:bg-accent/80 text-accent-foreground"
              >
                <CheckCircle className="h-4 w-4 mr-2" />
                Confirm Changes
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Walk-in Confirmation Dialogs */}
      <Dialog open={walkInConfirmation.show} onOpenChange={(open) =>
        !open && setWalkInConfirmation({
          show: false,
          type: null,
          conflictingReservations: [],
          selectedTables: [],
          walkInData: null
        })
      }>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-accent-foreground" />
              {walkInConfirmation.type === 'upcoming_reservations'
                ? 'Table Has Upcoming Reservations'
                : 'Confirm Table Assignment'
              }
            </DialogTitle>
            <DialogDescription>
              {walkInConfirmation.type === 'upcoming_reservations'
                ? 'IMPORTANT: This will seat walk-ins at tables with confirmed reservations. Both parties must be managed carefully to avoid conflicts.'
                : (() => {
                    const totalCapacity = walkInConfirmation.selectedTables.reduce((sum: number, table: any) =>
                      sum + (table?.max_capacity || 0), 0)
                    const partySize = walkInConfirmation.walkInData?.party_size || 0
                    const hasCapacityIssue = totalCapacity < partySize

                    if (hasCapacityIssue) {
                      return `The selected tables can seat ${totalCapacity} people, but the party size is ${partySize}. Please confirm if you want to proceed.`
                    } else if (walkInConfirmation.selectedTables.length > 1) {
                      return 'You are seating a large party across multiple tables. Please confirm this arrangement.'
                    } else {
                      return 'Please confirm the table assignment for this large party.'
                    }
                  })()
              }
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            {walkInConfirmation.type === 'upcoming_reservations' && (
              <div className="space-y-3">
                <Alert className="border-destructive bg-destructive/10">
                  <AlertTriangle className="h-4 w-4 text-destructive" />
                  <AlertDescription>
                    <strong className="text-destructive">⚠️ BOOKING CONFLICT WARNING</strong>
                    <p className="text-sm mt-1 text-muted-foreground">
                      You are seating a walk-in at tables with confirmed reservations. The walk-in guests MUST vacate these tables before the booking arrives.
                    </p>
                  </AlertDescription>
                </Alert>

                <div className="space-y-3">
                  <h4 className="font-medium text-sm text-destructive">Upcoming Reservations to Reassign:</h4>
                  {walkInConfirmation.conflictingReservations.map((reservation, index) => {
                    const minutesUntilArrival = differenceInMinutes(new Date(reservation.booking_time), currentTime)
                    const isUrgent = minutesUntilArrival <= 60
                    
                    return (
                      <div key={index} className={cn(
                        "p-3 rounded-lg border-2",
                        isUrgent 
                          ? "border-destructive bg-destructive/5" 
                          : "border-accent bg-accent/5"
                      )}>
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <p className="font-medium text-sm">
                                {reservation.guest_name || reservation.user?.full_name || 'Anonymous'}
                              </p>
                              {isUrgent && (
                                <Badge className="bg-destructive text-destructive-foreground text-xs px-1 py-0">
                                  URGENT
                                </Badge>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground mb-2">
                              Table {reservation.table.table_number} • Arriving at {format(new Date(reservation.booking_time), 'h:mm a')}
                            </p>
                            <div className={cn(
                              "text-xs font-medium px-2 py-1 rounded inline-block",
                              isUrgent 
                                ? "bg-destructive/20 text-destructive" 
                                : "bg-accent/20 text-accent-foreground"
                            )}>
                              {minutesUntilArrival > 0 
                                ? `Arrives in ${minutesUntilArrival} minutes` 
                                : `${Math.abs(minutesUntilArrival)} minutes overdue`}
                            </div>
                          </div>
                          <div className="text-right">
                            <Badge variant="outline" className="text-xs mb-1">
                              {reservation.party_size}p
                            </Badge>
                            <div className="text-xs text-muted-foreground">
                              Will be reassigned
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
                
                <Alert className="border-accent bg-accent/10">
                  <Info className="h-4 w-4 text-accent-foreground" />
                  <AlertDescription>
                    <strong>Host Action Required:</strong>
                    <ul className="text-sm mt-1 space-y-1 list-disc list-inside">
                      <li>Notify walk-in guests about table time limits</li>
                      <li>Find alternative tables for arriving bookings</li>
                      <li>Set reminders to check on both parties</li>
                    </ul>
                  </AlertDescription>
                </Alert>
              </div>
            )}

            {walkInConfirmation.type === 'multi_table' && (
              <div className="space-y-3">
                {(() => {
                  const totalCapacity = walkInConfirmation.selectedTables.reduce((sum: number, table: any) =>
                    sum + (table?.max_capacity || 0), 0)
                  const partySize = walkInConfirmation.walkInData?.party_size || 0
                  const hasCapacityIssue = totalCapacity < partySize

                  return (
                    <Alert className={hasCapacityIssue ? "border-accent bg-accent/10" : "border-primary bg-primary/10"}>
                      {hasCapacityIssue ? <AlertTriangle className="h-4 w-4" /> : <Users className="h-4 w-4" />}
                      <AlertDescription>
                        <strong>{hasCapacityIssue ? 'Capacity Warning:' : 'Large Party Setup:'}</strong>
                      </AlertDescription>
                    </Alert>
                  )
                })()}

                <div className="p-3 bg-muted rounded-lg border border-border">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-sm">Party Details:</span>
                    <Badge className="bg-primary text-primary-foreground">
                      {walkInConfirmation.walkInData?.party_size}p
                    </Badge>
                  </div>
                  <div className="text-sm text-muted-foreground space-y-1">
                    <p>Guest: {walkInConfirmation.walkInData?.guest_name}</p>
                    <p>Tables: {walkInConfirmation.selectedTables.map((t: any) => `T${t.table_number} (${t.max_capacity}p)`).join(', ')}</p>
                    <p>Total Capacity: {walkInConfirmation.selectedTables.reduce((sum: number, table: any) =>
                      sum + (table?.max_capacity || 0), 0)} people</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setWalkInConfirmation({
                show: false,
                type: null,
                conflictingReservations: [],
                selectedTables: [],
                walkInData: null
              })}
            >
              Cancel
            </Button>
            <Button
              onClick={proceedWithWalkIn}
              className="bg-accent hover:bg-accent/80 text-accent-foreground"
            >
              <AlertTriangle className="h-4 w-4 mr-2" />
              {walkInConfirmation.type === 'upcoming_reservations'
                ? 'Seat Walk-In & Reassign Bookings'
                : 'Confirm Seating'
              }
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add/Use customer prompt for walk-ins */}
      <Dialog
        open={showAddCustomerPrompt}
        onOpenChange={(open) => {
          if (!open) {
            // Treat closing as skipping adding a customer
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
              This walk-in has guest info. You can save them as a customer for future use, or select an existing similar customer.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-lg border border-border p-4">
              <p className="text-sm text-muted-foreground mb-2 font-medium">Guest details</p>
              <div className="text-sm">
                <div><span className="text-muted-foreground">Name:</span> {pendingGuestDetails?.name || "—"}</div>
                <div><span className="text-muted-foreground">Email:</span> {pendingGuestDetails?.email || "—"}</div>
                <div><span className="text-muted-foreground">Phone:</span> {pendingGuestDetails?.phone || "—"}</div>
              </div>
            </div>

            <div className="rounded-lg border border-border p-4">
              <p className="text-sm text-muted-foreground mb-3 font-medium">Similar existing customers</p>
              {similarLoading && (
                <p className="text-sm text-muted-foreground">Searching…</p>
              )}
              {similarError && (
                <p className="text-sm text-destructive">Failed to search similar customers</p>
              )}
              {!similarLoading && !similarError && (similarCustomers?.length || 0) === 0 && (
                <p className="text-sm text-muted-foreground">No similar customers found</p>
              )}
              {!similarLoading && !similarError && (similarCustomers?.length || 0) > 0 && (
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {similarCustomers?.map((c: any) => (
                    <div key={c.id} className="flex items-center justify-between gap-4 p-3 rounded-md border border-border">
                      <div className="min-w-0">
                        <div className="font-medium truncate">
                          {c.profile?.full_name || c.guest_name || "Guest"}
                        </div>
                        <div className="text-sm text-muted-foreground truncate">
                          {(c.guest_email || c.profile?.email) && <span>{c.guest_email || c.profile?.email}</span>}
                          {(c.guest_email || c.profile?.email) && (c.profile?.phone_number || c.guest_phone) && <span> • </span>}
                          {(c.profile?.phone_number || c.guest_phone) && <span>{c.profile?.phone_number || c.guest_phone}</span>}
                        </div>
                      </div>
                      <Button type="button" size="sm" onClick={() => finalizeWalkInWithCustomer(c)}>
                        Use this
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          <DialogFooter className="sm:justify-between">
            <div className="text-sm text-muted-foreground">You can also skip and only create the walk-in booking.</div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={handleSkipAddingCustomer} disabled={isAddingCustomer}>
                Skip
              </Button>
              <Button type="button" onClick={handleAddNewCustomer} disabled={isAddingCustomer}>
                {isAddingCustomer ? "Adding…" : "Add as new customer"}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}