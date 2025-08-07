// components/dashboard/unified-floor-plan.tsx
"use client"

import React, { useState, useEffect, useRef, useCallback, useMemo } from "react"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { cn } from "@/lib/utils"
import { 
  Table2,
  Users,
  Clock,
  ChefHat,
  AlertCircle,
  CheckCircle,
  Timer,
  CreditCard,
  Coffee,
  Utensils,
  Cake,
  UserCheck,
  Hand,
  Phone,
  MessageSquare,
  AlertTriangle,
  Calendar,
  Eye,
  ChevronRight
} from "lucide-react"
import { format, addMinutes, differenceInMinutes } from "date-fns"
import { TableStatusService, type DiningStatus } from "@/lib/table-status"
// Removed dropdown menu imports - using click-to-show for tablets
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

interface UnifiedFloorPlanProps {
  tables: any[]
  bookings: any[]
  currentTime: Date
  restaurantId: string
  userId: string
  onTableClick?: (table: any, status: any) => void
  onStatusUpdate?: (bookingId: string, newStatus: DiningStatus) => void
  onTableSwitch?: (bookingId: string, newTableIds: string[]) => void
  onCheckIn?: (bookingId: string, tableIds: string[]) => void
  searchQuery?: string
}

const STATUS_ICONS: any = {
  'pending': Timer,
  'confirmed': CheckCircle,
  'arrived': UserCheck,
  'seated': ChefHat,
  'ordered': Coffee,
  'appetizers': Utensils,
  'main_course': Utensils,
  'dessert': Cake,
  'payment': CreditCard,
  'completed': CheckCircle,
  'no_show': AlertCircle,
  'cancelled': AlertCircle
}

const STATUS_COLORS: any = {
  'pending': 'bg-yellow-100 dark:bg-yellow-900/30 border-yellow-400 dark:border-yellow-600 text-yellow-800 dark:text-yellow-300',
  'confirmed': 'bg-blue-100 dark:bg-blue-900/30 border-blue-400 dark:border-blue-600 text-blue-800 dark:text-blue-300',
  'arrived': 'bg-indigo-100 dark:bg-indigo-900/30 border-indigo-400 dark:border-indigo-600 text-indigo-800 dark:text-indigo-300',
  'seated': 'bg-purple-100 dark:bg-purple-900/30 border-purple-400 dark:border-purple-600 text-purple-800 dark:text-purple-300',
  'ordered': 'bg-orange-100 dark:bg-orange-900/30 border-orange-400 dark:border-orange-600 text-orange-800 dark:text-orange-300',
  'appetizers': 'bg-green-100 dark:bg-green-900/30 border-green-400 dark:border-green-600 text-green-800 dark:text-green-300',
  'main_course': 'bg-green-200 dark:bg-green-800/40 border-green-500 dark:border-green-500 text-green-900 dark:text-green-200',
  'dessert': 'bg-pink-100 dark:bg-pink-900/30 border-pink-400 dark:border-pink-600 text-pink-800 dark:text-pink-300',
  'payment': 'bg-yellow-200 dark:bg-yellow-800/40 border-yellow-500 dark:border-yellow-500 text-yellow-900 dark:text-yellow-200',
  'completed': 'bg-muted border-border text-muted-foreground',
  'no_show': 'bg-red-100 dark:bg-red-900/30 border-red-400 dark:border-red-600 text-red-800 dark:text-red-300',
  'cancelled': 'bg-red-100 dark:bg-red-900/30 border-red-400 dark:border-red-600 text-red-800 dark:text-red-300'
}

