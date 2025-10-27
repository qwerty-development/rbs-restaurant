// components/bookings/collapsed-booking-view.tsx
"use client"

import { useState } from "react"
import { format, parseISO } from "date-fns"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { 
  Calendar,
  Clock,
  Users,
  Phone,
  AlertCircle,
  CheckCircle,
  XCircle,
  Timer,
  MoreVertical,
  Loader2,
  Check,
  X
} from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"
import { createClient } from "@/lib/supabase/client"
import { toast } from "react-hot-toast"
import type { Booking } from "@/types"

interface CollapsedBookingViewProps {
  bookings: Booking[]
  isLoading: boolean
  onSelectBooking: (booking: Booking) => void
  onUpdateStatus: (bookingId: string, status: string) => void
  onCancelBooking?: (booking: Booking) => void
  restaurantId?: string
  onRefresh?: () => void
}

const STATUS_CONFIG: Record<string, { icon: any; color: string; bgColor: string; label: string }> = {
  'pending': {
    icon: Timer,
    color: 'text-yellow-600',
    bgColor: 'bg-yellow-100',
    label: 'Pending'
  },
  'confirmed': {
    icon: CheckCircle,
    color: 'text-blue-600',
    bgColor: 'bg-blue-100',
    label: 'Confirmed'
  },
  'arrived': {
    icon: AlertCircle,
    color: 'text-indigo-600',
    bgColor: 'bg-indigo-100',
    label: 'Arrived'
  },
  'seated': {
    icon: Users,
    color: 'text-purple-600',
    bgColor: 'bg-purple-100',
    label: 'Seated'
  },
  'ordered': {
    icon: Clock,
    color: 'text-orange-600',
    bgColor: 'bg-orange-100',
    label: 'Ordered'
  },
  'appetizers': {
    icon: Users,
    color: 'text-green-600',
    bgColor: 'bg-green-100',
    label: 'Appetizers'
  },
  'main_course': { 
    icon: Users, 
    color: 'text-green-700', 
    bgColor: 'bg-green-200',
    label: 'Main Course'
  },
  'dessert': { 
    icon: Users, 
    color: 'text-pink-600', 
    bgColor: 'bg-pink-100',
    label: 'Dessert'
  },
  'payment': { 
    icon: Clock, 
    color: 'text-yellow-700', 
    bgColor: 'bg-yellow-200',
    label: 'Payment'
  },
  'completed': { 
    icon: CheckCircle, 
    color: 'text-gray-600', 
    bgColor: 'bg-gray-100',
    label: 'Completed'
  },
  'cancelled_by_user': { 
    icon: XCircle, 
    color: 'text-red-600', 
    bgColor: 'bg-red-100',
    label: 'Cancelled by User'
  },
  'cancelled_by_restaurant': { 
    icon: XCircle, 
    color: 'text-red-600', 
    bgColor: 'bg-red-100',
    label: 'Cancelled by Restaurant'
  },
  'declined_by_restaurant': { 
    icon: XCircle, 
    color: 'text-red-600', 
    bgColor: 'bg-red-100',
    label: 'Declined'
  },
  'no_show': { 
    icon: AlertCircle, 
    color: 'text-red-600', 
    bgColor: 'bg-red-100',
    label: 'No Show'
  }
}

