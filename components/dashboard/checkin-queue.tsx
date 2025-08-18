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
  Users
} from "lucide-react"
import { toast } from "react-hot-toast"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { TableStatusService, type DiningStatus } from "@/lib/table-status"

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
  const [walkInData, setWalkInData] = useState({
    guestName: "",
    guestPhone: "",
    partySize: 2,
    estimatedDuration: 120,
    preferences: [] as string[]
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

  // Advanced settings
  const [advancedMode, setAdvancedMode] = useState(false)
  const [autoSuggestEnabled, setAutoSuggestEnabled] = useState(true)
  const [showDetailedInfo, setShowDetailedInfo] = useState(false)

  const supabase = createClient()
  const queryClient = useQueryClient()
  const tableStatusService = useMemo(() => new TableStatusService(), [])

  // Get current user for status updates
  const [userId, setUserId] = useState<string>("")
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setUserId(user.id)
    })
  }, [supabase])

  // Fetch table combinations with enhanced filtering
  const { data: tableCombinations = [], isLoading: combinationsLoading } = useTableCombinations(restaurantId)

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
      const presentStatuses = ['arrived', 'seated', 'ordered', 'appetizers', 'main_course', 'dessert', 'payment']
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
      if (!['seated', 'ordered', 'appetizers', 'main_course', 'dessert'].includes(targetBooking.status)) {
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
        ['ordered', 'appetizers', 'main_course', 'dessert'].includes(b.status)
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
          const occupiedStatuses = ['arrived', 'seated', 'ordered', 'appetizers', 'main_course', 'dessert', 'payment']
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

  // Filter and categorize bookings
  const categorizedBookings = useMemo(() => {
    const arrivals = bookings.filter(booking => {
      const bookingTime = new Date(booking.booking_time)
      const minutesUntil = differenceInMinutes(bookingTime, currentTime)
      return booking.status === 'confirmed' &&
             minutesUntil >= -30 && minutesUntil <= 60
    }).sort((a, b) => new Date(a.booking_time).getTime() - new Date(b.booking_time).getTime())

    // Active dining guests
    const activeDining = bookings.filter(b =>
      ['seated', 'ordered', 'appetizers', 'main_course', 'dessert', 'payment'].includes(b.status)
    ).sort((a, b) => {
      // Sort by status progression, then by booking time
      const statusOrder = { seated: 1, ordered: 2, appetizers: 3, main_course: 4, dessert: 5, payment: 6 }
      const aOrder = statusOrder[b.status as keyof typeof statusOrder] || 0
      const bOrder = statusOrder[b.status as keyof typeof statusOrder] || 0
      if (aOrder !== bOrder) return aOrder - bOrder
      return new Date(a.booking_time).getTime() - new Date(b.booking_time).getTime()
    })

    return {
      activeDining,
      waitingForSeating: bookings.filter(b => b.status === 'arrived'),
      lateArrivals: arrivals.filter(b => {
        const minutesUntil = differenceInMinutes(new Date(b.booking_time), currentTime)
        return minutesUntil < -15
      }),
      currentArrivals: arrivals.filter(b => {
        const minutesUntil = differenceInMinutes(new Date(b.booking_time), currentTime)
        return minutesUntil >= -15 && minutesUntil <= 15
      }),
      upcomingArrivals: arrivals.filter(b => {
        const minutesUntil = differenceInMinutes(new Date(b.booking_time), currentTime)
        return minutesUntil > 15
      }),
      needingTables: bookings.filter(b =>
        b.status === 'confirmed' && (!b.tables || b.tables.length === 0)
      ),
      vipArrivals: arrivals.filter(b => {
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
    if (selectedTableIds.length === 0) {
      toast.error("Please select at least one table")
      return
    }

    const walkInBooking = {
      customer_id: selectedCustomer?.id || null,
      user_id: selectedCustomer?.user_id || null,
      guest_name: selectedCustomer 
        ? (selectedCustomer.profile?.full_name || selectedCustomer.guest_name)
        : (walkInData.guestName.trim() || `Walk-in ${format(currentTime, 'HH:mm')}`),
      guest_phone: selectedCustomer 
        ? (selectedCustomer.profile?.phone_number || selectedCustomer.guest_phone)
        : walkInData.guestPhone,
      guest_email: selectedCustomer?.guest_email || null,
      party_size: walkInData.partySize,
      table_ids: selectedTableIds,
      booking_time: currentTime.toISOString(),
      turn_time_minutes: walkInData.estimatedDuration,
      status: 'arrived',
      table_preferences: walkInData.preferences
    }

    onQuickSeat(walkInBooking, selectedTableIds)
    
    const tableNumbers = selectedTableIds
      .map(id => tableStatus.find(t => t.id === id)?.table_number)
      .filter(Boolean)
      .join(', ')
    
    toast.success(
      <div>
        <p className="font-medium">Walk-in Seated</p>
        <p className="text-sm mt-1">{walkInBooking.guest_name} → Table {tableNumbers}</p>
      </div>,
      { duration: 3000 }
    )
    
    // Reset form
    setWalkInData({ guestName: "", guestPhone: "", partySize: 2, estimatedDuration: 120, preferences: [] })
    setSelectedTableIds([])
    setSelectedCustomer(null)
    setCustomerSearch("")
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
              {hasTable && (
                <span className="text-secondary-foreground text-xs">
                  T{booking.tables.map((t: any) => t.table_number).join(",")}
                </span>
              )}
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
    appetizers: Utensils,
    main_course: Utensils,
    dessert: Coffee,
    payment: CreditCard
  }

  // Status colors mapping using brand colors
  const STATUS_COLORS = {
    seated: "text-primary bg-primary/10 border-primary/30",
    ordered: "text-accent-foreground bg-accent/20 border-accent/40",
    appetizers: "text-secondary-foreground bg-secondary/30 border-secondary/50",
    main_course: "text-muted-foreground bg-muted/50 border-border",
    dessert: "text-accent-foreground bg-accent/30 border-accent/50",
    payment: "text-primary bg-primary/20 border-primary/40"
  }

  const renderDiningCard = (booking: any) => {
    const hasTable = booking.tables && booking.tables.length > 0
    const customerData = booking.user?.id ? customersData[booking.user.id] : null
    const StatusIcon = STATUS_ICONS[booking.status as keyof typeof STATUS_ICONS] || Activity
    const statusColor = STATUS_COLORS[booking.status as keyof typeof STATUS_COLORS] || "text-muted-foreground bg-muted/30 border-border"

    // Calculate dining progress and time
    const progress = TableStatusService.getDiningProgress(booking.status as DiningStatus)
    const bookingTime = new Date(booking.booking_time)
    const elapsedMinutes = differenceInMinutes(currentTime, bookingTime)
    const estimatedTotal = booking.turn_time_minutes || 120
    const remainingMinutes = Math.max(0, estimatedTotal - elapsedMinutes)

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
              {hasTable && (
                <span className="text-secondary-foreground">
                  T{booking.tables.map((t: any) => t.table_number).join(",")}
                </span>
              )}
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

          {/* Compact button with icon + text */}
          <div className="flex-shrink-0">
            {nextTransition && (
              <Button
                size="sm"
                onClick={(e) => {
                  e.stopPropagation()
                  handleStatusUpdate(booking.id, nextTransition.to)
                }}
                className="bg-accent hover:bg-accent/80 text-accent-foreground px-1.5 py-0.5 h-5 text-xs flex items-center gap-0.5"
              >
                <Play className="h-2.5 w-2.5" />
                Next
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
                    Waiting for Seating
                  </h4>
                  {categorizedBookings.waitingForSeating.map(renderEnhancedBookingCard)}
                </div>
              )}

              {/* VIP Arrivals */}
              {categorizedBookings.vipArrivals.length > 0 && (
                <div className="space-y-1 mt-2">
                  <h4 className="text-xs font-medium text-yellow-400 border-b border-yellow-800 pb-1">
                    VIP Guests
                  </h4>
                  {categorizedBookings.vipArrivals.map(renderEnhancedBookingCard)}
                </div>
              )}

              {/* All other arrivals combined */}
              {[...categorizedBookings.lateArrivals, ...categorizedBookings.currentArrivals, ...categorizedBookings.upcomingArrivals].length > 0 && (
                <div className="space-y-1 mt-2">
                  <h4 className="text-xs font-medium text-muted-foreground border-b border-border pb-1">
                    Arrivals
                  </h4>
                  {[...categorizedBookings.lateArrivals, ...categorizedBookings.currentArrivals, ...categorizedBookings.upcomingArrivals]
                    .sort((a, b) => {
                      const aMinutes = differenceInMinutes(new Date(a.booking_time), currentTime)
                      const bMinutes = differenceInMinutes(new Date(b.booking_time), currentTime)
                      return aMinutes - bMinutes
                    })
                    .map(renderEnhancedBookingCard)
                  }
                </div>
              )}

              {/* Empty state */}
              {(categorizedBookings.lateArrivals.length + 
                categorizedBookings.currentArrivals.length + 
                categorizedBookings.upcomingArrivals.length +
                categorizedBookings.waitingForSeating.length) === 0 && (
                <div className="text-center py-8">
                  <UserCheck className="h-6 w-6 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">No arrivals in the next hour</p>
                </div>
              )}
            </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="walkin" className="flex-1 overflow-hidden mt-1 mx-2 mb-1">
          <ScrollArea className="h-full">
            <div className="space-y-2 pr-2">
              {/* Enhanced tables summary */}
              <div className="p-2 bg-card rounded-lg border border-border">
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
                              <span className="text-white">
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
                    <div className="mt-1 p-1.5 bg-primary/20 rounded text-xs">
                      <span className="text-primary">Selected: </span>
                      <span className="text-foreground font-medium">
                        {selectedCustomer.profile?.full_name || selectedCustomer.guest_name}
                      </span>
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
                      min="1"
                      max="20"
                      value={walkInData.partySize}
                      onChange={(e) => setWalkInData(prev => ({ ...prev, partySize: parseInt(e.target.value) || 1 }))}
                      className="bg-background border-border text-foreground text-xs h-7"
                    />
                  </div>
                </div>

                {/* Table selection */}
                <div>
                  <Label className="text-xs text-foreground mb-1 block">
                    Select Table - {availableTables.length} available
                  </Label>
                  <div className="grid grid-cols-3 gap-1.5">
                    {tableStatus
                      .filter(table => table.is_active)
                      .sort((a, b) => {
                        if (a.isOccupied !== b.isOccupied) {
                          return a.isOccupied ? 1 : -1
                        }
                        return a.table_number - b.table_number
                      })
                      .map(table => {
                        const isSelected = selectedTableIds.includes(table.id)
                        const isAvailable = !table.isOccupied
                        const fitsParty = table.max_capacity >= walkInData.partySize
                        const canSelect = isAvailable && fitsParty
                        
                        const nextBooking = table.upcomingBookings?.[0]
                        const minutesUntilNext = nextBooking ? differenceInMinutes(new Date(nextBooking.booking_time), currentTime) : null
                        
                        let statusColor = "border-border"
                        let bgColor = "bg-card"
                        
                        if (table.isOccupied) {
                          statusColor = "border-destructive"
                          bgColor = "bg-destructive/20"
                        } else if (!fitsParty) {
                          statusColor = "border-secondary"
                          bgColor = "bg-secondary/30"
                        } else if (nextBooking && minutesUntilNext! <= 60) {
                          statusColor = "border-accent"
                          bgColor = "bg-accent/30"
                        } else {
                          statusColor = "border-accent"
                          bgColor = "bg-accent/20"
                        }
                        
                        if (isSelected) {
                          statusColor = "border-primary"
                          bgColor = "bg-primary/20"
                        }
                        
                        return (
                          <Button
                            key={table.id}
                            size="sm"
                            variant="outline"
                            disabled={!canSelect}
                            className={cn(
                              "h-10 p-1 transition-all relative",
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
                            <div className="w-full h-full flex flex-col items-center justify-center">
                              <div className="font-bold text-xs text-white">
                                T{table.table_number}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {table.max_capacity}p
                              </div>
                            </div>
                          </Button>
                        )
                      })}
                  </div>
                </div>

                {/* Seat button */}
                <Button
                  className="w-full h-8 text-xs font-medium bg-secondary hover:bg-secondary/90 text-secondary-foreground disabled:bg-muted disabled:text-muted-foreground"
                  onClick={handleWalkIn}
                  disabled={selectedTableIds.length === 0}
                >
                  {selectedTableIds.length > 0 
                    ? `Seat at Table ${selectedTableIds.map(id => 
                        tableStatus.find(t => t.id === id)?.table_number
                      ).join(', ')}`
                    : 'Select a Table'
                  }
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
        <DialogContent className="max-w-3xl">
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
    </div>
  )
}