const TABLE_TYPE_COLORS: Record<string, string> = {
  booth: "bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950/50 dark:to-blue-900/30 border-blue-300 dark:border-blue-700 shadow-blue-200/30 dark:shadow-blue-900/20",
  window: "bg-gradient-to-br from-emerald-50 to-emerald-100 dark:from-emerald-950/50 dark:to-emerald-900/30 border-emerald-300 dark:border-emerald-700 shadow-emerald-200/30 dark:shadow-emerald-900/20",
  patio: "bg-gradient-to-br from-amber-50 to-amber-100 dark:from-amber-950/50 dark:to-amber-900/30 border-amber-300 dark:border-amber-700 shadow-amber-200/30 dark:shadow-amber-900/20",
  standard: "bg-gradient-to-br from-card to-muted border-border shadow-sm",
  bar: "bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-950/50 dark:to-purple-900/30 border-purple-300 dark:border-purple-700 shadow-purple-200/30 dark:shadow-purple-900/20",
  private: "bg-gradient-to-br from-rose-50 to-rose-100 dark:from-rose-950/50 dark:to-rose-900/30 border-rose-300 dark:border-rose-700 shadow-rose-200/30 dark:shadow-rose-900/20",
}

export const UnifiedFloorPlan = React.memo(function UnifiedFloorPlan({ 
  tables, 
  bookings, 
  currentTime,
  restaurantId,
  userId,
  onTableClick,
  onStatusUpdate,
  onTableSwitch,
  onCheckIn,
  searchQuery
}: UnifiedFloorPlanProps) {
  const [tableStatuses, setTableStatuses] = useState<Map<string, any>>(new Map())
  const [selectedTable, setSelectedTable] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [draggedBookingId, setDraggedBookingId] = useState<string | null>(null)
  const [activeMenuTable, setActiveMenuTable] = useState<string | null>(null)
  const [hoveredTable, setHoveredTable] = useState<string | null>(null)
  const [loadingTransition, setLoadingTransition] = useState<string | null>(null)
  const floorPlanRef = useRef<HTMLDivElement>(null)
  
  const tableStatusService = new TableStatusService()

  // Load table statuses
  useEffect(() => {
    const loadStatuses = async () => {
      const statuses = await tableStatusService.getTableStatuses(restaurantId, currentTime)
      setTableStatuses(statuses)
    }
    loadStatuses()
    
    const interval = setInterval(loadStatuses, 30000)
    return () => clearInterval(interval)
  }, [restaurantId, currentTime])

  // Click outside to deselect
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (floorPlanRef.current && !floorPlanRef.current.contains(event.target as Node)) {
        setSelectedTable(null)
        setActiveMenuTable(null)
      }
    }

    if (selectedTable) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [selectedTable])

  // Keyboard navigation support
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setSelectedTable(null)
        setActiveMenuTable(null)
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [])

  const getTableBookingInfo = (table: any) => {
    // Get all bookings for this table (current, upcoming, and recent)
    const allTableBookings = bookings.filter(booking => 
      booking.tables?.some((t: any) => t.id === table.id)
    )

    // Current active bookings
    const activeBookings = allTableBookings.filter(booking =>
      ['confirmed', 'arrived', 'seated', 'ordered', 'appetizers', 'main_course', 'dessert', 'payment'].includes(booking.status)
    )

    const currentBooking = activeBookings.find(booking => {
      const physicallyPresent = ['arrived', 'seated', 'ordered', 'appetizers', 'main_course', 'dessert', 'payment'].includes(booking.status)
      if (physicallyPresent) return true
      
      const bookingStart = new Date(booking.booking_time)
      const bookingEnd = addMinutes(bookingStart, booking.turn_time_minutes || 120)
      return currentTime >= bookingStart && currentTime <= bookingEnd
    })

    // Upcoming bookings (next 3)
    const upcomingBookings = allTableBookings
      .filter(booking => 
        new Date(booking.booking_time) > currentTime &&
        ['confirmed', 'pending'].includes(booking.status)
      )
      .sort((a, b) => new Date(a.booking_time).getTime() - new Date(b.booking_time).getTime())
      .slice(0, 3)

    // Recent history (last 3 completed bookings from today)
    const todayStart = new Date(currentTime)
    todayStart.setHours(0, 0, 0, 0)
    
    const recentHistory = allTableBookings
      .filter(booking => {
        const bookingDate = new Date(booking.booking_time)
        return bookingDate >= todayStart && 
               bookingDate < currentTime &&
               ['completed', 'no_show'].includes(booking.status)
      })
      .sort((a, b) => new Date(b.booking_time).getTime() - new Date(a.booking_time).getTime())
      .slice(0, 3)

    return {
      current: currentBooking,
      upcoming: upcomingBookings[0],
      allUpcoming: upcomingBookings,
      recentHistory,
      status: tableStatuses.get(table.id)
    }
  }

  const handleTableDrop = useCallback((tableId: string) => {
    if (draggedBookingId && onTableSwitch) {
      onTableSwitch(draggedBookingId, [tableId])
      setDraggedBookingId(null)
      setIsDragging(false)
    }
  }, [draggedBookingId, onTableSwitch])

  const handleStatusTransition = useCallback(async (bookingId: string, newStatus: DiningStatus) => {
    try {
      setLoadingTransition(bookingId)
      await tableStatusService.updateBookingStatus(bookingId, newStatus, userId)
      if (onStatusUpdate) {
        onStatusUpdate(bookingId, newStatus)
      }
    } catch (error) {
      console.error('Status update error:', error)
    } finally {
      setLoadingTransition(null)
    }
  }, [onStatusUpdate, userId, tableStatusService])

  // Highlight tables based on search
  const isTableHighlighted = (table: any, booking: any) => {
    if (!searchQuery) return false
    const query = searchQuery.toLowerCase()
    
    if (booking) {
      const guestName = (booking.user?.full_name || booking.guest_name || '').toLowerCase()
      const phone = (booking.user?.phone_number || booking.guest_phone || '').toLowerCase()
      return guestName.includes(query) || phone.includes(query)
    }
    
    return `t${table.table_number}`.toLowerCase().includes(query)
  }

  const renderTable = (table: any) => {
    const { current, upcoming, allUpcoming, recentHistory } = getTableBookingInfo(table)
    const isOccupied = !!current
    const StatusIcon = current ? STATUS_ICONS[current.status as DiningStatus] : Table2
    const isHighlighted = isTableHighlighted(table, current)
    const bookingTime = current ? new Date(current.booking_time) : null
    const minutesSinceArrival = bookingTime ? differenceInMinutes(currentTime, bookingTime) : 0

    return (
      <TooltipProvider key={table.id}>
        <Tooltip>
          <TooltipTrigger asChild>
            <div
              role="button"
              tabIndex={0}
              aria-label={`Table ${table.table_number}, capacity ${table.min_capacity}-${table.max_capacity}${current ? `, occupied by ${current.user?.full_name || current.guest_name || 'Guest'}, status: ${current.status.replace(/_/g, ' ')}` : ', available'}`}
              className={cn(
                "relative rounded-2xl border-3 cursor-pointer transition-all duration-300 ease-out focus:outline-none focus:ring-4 focus:ring-blue-500 focus:ring-offset-2",
                TABLE_TYPE_COLORS[table.table_type] || "bg-gradient-to-br from-white to-gray-50 border-gray-300 shadow-lg",
                // Occupied table styling
                isOccupied && "ring-4 ring-offset-2 ring-offset-background shadow-xl",
                isOccupied && STATUS_COLORS[current.status as DiningStatus],
                // Hover effects with better feedback
                hoveredTable === table.id && !isOccupied && "shadow-xl scale-102 ring-2 ring-blue-400/50 ring-offset-2",
                hoveredTable === table.id && isOccupied && "shadow-2xl scale-102 brightness-110",
                // Loading state
                loadingTransition === current?.id && "animate-pulse ring-4 ring-yellow-400 ring-offset-2",
                // Selection state
                selectedTable === table.id && "ring-4 ring-blue-500 ring-offset-2 ring-offset-background scale-105 shadow-2xl",
                // Search highlighting
                isHighlighted && "ring-4 ring-yellow-400 animate-pulse ring-offset-2 ring-offset-background",
                // Drag states
                isDragging && !isOccupied && "border-dashed border-green-500 bg-green-50/70 shadow-green-200/50",
                // Shape
                table.shape === "circle" ? "rounded-full" : "rounded-2xl",
                // Interactive states
                "transform-gpu will-change-transform"
              )}
              style={{
                position: "absolute",
                left: `${table.x_position}%`,
                top: `${table.y_position}%`,
                width: `${(table.width || 140) * 1.3}px`,
                height: `${(table.height || 120) * 1.3}px`,
                padding: "16px"
              }}
              onClick={() => {
                // Simple click-to-toggle selection
                if (selectedTable === table.id) {
                  setSelectedTable(null)
                  setActiveMenuTable(null)
                } else {
                  setSelectedTable(table.id)
                  // Auto-show menu for occupied tables
                  if (current) {
                    setActiveMenuTable(table.id)
                  } else {
                    // For empty tables, show details immediately
                    if (onTableClick) onTableClick(table, { 
                      current, 
                      upcoming, 
                      allUpcoming, 
                      recentHistory,
                      tableInfo: {
                        hasUpcoming: allUpcoming.length > 0,
                        hasHistory: recentHistory.length > 0,
                        nextBookingTime: allUpcoming[0]?.booking_time,
                        lastCompletedTime: recentHistory[0]?.booking_time
                      }
                    })
                  }
                }
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  // Trigger same logic as click
                  if (selectedTable === table.id) {
                    setSelectedTable(null)
                    setActiveMenuTable(null)
                  } else {
                    setSelectedTable(table.id)
                    if (current) {
                      setActiveMenuTable(table.id)
                    } else if (onTableClick) {
                      onTableClick(table, { 
                        current, 
                        upcoming, 
                        allUpcoming, 
                        recentHistory,
                        tableInfo: {
                          hasUpcoming: allUpcoming.length > 0,
                          hasHistory: recentHistory.length > 0,
                          nextBookingTime: allUpcoming[0]?.booking_time,
                          lastCompletedTime: recentHistory[0]?.booking_time
                        }
                      })
                    }
                  }
                }
              }}
              onMouseEnter={() => setHoveredTable(table.id)}
              onMouseLeave={() => setHoveredTable(null)}
              onDragOver={(e) => {
                if (!isOccupied) {
                  e.preventDefault()
                  e.currentTarget.classList.add("scale-105")
                }
              }}
              onDragLeave={(e) => {
                e.currentTarget.classList.remove("scale-105")
              }}
              onDrop={(e) => {
                e.preventDefault()
                e.currentTarget.classList.remove("scale-105")
                if (!isOccupied) {
                  handleTableDrop(table.id)
                }
              }}
            >
              {/* Table header - Tablet Optimized */}
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <StatusIcon className="h-5 w-5 text-current" />
                  <span className="font-bold text-lg text-foreground">T{table.table_number}</span>
                </div>
                <Badge variant="outline" className="text-sm px-2 py-1 bg-background/70 font-medium rounded-lg">
                  {table.min_capacity}-{table.max_capacity}
                </Badge>
              </div>

              {/* Current booking info */}
              {isOccupied && current ? (
                <div className="space-y-1.5">
                  {/* Guest info - Simplified with icons */}
                  <div>
                    <p className="font-bold text-base truncate text-foreground mb-1">
                      {current.user?.full_name || current.guest_name || 'Guest'}
                    </p>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {/* Party size with visual indicators */}
                        <div className={cn(
                          "flex items-center gap-1.5 px-3 py-1.5 rounded-xl transition-all duration-200 shadow-sm",
                          current.party_size > table.max_capacity 
                            ? "bg-red-100 text-red-800 border-2 border-red-300 animate-pulse" 
                            : "bg-blue-100 text-blue-800 border-2 border-blue-300 hover:bg-blue-200"
                        )}>
                          <Users className="h-4 w-4" />
                          <span className="font-bold text-sm">{current.party_size}</span>
                          {current.party_size > table.max_capacity && (
                            <AlertTriangle className="h-4 w-4 animate-bounce text-red-600" />
                          )}
                        </div>
                        
                        {/* Time indicator with urgency colors */}
                        <div className={cn(
                          "flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold text-sm border-2 transition-all duration-200 shadow-sm",
                          minutesSinceArrival > (current.turn_time_minutes || 120) 
                            ? "bg-red-100 text-red-800 border-red-300 animate-pulse shadow-red-200" :
                          minutesSinceArrival > (current.turn_time_minutes || 120) * 0.8 
                            ? "bg-orange-100 text-orange-800 border-orange-300 shadow-orange-200" :
                          "bg-green-100 text-green-800 border-green-300 shadow-green-200"
                        )}>
                          <Clock className="h-4 w-4" />
                          <span>{minutesSinceArrival}m</span>
                          {minutesSinceArrival > (current.turn_time_minutes || 120) && (
                            <AlertTriangle className="h-3 w-3 animate-bounce" />
                          )}
                        </div>
                      </div>
                      
                      {/* Enhanced quick call button */}
                      {(current.user?.phone_number || current.guest_phone) && (
                        <Button
                          size="sm"
                          aria-label={`Call ${current.user?.full_name || current.guest_name || 'Guest'} at ${current.user?.phone_number || current.guest_phone}`}
                          className="h-9 w-9 p-0 bg-gradient-to-br from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white rounded-full shadow-2xl border-3 border-green-300 hover:scale-110 transition-all duration-200 animate-pulse focus:outline-none focus:ring-2 focus:ring-green-400 focus:ring-offset-2"
                          onClick={(e) => {
                            e.stopPropagation()
                            const phone = current.user?.phone_number || current.guest_phone
                            window.open(`tel:${phone}`, '_self')
                          }}
                        >
                          <Phone className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Status indicator with enhanced visual feedback */}
                  <div className="flex items-center justify-center">
                    <div className={cn(
                      "px-4 py-2 rounded-2xl text-sm font-bold flex items-center gap-2.5 shadow-xl border-2 transition-all duration-300 transform hover:scale-105",
                      current.status === 'arrived' ? "bg-gradient-to-r from-blue-100 to-blue-200 text-blue-800 border-blue-400 animate-pulse shadow-blue-300/50" :
                      current.status === 'seated' ? "bg-gradient-to-r from-purple-100 to-purple-200 text-purple-800 border-purple-400 shadow-purple-300/50" :
                      current.status === 'ordered' ? "bg-gradient-to-r from-orange-100 to-orange-200 text-orange-800 border-orange-400 shadow-orange-300/50" :
                      current.status === 'payment' ? "bg-gradient-to-r from-yellow-100 to-yellow-200 text-yellow-800 border-yellow-400 shadow-yellow-300/50 animate-pulse" :
                      "bg-gradient-to-r from-green-100 to-green-200 text-green-800 border-green-400 shadow-green-300/50"
                    )}>
                      <StatusIcon className="h-4 w-4" />
                      <span className="capitalize">{current.status.replace(/_/g, ' ')}</span>
                      {/* Status emoji indicators */}
                      {current.status === 'arrived' && <span>👋</span>}
                      {current.status === 'seated' && <span>🪑</span>}
                      {current.status === 'ordered' && <span>📝</span>}
                      {current.status === 'payment' && <span>💳</span>}
                    </div>
                  </div>

                  {/* Quick actions - Enhanced positioning and animation */}
                  {selectedTable === table.id && activeMenuTable === table.id && (
                    <div className="absolute -bottom-20 left-1/2 transform -translate-x-1/2 flex gap-2 z-50 animate-in fade-in-0 slide-in-from-top-4 duration-300">
                      {/* Enhanced quick status buttons */}
                      {current.status === 'arrived' && (
                        <Button 
                          size="sm"
                          className="h-11 text-sm px-5 shadow-2xl bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white rounded-2xl font-semibold border-2 border-purple-400 hover:scale-105 transition-all duration-200"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleStatusTransition(current.id, 'seated')
                          }}
                          disabled={loadingTransition === current.id}
                        >
                          <ChefHat className="h-4 w-4 mr-2" />
                          Seat Now
                        </Button>
                      )}
                      
                      {current.status === 'seated' && (
                        <Button 
                          size="sm"
                          className="h-11 text-sm px-5 shadow-2xl bg-gradient-to-r from-orange-600 to-orange-700 hover:from-orange-700 hover:to-orange-800 text-white rounded-2xl font-semibold border-2 border-orange-400 hover:scale-105 transition-all duration-200"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleStatusTransition(current.id, 'ordered')
                          }}
                          disabled={loadingTransition === current.id}
                        >
                          <Coffee className="h-4 w-4 mr-2" />
                          Ordered
                        </Button>
                      )}
                      
                      {['ordered', 'appetizers', 'main_course', 'dessert'].includes(current.status) && (
                        <Button 
                          size="sm"
                          className="h-11 text-sm px-5 shadow-2xl bg-gradient-to-r from-yellow-600 to-yellow-700 hover:from-yellow-700 hover:to-yellow-800 text-white rounded-2xl font-semibold border-2 border-yellow-400 hover:scale-105 transition-all duration-200"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleStatusTransition(current.id, 'payment')
                          }}
                          disabled={loadingTransition === current.id}
                        >
                          <CreditCard className="h-4 w-4 mr-2" />
                          Check
                        </Button>
                      )}
                      
                      {current.status === 'payment' && (
                        <Button 
                          size="sm"
                          className="h-11 text-sm px-5 shadow-2xl bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white rounded-2xl font-semibold border-2 border-green-400 hover:scale-105 transition-all duration-200"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleStatusTransition(current.id, 'completed')
                          }}
                          disabled={loadingTransition === current.id}
                        >
                          <CheckCircle className="h-4 w-4 mr-2" />
                          Complete
                        </Button>
                      )}

                      {/* View Details button */}
                      <Button 
                        size="sm"
                        className="h-11 px-5 shadow-2xl bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white rounded-2xl font-semibold border-2 border-blue-400 hover:scale-105 transition-all duration-200"
                        onClick={(e) => {
                          e.stopPropagation()
                          if (onTableClick) onTableClick(table, { current, upcoming, allUpcoming, recentHistory })
                        }}
                      >
                        <Eye className="h-4 w-4 mr-2" />
                        Details
                      </Button>
                    </div>
                  )}
                </div>
                              ) : (
                <div className="text-center py-3">
                  <div className="mb-3">
                    <Badge 
                      variant="secondary" 
                      className="text-sm px-3 py-1.5 bg-green-100 text-green-800 border-green-300 font-medium shadow-sm"
                    >
                      ✅ Available
                    </Badge>
                  </div>
                  
                  {/* Show next upcoming booking with better visibility */}
                  {upcoming && (
                    <div className="text-xs p-3 bg-gradient-to-br from-blue-100 to-blue-200 dark:from-blue-900/30 dark:to-blue-800/30 border-2 border-blue-300 dark:border-blue-600 rounded-xl shadow-md">
                      <div className="flex items-start gap-2">
                        <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center flex-shrink-0">
                          <Clock className="h-3 w-3 text-white" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-bold text-blue-900 dark:text-blue-200">
                            📅 {format(new Date(upcoming.booking_time), 'h:mm a')}
                          </p>
                          <p className="truncate text-blue-700 dark:text-blue-300 flex items-center gap-1">
                            <Users className="h-3 w-3" />
                            {upcoming.user?.full_name || upcoming.guest_name} ({upcoming.party_size})
                          </p>
                          <p className="text-blue-600 dark:text-blue-400 mt-1 flex items-center gap-1">
                            <Timer className="h-3 w-3" />
                            {differenceInMinutes(new Date(upcoming.booking_time), currentTime)}m away
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {/* Enhanced activity indicators for empty tables */}
                  {!upcoming && (
                    <div className="space-y-3">
                      {/* Main availability indicator */}
                      <div className="text-center">
                        <div className="w-10 h-10 mx-auto bg-gradient-to-br from-green-500 to-green-600 rounded-full flex items-center justify-center shadow-lg">
                          <span className="text-white text-xl font-bold">✓</span>
                        </div>
                      </div>
                      
                      {/* Activity summary */}
                      {(allUpcoming.length > 0 || recentHistory.length > 0) && (
                        <div className="text-center space-y-2">
                          <p className="text-xs font-medium text-gray-600 dark:text-gray-400">Table Activity</p>
                          <div className="flex justify-center gap-3">
                            {allUpcoming.length > 0 && (
                              <div className="flex items-center gap-1.5 px-2 py-1 bg-blue-100 text-blue-700 rounded-lg border border-blue-300">
                                <Calendar className="h-3 w-3" />
                                <span className="text-xs font-medium">{allUpcoming.length} upcoming</span>
                              </div>
                            )}
                            {recentHistory.length > 0 && (
                              <div className="flex items-center gap-1.5 px-2 py-1 bg-gray-100 text-gray-700 rounded-lg border border-gray-300">
                                <CheckCircle className="h-3 w-3" />
                                <span className="text-xs font-medium">{recentHistory.length} today</span>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                      
                      {/* Click hint for empty tables */}
                      {selectedTable !== table.id && (
                        <div className="text-center mt-2">
                          <p className="text-xs text-muted-foreground px-2 py-1 bg-muted/50 rounded-lg">
                            Click for details
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Drag handle */}
              {isOccupied && current && (
                <div
                  className="absolute top-1 right-1 p-1 bg-background/80 border border-border rounded cursor-move hover:bg-background transition-colors"
                  draggable
                  onDragStart={(e) => {
                    setIsDragging(true)
                    setDraggedBookingId(current.id)
                    e.dataTransfer.effectAllowed = "move"
                  }}
                  onDragEnd={() => {
                    setIsDragging(false)
                    setDraggedBookingId(null)
                  }}
                >
                  <Hand className="h-3 w-3 text-muted-foreground" />
                </div>
              )}
            </div>
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-xs">
            {current ? (
              <div className="space-y-2">
                <p className="font-semibold">{current.user?.full_name || current.guest_name}</p>
                <div className="space-y-1 text-sm">
                  <p>Party of {current.party_size}</p>
                  <p>Arrived: {format(bookingTime!, 'h:mm a')}</p>
                  <p>Status: {current.status.replace(/_/g, ' ')}</p>
                  {current.special_requests && (
                    <p className="italic text-yellow-200">Note: {current.special_requests}</p>
                  )}
                  {(current.user?.phone_number || current.guest_phone) && (
                    <p className="font-mono text-green-200">📞 {current.user?.phone_number || current.guest_phone}</p>
                  )}
                </div>
              </div>
            ) : (
              <div>
                <p className="font-semibold">Table {table.table_number}</p>
                <p className="text-sm">Capacity: {table.min_capacity}-{table.max_capacity}</p>
                <p className="text-sm">Type: {table.table_type}</p>
                {upcoming && (
                  <p className="text-sm mt-2">
                    Next: {format(new Date(upcoming.booking_time), 'h:mm a')}
                  </p>
                )}
              </div>
            )}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )
  }

  // Memoized stats calculation for performance
  const tableStats = useMemo(() => {
    const activeTables = tables.filter(t => t.is_active)
    const occupiedTables = activeTables.filter(t => {
      const { current } = getTableBookingInfo(t)
      return !!current
    }).length

    const availableTables = activeTables.length - occupiedTables
    const occupancyRate = activeTables.length > 0 
      ? Math.round((occupiedTables / activeTables.length) * 100) 
      : 0

    return { occupiedTables, availableTables, occupancyRate }
  }, [tables, bookings, currentTime])

  return (
    <Card className="h-full flex flex-col shadow-xl border">
      <div className="flex items-center justify-between p-4 border-b bg-card">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Live Floor Plan</h2>
          <p className="text-sm text-muted-foreground">
            <span className="font-medium text-green-600 dark:text-green-400">{tableStats.occupiedTables}</span> occupied • 
            <span className="font-medium text-blue-600 dark:text-blue-400 ml-2">{tableStats.availableTables}</span> available • 
            <span className={cn(
              "font-medium ml-2",
              tableStats.occupancyRate > 80 ? "text-red-600 dark:text-red-400" : 
              tableStats.occupancyRate > 60 ? "text-orange-600 dark:text-orange-400" : 
              "text-green-600 dark:text-green-400"
            )}>{tableStats.occupancyRate}%</span> capacity
          </p>
        </div>
        
        {/* Enhanced legend with better UX hints */}
        <div className="flex items-center gap-3 text-xs">
          <div className="flex items-center gap-2 px-3 py-2 bg-gradient-to-r from-green-700 to-green-800 text-white rounded-xl shadow-lg border border-green-600">
            <div className="w-3 h-3 rounded-full bg-green-300 animate-pulse" />
            <span className="font-semibold">🍽️ Occupied</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-2 bg-gradient-to-r from-gray-700 to-gray-800 text-white rounded-xl shadow-lg border border-gray-600">
            <div className="w-3 h-3 rounded-full bg-green-400" />
            <span className="font-semibold">✅ Available</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-2 bg-gradient-to-r from-blue-700 to-blue-800 text-white rounded-xl shadow-lg border border-blue-600">
            <div className="w-3 h-3 rounded-full bg-blue-300 animate-bounce" />
            <span className="font-semibold">📅 Reserved</span>
          </div>
          {selectedTable && (
            <div className="flex items-center gap-2 px-3 py-2 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl shadow-lg border-2 border-blue-400 animate-pulse">
              <div className="w-3 h-3 rounded-full bg-blue-200" />
              <span className="font-bold">👆 Selected</span>
            </div>
          )}
          {searchQuery && (
            <div className="flex items-center gap-2 px-3 py-2 bg-gradient-to-r from-yellow-600 to-yellow-700 text-white rounded-xl shadow-lg border-2 border-yellow-400 animate-pulse">
              <div className="w-3 h-3 rounded-full bg-yellow-200 animate-ping" />
              <span className="font-bold">🔍 Found</span>
            </div>
          )}
        </div>
      </div>
      
      <div className="flex-1 relative bg-background overflow-auto" ref={floorPlanRef}>
        <div 
          className="relative"
          style={{ minHeight: "800px", minWidth: "1200px" }}
          onClick={(e) => {
            // Only deselect if clicking on empty space
            if (e.target === e.currentTarget) {
              setSelectedTable(null)
              setActiveMenuTable(null)
            }
          }}
        >
          {tables.filter(t => t.is_active).map(renderTable)}
          
          {/* Enhanced accessibility overlay for screen readers */}
          <div className="sr-only" aria-live="polite" aria-atomic="true">
            {selectedTable && (() => {
              const selectedTableData = tables.find(t => t.id === selectedTable)
              const { current } = selectedTableData ? getTableBookingInfo(selectedTableData) : { current: null }
              return `Table ${selectedTableData?.table_number} selected. ${current ? `Occupied by ${current.user?.full_name || current.guest_name || 'Guest'}, status: ${current.status.replace(/_/g, ' ')}.` : 'Available for booking.'}`
            })()}
          </div>
        </div>
      </div>
    </Card>
  )
})

// Add display name for debugging
UnifiedFloorPlan.displayName = 'UnifiedFloorPlan'