export function CollapsedBookingView({
  bookings,
  isLoading,
  onSelectBooking,
  onUpdateStatus,
  onCancelBooking,
  restaurantId,
  onRefresh
}: CollapsedBookingViewProps) {
  const [tableInputs, setTableInputs] = useState<Record<string, string>>({})
  const [isUpdatingTable, setIsUpdatingTable] = useState<Record<string, boolean>>({})
  const [editingTable, setEditingTable] = useState<Record<string, boolean>>({})
  const [localTableAssignments, setLocalTableAssignments] = useState<Record<string, string>>({})
  const supabase = createClient()

  const handleTableChange = (bookingId: string, value: string) => {
    setTableInputs(prev => ({
      ...prev,
      [bookingId]: value
    }))
  }

  const handleTableClick = (bookingId: string, currentTable: string) => {
    setEditingTable(prev => ({ ...prev, [bookingId]: true }))
    setTableInputs(prev => ({ ...prev, [bookingId]: currentTable }))
  }

  const handleCancelEdit = (bookingId: string) => {
    setEditingTable(prev => ({ ...prev, [bookingId]: false }))
    setTableInputs(prev => ({ ...prev, [bookingId]: '' }))
  }

  const handleApplyTable = async (bookingId: string) => {
    const tableNumber = tableInputs[bookingId]?.trim()
    if (!tableNumber) {
      toast.error("Please enter a table number")
      return
    }

    setIsUpdatingTable(prev => ({ ...prev, [bookingId]: true }))

    try {
      // Update the booking with the assigned table number
      const { error } = await supabase
        .from('bookings')
        .update({ 
          assigned_table: tableNumber,
          updated_at: new Date().toISOString()
        })
        .eq('id', bookingId)

      if (error) {
        console.error('Error updating table assignment:', error)
        toast.error("Failed to assign table")
        return
      }

      toast.success(`Table ${tableNumber} assigned successfully`)
      
      // Update local state to show the new table assignment immediately
      setLocalTableAssignments(prev => ({ ...prev, [bookingId]: tableNumber }))
      
      // Clear the input and exit edit mode after successful update
      setTableInputs(prev => ({ ...prev, [bookingId]: '' }))
      setEditingTable(prev => ({ ...prev, [bookingId]: false }))
      
      // Trigger refresh to get updated data from database
      if (onRefresh) {
        onRefresh()
      }
      
    } catch (error) {
      console.error('Error updating table assignment:', error)
      toast.error("Failed to assign table")
    } finally {
      setIsUpdatingTable(prev => ({ ...prev, [bookingId]: false }))
    }
  }

  const formatGuestName = (booking: Booking) => {
    // Handle both array and object formats for profiles
    const customer = Array.isArray(booking.profiles) ? booking.profiles[0] : booking.profiles
    return booking.guest_name || customer?.full_name || 'Guest'
  }

  const formatGuestPhone = (booking: Booking) => {
    const customer = Array.isArray(booking.profiles) ? booking.profiles[0] : booking.profiles
    return booking.guest_phone || customer?.phone_number || 'No phone'
  }

  const formatGuestEmail = (booking: Booking) => {
    const customer = Array.isArray(booking.profiles) ? booking.profiles[0] : booking.profiles
    return booking.guest_email || customer?.email || ''
  }

  const getAssignedTable = (booking: Booking) => {
    // Check local state first (for recently assigned tables)
    if (localTableAssignments[booking.id]) {
      return localTableAssignments[booking.id]
    }
    
    // Check if assigned_table field exists and has a valid value
    // booking.assigned_table will be null (object) if not set, so we need to check for that
    if (booking.assigned_table !== null && 
        booking.assigned_table !== undefined && 
        booking.assigned_table.trim() !== '') {
      return booking.assigned_table
    }
    
    return null
  }

  const getStatusBadgeVariant = (status: string): any => {
    const diningStatuses = ['seated', 'ordered', 'appetizers', 'main_course', 'dessert', 'payment']
    
    if (diningStatuses.includes(status)) return 'default'
    if (status === 'confirmed') return 'secondary'
    if (status === 'pending') return 'outline'
    if (status === 'arrived') return 'default'
    if (status === 'completed') return 'outline'
    if (['cancelled_by_user', 'cancelled_by_restaurant', 'declined_by_restaurant', 'no_show'].includes(status)) {
      return 'destructive'
    }
    return 'secondary'
  }

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[...Array(5)].map((_, i) => (
          <Card key={i}>
            <CardContent className="p-4">
              <div className="animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                <div className="h-3 bg-gray-200 rounded w-1/2"></div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  if (bookings.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">No bookings found</h3>
          <p className="text-muted-foreground">No bookings match your current filters</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-2">
      {bookings.map((booking) => {
        const bookingTime = new Date(booking.booking_time)
        const statusConfig = STATUS_CONFIG[booking.status] || STATUS_CONFIG['pending']
        const StatusIcon = statusConfig.icon
        const customer = Array.isArray(booking.profiles) ? booking.profiles[0] : booking.profiles

        return (
          <Card
            key={booking.id}
            className={cn(
              "transition-all duration-200 hover:shadow-md",
              booking.status === "pending" && "border-l-4 border-l-yellow-500 bg-yellow-50/30"
            )}
          >
            <CardContent className="p-4">
              <div className="grid grid-cols-8 gap-4 items-center w-full">
                {/* Guest Name */}
                <div className="col-span-2 min-w-0">
                  <h3 className="font-semibold text-lg truncate">
                    {formatGuestName(booking)}
                  </h3>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span className="font-mono">#{booking.confirmation_code}</span>
                    {booking.occasion && (
                      <Badge variant="secondary" className="text-xs">
                        🎉 {booking.occasion}
                      </Badge>
                    )}
                  </div>
                </div>

                {/* Phone */}
                <div className="hidden sm:block">
                  <div className="flex items-center gap-1 text-sm">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium truncate">{formatGuestPhone(booking)}</span>
                  </div>
                </div>

                {/* Guests */}
                <div className="hidden sm:block">
                  <div className="flex items-center gap-1 text-sm">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">{booking.party_size}</span>
                  </div>
                </div>

                {/* Date & Time */}
                <div className="hidden md:block">
                  <div className="flex items-center gap-1 text-sm">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">{format(bookingTime, "MMM d")}</span>
                  </div>
                  <div className="flex items-center gap-1 text-sm">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">{format(bookingTime, "h:mm a")}</span>
                  </div>
                </div>

                {/* Table Assignment - Inline */}
                <div className="hidden lg:block">
                  <div className="flex items-center gap-2">

{booking.status === 'confirmed' && editingTable[booking.id] ? (
  <div className="relative w-36"> {/* wider to accommodate buttons */}
    <Input
      placeholder="Table #"
      value={tableInputs[booking.id] || ""}
      onChange={(e) => handleTableChange(booking.id, e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter") handleApplyTable(booking.id);
        if (e.key === "Escape") handleCancelEdit(booking.id);
      }}
      autoFocus
      className="
        h-8 w-full text-xs pr-16
        rounded-md
        transition-[box-shadow,background-color,border-color]
        border-blue-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500
      "
    />

    {/* End adornment inside input */}
    <div className="absolute inset-y-0 right-1 flex items-center">
      <div className="flex items-center -space-x-4">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          disabled={isUpdatingTable[booking.id]}
          onClick={() => handleApplyTable(booking.id)}
          className="
            h-6 w-6 rounded-md
            hover:bg-muted/70
            focus-visible:ring-1 focus-visible:ring-blue-500
            transition
          "
          aria-label="Apply"
          title="Apply"
        >
          {isUpdatingTable[booking.id]
            ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
            : <Check className="h-3.5 w-3.5" />}
        </Button>

        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => handleCancelEdit(booking.id)}
          className="
            h-6 w-6 rounded-md p-0
            hover:bg-muted/70
            focus-visible:ring-1 focus-visible:ring-blue-500
            transition
          "
          aria-label="Cancel"
          title="Cancel"
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  </div>
) : booking.status === 'confirmed' ? (
  <div
    className="flex items-center gap-2 cursor-pointer group"
    onClick={() => {
      const currentTable = getAssignedTable(booking);
      if (currentTable) {
        handleTableClick(booking.id, currentTable);
      } else {
        setEditingTable((prev) => ({ ...prev, [booking.id]: true }));
        setTableInputs((prev) => ({ ...prev, [booking.id]: "" }));
      }
    }}
  >
    <span className="font-medium text-sm group-hover:text-blue-600 transition-colors">
      {getAssignedTable(booking) ? `Table ${getAssignedTable(booking)}` : "Assign table"}
    </span>
    <span className="text-xs text-muted-foreground group-hover:text-blue-600 transition-colors">✏️</span>
  </div>
) : (
  <span className="font-medium text-sm text-muted-foreground">
    {getAssignedTable(booking) ? `Table ${getAssignedTable(booking)}` : "No table"}
  </span>
)}

                  </div>
                </div>

                {/* Status Icon + Badge */}
                <div className="flex items-center gap-2">
                  <StatusIcon className={cn("h-4 w-4", statusConfig.color)} />
                  <Badge 
                    variant={getStatusBadgeVariant(booking.status)}
                    className={cn(statusConfig.bgColor, statusConfig.color, "px-3 py-1 text-xs")}
                  >
                    {statusConfig.label}
                  </Badge>
                </div>

                {/* Actions */}
                <div className="flex justify-center items-center">
                  {booking.status === "confirmed" && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 hover:bg-gray-100"
                        >
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() => onUpdateStatus(booking.id, "no_show")}
                          className="text-red-600"
                        >
                          <XCircle className="h-4 w-4 mr-2" />
                          Mark No Show
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => onCancelBooking?.(booking)}
                          className="text-red-600"
                        >
                          <XCircle className="h-4 w-4 mr-2" />
                          Cancel Booking
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => {
                            const ok = confirm(
                              "You should only mark 'Cancelled by Customer' if the customer called the restaurant and cancelled (inside cancellation window)."
                            )
                            if (!ok) return
                            onUpdateStatus(booking.id, "cancelled_by_user")
                          }}
                          className="text-red-600"
                        >
                          <XCircle className="h-4 w-4 mr-2" />
                          Cancelled by Customer
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
