// components/dashboard/enhanced-floor-plan.tsx
"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
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
  Maximize2,
  Grid3X3,
  Hand
} from "lucide-react"
import { format, addMinutes, differenceInMinutes } from "date-fns"
import { TableStatusService, type DiningStatus } from "@/lib/table-status"
import { Progress } from "@/components/ui/progress"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

interface EnhancedFloorPlanProps {
  tables: any[]
  bookings: any[]
  currentTime: Date
  restaurantId: string
  userId: string
  onTableClick?: (table: any, status: any) => void
  onStatusUpdate?: (bookingId: string, newStatus: DiningStatus) => void
  onTableSwitch?: (bookingId: string, newTableIds: string[]) => void
  onCheckIn?: (bookingId: string, tableIds: string[]) => void
}

const STATUS_ICONS:any = {
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
  'pending': 'bg-yellow-100 border-yellow-400 text-yellow-800',
  'confirmed': 'bg-blue-100 border-blue-400 text-blue-800',
  'arrived': 'bg-indigo-100 border-indigo-400 text-indigo-800',
  'seated': 'bg-purple-100 border-purple-400 text-purple-800',
  'ordered': 'bg-orange-100 border-orange-400 text-orange-800',
  'appetizers': 'bg-green-100 border-green-400 text-green-800',
  'main_course': 'bg-green-200 border-green-500 text-green-900',
  'dessert': 'bg-pink-100 border-pink-400 text-pink-800',
  'payment': 'bg-yellow-200 border-yellow-500 text-yellow-900',
  'completed': 'bg-gray-100 border-gray-400 text-gray-800',
  'no_show': 'bg-red-100 border-red-400 text-red-800',
  'cancelled': 'bg-red-100 border-red-400 text-red-800'
}

const TABLE_TYPE_COLORS: Record<string, string> = {
  booth: "bg-blue-50 border-blue-300 text-blue-900",
  window: "bg-emerald-50 border-emerald-300 text-emerald-900",
  patio: "bg-amber-50 border-amber-300 text-amber-900",
  standard: "bg-slate-50 border-slate-300 text-slate-900",
  bar: "bg-purple-50 border-purple-300 text-purple-900",
  private: "bg-rose-50 border-rose-300 text-rose-900",
}

