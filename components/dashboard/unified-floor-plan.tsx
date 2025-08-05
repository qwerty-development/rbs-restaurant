// components/dashboard/unified-floor-plan.tsx
"use client"

import { useState, useEffect } from "react"
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
  ArrowRight,
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
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

export function UnifiedFloorPlan({ 
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
  const [hoveredTable, setHoveredTable] = useState<string | null>(null)
  
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

  const getTableBookingInfo = (table: any) => {
    const tableBookings = bookings.filter(booking => 
      booking.tables?.some((t: any) => t.id === table.id) &&
      ['confirmed', 'arrived', 'seated', 'ordered', 'appetizers', 'main_course', 'dessert', 'payment'].includes(booking.status)
    )

    const currentBooking = tableBookings.find(booking => {
      const physicallyPresent = ['arrived', 'seated', 'ordered', 'appetizers', 'main_course', 'dessert', 'payment'].includes(booking.status)
      if (physicallyPresent) return true
      
      const bookingStart = new Date(booking.booking_time)
      const bookingEnd = addMinutes(bookingStart, booking.turn_time_minutes || 120)
      return currentTime >= bookingStart && currentTime <= bookingEnd
    })

    const upcomingBookings = tableBookings
      .filter(booking => new Date(booking.booking_time) > currentTime)
      .sort((a, b) => new Date(a.booking_time).getTime() - new Date(b.booking_time).getTime())

    return {
      current: currentBooking,
      upcoming: upcomingBookings[0],
      status: tableStatuses.get(table.id)
    }
  }

  const handleTableDrop = (tableId: string) => {
    if (draggedBookingId && onTableSwitch) {
      onTableSwitch(draggedBookingId, [tableId])
      setDraggedBookingId(null)
      setIsDragging(false)
    }
  }

  const handleStatusTransition = async (bookingId: string, newStatus: DiningStatus) => {
    try {
      await tableStatusService.updateBookingStatus(bookingId, newStatus, userId)
      if (onStatusUpdate) {
        onStatusUpdate(bookingId, newStatus)
      }
    } catch (error) {
      console.error('Status update error:', error)
    }
  }

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
    const { current, upcoming, status } = getTableBookingInfo(table)
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
              className={cn(
                "relative rounded-xl border-2 cursor-pointer transition-all hover:shadow-lg",
                TABLE_TYPE_COLORS[table.table_type] || "bg-card border-border shadow-sm",
                isOccupied && "ring-2 ring-offset-2 ring-offset-background",
                isOccupied && STATUS_COLORS[current.status as DiningStatus],
                isDragging && !isOccupied && "border-dashed border-green-500 dark:border-green-400 bg-green-50/50 dark:bg-green-900/20",
                selectedTable === table.id && "ring-4 ring-primary/50 ring-offset-2 ring-offset-background",
                isHighlighted && "ring-4 ring-yellow-400 dark:ring-yellow-500 animate-pulse ring-offset-2 ring-offset-background",
                table.shape === "circle" ? "rounded-full" : "rounded-lg"
              )}
              style={{
                position: "absolute",
                left: `${table.x_position}%`,
                top: `${table.y_position}%`,
                width: `${(table.width || 120) * 1.2}px`,
                height: `${(table.height || 100) * 1.2}px`,
                padding: "12px"
              }}
              onClick={() => {
                setSelectedTable(table.id)
                if (onTableClick) onTableClick(table, { current, upcoming })
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
              {/* Table header */}
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-1">
                  <StatusIcon className="h-4 w-4 text-current" />
                  <span className="font-bold text-base text-foreground">T{table.table_number}</span>
                </div>
                <Badge variant="outline" className="text-xs px-1 bg-background/50">
                  {table.min_capacity}-{table.max_capacity}
                </Badge>
              </div>

              {/* Current booking info */}
              {isOccupied && current ? (
                <div className="space-y-1.5">
                  {/* Guest info */}
                  <div>
                    <p className="font-semibold text-sm truncate text-foreground">
                      {current.user?.full_name || current.guest_name || 'Guest'}
                    </p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Users className="h-3 w-3" />
                        {current.party_size}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {minutesSinceArrival}m
                      </span>
                    </div>
                  </div>

                  {/* Progress bar */}
                  {status?.currentBooking && (
                    <div>
                      <Progress 
                        value={status.currentBooking.progress} 
                        className="h-1.5"
                        indicatorClassName={cn(
                          status.currentBooking.progress > 80 ? "bg-orange-500" :
                          status.currentBooking.progress > 60 ? "bg-yellow-500" :
                          status.currentBooking.progress > 40 ? "bg-green-500" :
                          "bg-blue-500"
                        )}
                      />
                      <div className="flex items-center justify-between mt-1">
                        <p className="text-xs capitalize font-medium text-foreground">
                          {current.status.replace(/_/g, ' ')}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {status.currentBooking.progress}%
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Quick actions on hover */}
                  {hoveredTable === table.id && (
                    <div className="absolute -bottom-8 left-0 right-0 flex justify-center gap-1 z-50">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button size="sm" variant="secondary" className="h-6 text-xs px-2 shadow-lg bg-card border border-border">
                            <ArrowRight className="h-3 w-3 mr-1" />
                            Update
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent className="w-48">
                          {tableStatusService.getValidTransitions(current.status as DiningStatus).map(transition => {
                            const Icon = STATUS_ICONS[transition.to]
                            return (
                              <DropdownMenuItem
                                key={transition.to}
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleStatusTransition(current.id, transition.to)
                                }}
                              >
                                <Icon className="h-4 w-4 mr-2" />
                                {transition.label}
                              </DropdownMenuItem>
                            )
                          })}
                        </DropdownMenuContent>
                      </DropdownMenu>
                      
                      <Button 
                        size="sm" 
                        variant="secondary" 
                        className="h-6 text-xs px-2 shadow-lg bg-card border border-border"
                        onClick={(e) => {
                          e.stopPropagation()
                          if (onTableClick) onTableClick(table, { current, upcoming })
                        }}
                      >
                        <Eye className="h-3 w-3" />
                      </Button>
                    </div>
                  )}
                </div>
                              ) : (
                <div className="text-center py-2">
                  <Badge 
                    variant="secondary" 
                    className="text-xs bg-muted text-muted-foreground border-border"
                  >
                    Available
                  </Badge>
                  {upcoming && (
                    <div className="text-xs mt-2 p-2 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                      <p className="font-semibold text-blue-900 dark:text-blue-300">
                        Next: {format(new Date(upcoming.booking_time), 'h:mm a')}
                      </p>
                      <p className="truncate text-blue-700 dark:text-blue-400">
                        {upcoming.user?.full_name || upcoming.guest_name}
                      </p>
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
                    <p className="italic">Note: {current.special_requests}</p>
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

  // Calculate stats
  const occupiedTables = tables.filter(t => {
    const { current } = getTableBookingInfo(t)
    return !!current
  }).length

  const availableTables = tables.filter(t => t.is_active).length - occupiedTables
  const occupancyRate = tables.filter(t => t.is_active).length > 0 
    ? Math.round((occupiedTables / tables.filter(t => t.is_active).length) * 100) 
    : 0

  return (
    <Card className="h-full flex flex-col shadow-xl border">
      <div className="flex items-center justify-between p-4 border-b bg-card">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Live Floor Plan</h2>
          <p className="text-sm text-muted-foreground">
            <span className="font-medium text-green-600 dark:text-green-400">{occupiedTables}</span> occupied • 
            <span className="font-medium text-blue-600 dark:text-blue-400 ml-2">{availableTables}</span> available • 
            <span className={cn(
              "font-medium ml-2",
              occupancyRate > 80 ? "text-red-600 dark:text-red-400" : 
              occupancyRate > 60 ? "text-orange-600 dark:text-orange-400" : 
              "text-green-600 dark:text-green-400"
            )}>{occupancyRate}%</span> capacity
          </p>
        </div>
        
        {/* Legend */}
        <div className="flex items-center gap-4 text-xs">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-gradient-to-br from-green-500 to-green-600 shadow-sm" />
            <span className="text-foreground">Dining</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-gradient-to-br from-muted to-muted-foreground shadow-sm" />
            <span className="text-foreground">Available</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 shadow-sm" />
            <span className="text-foreground">Reserved</span>
          </div>
          {searchQuery && (
            <div className="flex items-center gap-2 ml-2 px-2 py-1 bg-yellow-100 dark:bg-yellow-900/30 rounded-full">
              <div className="w-3 h-3 rounded-full bg-yellow-400 dark:bg-yellow-500 animate-pulse" />
              <span className="text-foreground">Search Match</span>
            </div>
          )}
        </div>
      </div>
      
      <div className="flex-1 relative bg-background overflow-auto">
        <div 
          className="relative"
          style={{ minHeight: "800px", minWidth: "1200px" }}
        >
          {tables.filter(t => t.is_active).map(renderTable)}
          
          {/* Unassigned bookings floating panel */}
          <div className="absolute top-4 right-4 bg-card/95 backdrop-blur-sm rounded-xl p-4 border-2 border-red-200 dark:border-red-800 shadow-2xl max-w-xs">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-sm text-red-800 dark:text-red-300">Needs Table Assignment</h3>
              <Badge variant="destructive" className="text-xs">
                {bookings.filter(b => b.status === 'confirmed' && (!b.tables || b.tables.length === 0)).length}
              </Badge>
            </div>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {bookings
                .filter(b => b.status === 'confirmed' && (!b.tables || b.tables.length === 0))
                .map(booking => {
                  const bookingTime = new Date(booking.booking_time)
                  const minutesUntil = differenceInMinutes(bookingTime, currentTime)
                  const isUrgent = minutesUntil < 30
                  
                  return (
                    <div 
                      key={booking.id}
                      className={cn(
                        "text-xs p-3 rounded-lg border-2 cursor-pointer transition-all hover:scale-[1.02]",
                        isUrgent 
                          ? "bg-red-50 dark:bg-red-900/20 border-red-300 dark:border-red-700 hover:bg-red-100 dark:hover:bg-red-900/30 shadow-md" 
                          : "bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-700 hover:bg-orange-100 dark:hover:bg-orange-900/30"
                      )}
                      onClick={() => onTableClick && onTableClick(null, { current: booking })}
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-semibold text-foreground">{booking.user?.full_name || booking.guest_name}</p>
                          <p className="text-muted-foreground mt-1">
                            {format(bookingTime, 'h:mm a')} • {booking.party_size} guests
                          </p>
                          {isUrgent && (
                            <p className="text-red-600 dark:text-red-400 font-medium mt-1 flex items-center gap-1">
                              <AlertCircle className="h-3 w-3" />
                              {minutesUntil > 0 ? `${minutesUntil}m until arrival` : 'Past arrival time'}
                            </p>
                          )}
                        </div>
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </div>
                  )
                })}
              {bookings.filter(b => b.status === 'confirmed' && (!b.tables || b.tables.length === 0)).length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-4">All bookings assigned ✓</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </Card>
  )
}