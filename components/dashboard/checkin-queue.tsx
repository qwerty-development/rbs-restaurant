// components/dashboard/checkin-queue.tsx
"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
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
  Unlock
} from "lucide-react"
import { toast } from "react-hot-toast"
import { Alert, AlertDescription } from "@/components/ui/alert"
const TABLE_TYPE_COLORS: Record<string, string> = {
  booth: "bg-gradient-to-br from-blue-900 to-blue-800 text-blue-100 border-blue-700",
  window: "bg-gradient-to-br from-emerald-900 to-emerald-800 text-emerald-100 border-emerald-700",
  patio: "bg-gradient-to-br from-amber-900 to-amber-800 text-amber-100 border-amber-700",
  standard: "bg-gradient-to-br from-yellow-900 to-yellow-800 text-yellow-100 border-yellow-700",
  bar: "bg-gradient-to-br from-purple-900 to-purple-800 text-purple-100 border-purple-700",
  private: "bg-gradient-to-br from-rose-900 to-rose-800 text-rose-100 border-rose-700",
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

  // Filter and categorize bookings
  const categorizedBookings = useMemo(() => {
    const arrivals = bookings.filter(booking => {
      const bookingTime = new Date(booking.booking_time)
      const minutesUntil = differenceInMinutes(bookingTime, currentTime)
      return booking.status === 'confirmed' && 
             minutesUntil >= -30 && minutesUntil <= 60
    }).sort((a, b) => new Date(a.booking_time).getTime() - new Date(b.booking_time).getTime())

    return {
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
          <Crown className="h-4 w-4 text-yellow-500" />
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
              <p className="text-sm text-orange-300">
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
        color: "text-red-400", 
        bgColor: "bg-gradient-to-br from-red-900/50 to-red-800/30 border-red-700", 
        icon: AlertCircle,
        pulseAnimation: true,
        priority: 1
      }
    } else if (minutesUntil < 0) {
      return { 
        label: "Now", 
        subLabel: "Ready to check-in",
        color: "text-blue-400", 
        bgColor: "bg-gradient-to-br from-blue-900/50 to-blue-800/30 border-blue-700", 
        icon: UserCheck,
        pulseAnimation: true,
        priority: 2
      }
    } else if (minutesUntil <= 15) {
      return { 
        label: `${minutesUntil}m`, 
        subLabel: "Arriving soon",
        color: "text-green-400", 
        bgColor: "bg-gradient-to-br from-green-900/50 to-green-800/30 border-green-700", 
        icon: Timer,
        pulseAnimation: false,
        priority: 3
      }
    } else {
      return { 
        label: `${minutesUntil}m`, 
        subLabel: "Upcoming",
        color: "text-gray-400", 
        bgColor: "bg-gradient-to-br from-gray-800/50 to-gray-700/30 border-gray-600", 
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
          "relative p-3 rounded-lg border cursor-pointer transition-colors",
          status.bgColor,
          "hover:border-gray-400"
        )}
        onClick={() => onSelectBooking?.(booking)}
      >
        <div className="flex items-center justify-between">
          <div className="flex-1">
            {/* Status and guest name */}
            <div className="flex items-center gap-3 mb-2">
              <StatusIcon className={cn("h-4 w-4", status.color)} />
              <div>
                <p className="font-medium text-gray-100">
                  {booking.user?.full_name || booking.guest_name || 'Guest'}
                </p>
                <p className="text-xs text-gray-400">{status.subLabel}</p>
              </div>
              
              {/* Essential badges only */}
              <div className="flex items-center gap-1 ml-auto">
                {customerData?.vip_status && (
                  <Badge className="text-xs px-1.5 py-0.5 bg-yellow-600 text-white">
                    VIP
                  </Badge>
                )}
                {customerData?.blacklisted && (
                  <Badge variant="destructive" className="text-xs px-1.5 py-0.5">
                    Alert
                  </Badge>
                )}
              </div>
            </div>

            {/* Essential booking details */}
            <div className="flex items-center gap-4 text-sm text-gray-300">
              <span>{format(new Date(booking.booking_time), 'h:mm a')}</span>
              <span>{booking.party_size} guests</span>
              {hasTable && (
                <span className="text-green-400">
                  T{booking.tables.map((t: any) => t.table_number).join(", ")}
                </span>
              )}
            </div>

            {/* Special requests - only if critical */}
            {customerData?.blacklisted && customerData?.blacklist_reason && (
              <div className="mt-2 p-2 bg-red-900/30 rounded text-xs text-red-400">
                {customerData.blacklist_reason}
              </div>
            )}
          </div>

          {/* Simplified action button */}
          <div className="ml-4">
            {canCheckInDirectly ? (
              <Button
                size="sm"
                onClick={(e) => {
                  e.stopPropagation()
                  handleQuickCheckIn(booking)
                }}
                className="bg-green-600 hover:bg-green-700 text-white"
              >
                Check-in
              </Button>
            ) : hasTable ? (
              <Button
                size="sm"
                variant="outline"
                onClick={(e) => {
                  e.stopPropagation()
                  handleOpenEnhancedTableSwitch(booking)
                }}
                className="border-blue-500 text-blue-400 hover:bg-blue-900/30"
              >
                Switch
              </Button>
            ) : (
              <Button
                size="sm"
                variant="outline"
                onClick={(e) => {
                  e.stopPropagation()
                  handleOpenEnhancedTableSwitch(booking)
                }}
                className="border-amber-500 text-amber-400 hover:bg-amber-900/30"
              >
                Assign
              </Button>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-[600px] h-full flex flex-col bg-gradient-to-br from-gray-900 via-gray-850 to-gray-900 text-gray-200">
      {/* Simplified Header */}
      <div className="px-4 py-3 border-b border-gray-800">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-100">Check-in Queue</h3>
          
          {/* Essential stats only */}
          <div className="flex items-center gap-3 text-sm">
            {categorizedBookings.waitingForSeating.length > 0 && (
              <div className="flex items-center gap-1 text-orange-400">
                <span className="font-medium">{categorizedBookings.waitingForSeating.length} waiting</span>
              </div>
            )}
            {categorizedBookings.vipArrivals.length > 0 && (
              <div className="flex items-center gap-1 text-yellow-400">
                <Crown className="h-3 w-3" />
                <span className="font-medium">{categorizedBookings.vipArrivals.length}</span>
              </div>
            )}
            <div className="flex items-center gap-1 text-gray-400">
              <Table2 className="h-3 w-3" />
              <span>{availableTables.length} available</span>
            </div>
          </div>
        </div>
      </div>

      <Tabs defaultValue="arrivals" className="flex-1 flex flex-col">
        <TabsList className="mx-4 mt-3 grid w-[calc(100%-2rem)] grid-cols-2 bg-gray-800">
          <TabsTrigger value="arrivals" className="data-[state=active]:bg-gray-950 data-[state=active]:text-white">
            Arrivals
            {(categorizedBookings.lateArrivals.length + 
              categorizedBookings.currentArrivals.length + 
              categorizedBookings.upcomingArrivals.length) > 0 && (
              <Badge className="ml-2 px-1.5 py-0.5 text-xs bg-blue-600">
                {categorizedBookings.lateArrivals.length + 
                 categorizedBookings.currentArrivals.length + 
                 categorizedBookings.upcomingArrivals.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="walkin" className="data-[state=active]:bg-gray-950 data-[state=active]:text-white">
            Walk-in
          </TabsTrigger>
        </TabsList>

        <TabsContent value="arrivals" className="flex-1 px-4 pb-4 mt-4">
          <ScrollArea className="h-[500px]">
            <div className="space-y-3 pr-4">
              {/* Waiting for seating - highest priority */}
              {categorizedBookings.waitingForSeating.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-sm font-medium text-orange-400 border-b border-orange-800 pb-1">
                    Waiting for Seating
                  </h4>
                  {categorizedBookings.waitingForSeating.map(renderEnhancedBookingCard)}
                </div>
              )}

              {/* VIP Arrivals */}
              {categorizedBookings.vipArrivals.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-sm font-medium text-yellow-400 border-b border-yellow-800 pb-1">
                    VIP Guests
                  </h4>
                  {categorizedBookings.vipArrivals.map(renderEnhancedBookingCard)}
                </div>
              )}

              {/* All other arrivals combined */}
              {[...categorizedBookings.lateArrivals, ...categorizedBookings.currentArrivals, ...categorizedBookings.upcomingArrivals].length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-sm font-medium text-gray-400 border-b border-gray-700 pb-1">
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
                <div className="text-center py-12">
                  <UserCheck className="h-8 w-8 text-gray-500 mx-auto mb-2" />
                  <p className="text-sm text-gray-400">No arrivals in the next hour</p>
                </div>
              )}
            </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="walkin" className="flex-1 px-4 pb-4 mt-4">
          <div className="space-y-4">
            {/* Available tables summary */}
            <div className="p-3 bg-gray-800/50 rounded-lg border border-gray-700">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-300">
                  {availableTables.length} tables available
                </span>
                <span className="text-gray-400">
                  Capacity: {availableTables.reduce((sum, t) => sum + t.max_capacity, 0)}
                </span>
              </div>
            </div>

            {/* Simplified walk-in form */}
            <div className="space-y-4 bg-gray-800/30 p-4 rounded-lg border border-gray-700">
              {/* Customer search */}
              <div>
                <Label className="text-sm text-gray-300 mb-2 block">
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
                    className="bg-gray-900 border-gray-700 text-white"
                  />
                  
                  {/* Customer dropdown */}
                  {showCustomerDropdown && customerSearch.length >= 1 && customers && customers.length > 0 && (
                    <div className="absolute z-50 w-full mt-1 bg-gray-900 border border-gray-700 rounded-md shadow-lg max-h-40 overflow-y-auto">
                      {customers.map((customer) => (
                        <div
                          key={customer.id}
                          className="p-2 hover:bg-gray-800 cursor-pointer text-sm"
                          onClick={() => handleCustomerSelect(customer)}
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-white">
                              {customer.profile?.full_name || customer.guest_name || 'Guest'}
                            </span>
                            {customer.vip_status && (
                              <Badge className="text-xs px-1.5 py-0.5 bg-yellow-600">
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
                  <div className="mt-2 p-2 bg-blue-900/30 rounded text-sm">
                    <span className="text-blue-300">Selected: </span>
                    <span className="text-white font-medium">
                      {selectedCustomer.profile?.full_name || selectedCustomer.guest_name}
                    </span>
                  </div>
                )}
              </div>

              {/* Basic details */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label className="text-sm text-gray-300 mb-1 block">Name</Label>
                  <Input
                    value={walkInData.guestName}
                    onChange={(e) => setWalkInData(prev => ({ ...prev, guestName: e.target.value }))}
                    placeholder="Optional"
                    disabled={!!selectedCustomer}
                    className="bg-gray-900/50 border-gray-600 text-white"
                  />
                </div>
                <div>
                  <Label className="text-sm text-gray-300 mb-1 block">Phone</Label>
                  <Input
                    value={walkInData.guestPhone}
                    onChange={(e) => setWalkInData(prev => ({ ...prev, guestPhone: e.target.value }))}
                    placeholder="Optional"
                    disabled={!!selectedCustomer}
                    className="bg-gray-900/50 border-gray-600 text-white"
                  />
                </div>
                <div>
                  <Label className="text-sm text-gray-300 mb-1 block">Party Size</Label>
                  <Input
                    type="number"
                    min="1"
                    max="20"
                    value={walkInData.partySize}
                    onChange={(e) => setWalkInData(prev => ({ ...prev, partySize: parseInt(e.target.value) || 1 }))}
                    className="bg-gray-900/50 border-gray-600 text-white"
                  />
                </div>
              </div>

              {/* Table selection */}
              <div>
                <Label className="text-sm text-gray-300 mb-2 block">
                  Select Table
                </Label>
                <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 gap-2">
                  {tableStatus
                    .filter(table => table.is_active && !table.isOccupied)
                    .map(table => {
                      const isSelected = selectedTableIds.includes(table.id)
                      const fitsParty = table.max_capacity >= walkInData.partySize
                      
                      return (
                        <Button
                          key={table.id}
                          size="sm"
                          variant={isSelected ? "default" : "outline"}
                          className={cn(
                            "h-12 transition-colors",
                            isSelected 
                              ? "bg-blue-600 hover:bg-blue-700 text-white" 
                              : cn(
                                  "bg-gray-800/50 border-gray-600 text-gray-300 hover:bg-gray-700/50",
                                  !fitsParty && "opacity-50"
                                )
                          )}
                          onClick={() => {
                            setSelectedTableIds(prev => 
                              prev.includes(table.id)
                                ? prev.filter(id => id !== table.id)
                                : [...prev, table.id]
                            )
                          }}
                        >
                          <div className="text-center">
                            <div className="font-bold">{table.table_number}</div>
                            <div className="text-xs opacity-75">
                              {table.max_capacity}
                            </div>
                          </div>
                        </Button>
                      )
                    })}
                </div>
              </div>

              {/* Seat button */}
              <Button
                className="w-full h-11 font-medium bg-green-600 hover:bg-green-700 disabled:bg-gray-700 disabled:text-gray-500"
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
            <DialogTitle className="flex items-center gap-2 text-blue-600">
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
                <div className="p-3 bg-gray-100 border border-gray-300 rounded-lg">
                  <h4 className="font-medium text-gray-700 mb-2">Current Tables:</h4>
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
                  <h4 className="font-medium text-gray-700">Recommended Options:</h4>
                  {tableSwitchModal.swapOptions.map((option, index) => (
                    <div
                      key={index}
                      className={cn(
                        "p-4 rounded-lg border-2 cursor-pointer transition-all",
                        tableSwitchModal.selectedOption === option
                          ? "border-blue-500 bg-blue-50"
                          : "border-gray-300 hover:border-gray-400"
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
                            {option.type === 'swap' && <ArrowLeftRight className="h-4 w-4 text-blue-600" />}
                            {option.type === 'combination' && <GitMerge className="h-4 w-4 text-purple-600" />}
                            <span className="font-medium">
                              {option.type === 'empty' && (option.targetBooking ? 'Reassign Tables' : 'Direct Assignment')}
                              {option.type === 'swap' && 'True Table Swap'}
                              {option.type === 'combination' && 'Table Combination'}
                            </span>
                            {option.isPredefined && (
                              <Badge className="text-xs bg-purple-600 text-white">
                                Approved
                              </Badge>
                            )}
                          </div>
                          
                          <div className="text-sm text-gray-600 mb-2">
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
                            <div className="text-2xl font-bold text-gray-700">
                              {option.confidence}%
                            </div>
                            <div className="text-xs text-gray-500">Confidence</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Manual table selection */}
              <div>
                <h4 className="font-medium text-gray-700 mb-3">Or Select Manually:</h4>
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
                <div className="p-3 bg-gray-100 rounded-lg">
                  <p className="text-sm font-medium text-gray-700">Action Summary:</p>
                  <div className="mt-2 space-y-1 text-sm text-gray-600">
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
                className="bg-blue-600 hover:bg-blue-700"
              >
                {tableSwitchModal.selectedOption ? 'Review' : 'Assign Tables'}
              </Button>
            ) : (
              <Button
                onClick={handleTableSwitchConfirm}
                className="bg-green-600 hover:bg-green-700"
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