export function EnhancedFloorPlan({ 
  tables, 
  bookings, 
  currentTime,
  restaurantId,
  userId,
  onTableClick,
  onStatusUpdate,
  onTableSwitch,
  onCheckIn
}: EnhancedFloorPlanProps) {
  const [viewMode, setViewMode] = useState<"grid" | "floor">("floor")
  const [tableStatuses, setTableStatuses] = useState<Map<string, any>>(new Map())
  const [selectedTable, setSelectedTable] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [draggedBookingId, setDraggedBookingId] = useState<string | null>(null)
  
  const tableStatusService = new TableStatusService()

  // Load table statuses
  useEffect(() => {
    const loadStatuses = async () => {
      const statuses = await tableStatusService.getTableStatuses(restaurantId, currentTime)
      setTableStatuses(statuses)
    }
    loadStatuses()
    
    // Refresh every 30 seconds
    const interval = setInterval(loadStatuses, 30000)
    return () => clearInterval(interval)
  }, [restaurantId, currentTime])

  const getTableBookingInfo = (table: any) => {
    const tableBookings = bookings.filter(booking => 
      booking.tables?.some((t: any) => t.id === table.id) &&
      ['confirmed', 'arrived', 'seated', 'ordered', 'appetizers', 'main_course', 'dessert', 'payment'].includes(booking.status)
    )

    const currentBooking = tableBookings.find(booking => {
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

  const renderTableCard = (table: any) => {
    const { current, upcoming, status } = getTableBookingInfo(table)
    const isOccupied = !!current
    const StatusIcon = current ? STATUS_ICONS[current.status as DiningStatus] : Table2

    return (
      <div
        key={table.id}
        className={cn(
          "relative rounded-xl border-2 cursor-pointer transition-all hover:shadow-lg p-4",
          TABLE_TYPE_COLORS[table.table_type] || "bg-gray-50 border-gray-300 text-gray-900",
          isOccupied && "ring-2 ring-offset-2",
          isOccupied && STATUS_COLORS[current.status as DiningStatus],
          isDragging && !isOccupied && "border-dashed border-green-500 bg-green-50 text-green-900",
          selectedTable === table.id && "ring-4 ring-blue-400"
        )}
        style={viewMode === "floor" ? {
          position: "absolute",
          left: `${table.x_position}%`,
          top: `${table.y_position}%`,
          width: `${(table.width || 80) * 1.2}px`,
          height: `${(table.height || 60) * 1.2}px`,
        } : undefined}
        onClick={() => {
          setSelectedTable(table.id)
          if (onTableClick) onTableClick(table, { current, upcoming })
        }}
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
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <StatusIcon className="h-5 w-5" />
            <span className="font-bold text-lg">T{table.table_number}</span>
          </div>
          <Badge variant="outline" className="text-xs">
            {table.min_capacity}-{table.max_capacity}
          </Badge>
        </div>

        {/* Current booking info */}
        {isOccupied && current ? (
          <div className="space-y-2">
            {/* Guest info */}
            <div>
              <p className="font-semibold truncate">
                {current.user?.full_name || current.guest_name || 'Guest'}
              </p>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Users className="h-3 w-3" />
                <span>{current.party_size} guests</span>
                <Clock className="h-3 w-3 ml-1" />
                <span>{format(new Date(current.booking_time), 'h:mm a')}</span>
              </div>
            </div>

            {/* Progress bar */}
            {status?.currentBooking && (
              <div className="space-y-1">
                <Progress value={status.currentBooking.progress} className="h-2" />
                <div className="flex justify-between text-xs">
                  <span className="capitalize">{current.status.replace(/_/g, ' ')}</span>
                  <span>{status.currentBooking.progress}%</span>
                </div>
              </div>
            )}

            {/* Status actions */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="outline" className="w-full">
                  <ArrowRight className="h-3 w-3 mr-1" />
                  Update Status
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuLabel>Change Status</DropdownMenuLabel>
                <DropdownMenuSeparator />
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
          </div>
        ) : (
          <div className="text-center py-4">
            <Badge variant="secondary" className="mb-2">Available</Badge>
            {upcoming && (
              <div className="text-xs text-muted-foreground mt-2">
                <p>Next: {format(new Date(upcoming.booking_time), 'h:mm a')}</p>
                <p className="truncate">{upcoming.user?.full_name || upcoming.guest_name}</p>
              </div>
            )}
          </div>
        )}

        {/* Drag handle for occupied tables */}
        {isOccupied && current && (
          <div
            className="absolute top-1 right-1 p-1 bg-gray-200 rounded cursor-move hover:bg-gray-300 text-gray-700"
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
            <Hand className="h-3 w-3" />
          </div>
        )}
      </div>
    )
  }

  return (
    <Card className="h-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Floor Plan & Table Management</CardTitle>
            <CardDescription>
              Real-time table status with drag-and-drop reassignment
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {/* View mode toggle */}
            <div className="flex gap-1">
              <Button
                size="sm"
                variant={viewMode === "grid" ? "default" : "outline"}
                onClick={() => setViewMode("grid")}
              >
                <Grid3X3 className="h-4 w-4" />
              </Button>
              <Button
                size="sm"
                variant={viewMode === "floor" ? "default" : "outline"}
                onClick={() => setViewMode("floor")}
              >
                <Maximize2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <TooltipProvider>
          {viewMode === "grid" ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {tables.filter(t => t.is_active).map(renderTableCard)}
            </div>
          ) : (
            <div 
              className="relative bg-slate-50 rounded-lg border-2 border-dashed border-slate-300"
              style={{ height: "700px" }}
            >
              {tables.filter(t => t.is_active).map(renderTableCard)}
              
              {/* Legend */}
              <div className="absolute bottom-4 left-4 bg-white/95 rounded-lg p-4 border shadow-lg text-gray-900">
                <h4 className="font-semibold mb-2 text-sm text-gray-900">Status Legend</h4>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="flex items-center gap-1">
                    <UserCheck className="h-3 w-3 text-indigo-600" />
                    <span className="text-gray-700">Arrived</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <ChefHat className="h-3 w-3 text-purple-600" />
                    <span className="text-gray-700">Seated</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Utensils className="h-3 w-3 text-green-600" />
                    <span className="text-gray-700">Dining</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <CreditCard className="h-3 w-3 text-yellow-600" />
                    <span className="text-gray-700">Payment</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </TooltipProvider>
      </CardContent>
    </Card>
  )
}