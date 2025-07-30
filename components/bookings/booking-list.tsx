// components/bookings/booking-list.tsx
"use client"

import { format } from "date-fns"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "../ui/skeleton"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { 
  Clock, 
  Users, 
  Phone, 
  MoreVertical,
  CheckCircle,
  XCircle,
  AlertCircle,
  Table2
} from "lucide-react"
import type { Booking } from "@/types"

interface BookingListProps {
  bookings: Booking[]
  isLoading: boolean
  onSelectBooking: (booking: Booking) => void
  onUpdateStatus: (bookingId: string, status: Booking['status']) => void
  compact?: boolean
}

export function BookingList({
  bookings,
  isLoading,
  onSelectBooking,
  onUpdateStatus,
  compact = false
}: BookingListProps) {
  const getStatusIcon = (status: Booking['status']) => {
    switch (status) {
      case 'confirmed':
        return <CheckCircle className="h-4 w-4 text-green-600" />
      case 'pending':
        return <AlertCircle className="h-4 w-4 text-yellow-600" />
      case 'cancelled_by_user':
      case 'declined_by_restaurant':
        return <XCircle className="h-4 w-4 text-red-600" />
      default:
        return null
    }
  }

  const getStatusColor = (status: Booking['status']) => {
    switch (status) {
      case 'confirmed':
        return 'default'
      case 'pending':
        return 'secondary'
      case 'completed':
        return 'outline'
      case 'cancelled_by_user':
      case 'declined_by_restaurant':
        return 'destructive'
      case 'no_show':
        return 'destructive'
      default:
        return 'secondary'
    }
  }

  const formatGuestName = (booking: Booking) => {
    return booking.user?.full_name || booking.guest_name || 'Guest'
  }

  const formatGuestPhone = (booking: Booking) => {
    return booking.user?.phone_number || booking.guest_phone || 'No phone'
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <Card key={i}>
            <CardHeader>
              <Skeleton className="h-4 w-[200px]" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-4 w-[150px]" />
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  if (bookings.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <p className="text-muted-foreground">No bookings found</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {bookings.map((booking:any) => {
        const bookingTime = new Date(booking.booking_time)
        const hasAssignedTables = booking.tables && booking.tables.length > 0

        return (
          <Card
            key={booking.id}
            className="cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => onSelectBooking(booking)}
          >
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-lg">
                      {formatGuestName(booking)}
                    </h3>
                    <Badge variant={getStatusColor(booking.status)}>
                      <span className="flex items-center gap-1">
                        {getStatusIcon(booking.status)}
                        {booking.status.replace(/_/g, ' ')}
                      </span>
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Confirmation: <span className="font-mono">{booking.confirmation_code}</span>
                  </p>
                </div>
                
                <DropdownMenu>
                  <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                    <Button variant="ghost" size="icon">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuLabel>Actions</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {booking.status === 'pending' && (
                      <>
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.stopPropagation()
                            onUpdateStatus(booking.id, 'confirmed')
                          }}
                        >
                          <CheckCircle className="mr-2 h-4 w-4" />
                          Confirm Booking
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.stopPropagation()
                            onUpdateStatus(booking.id, 'declined_by_restaurant')
                          }}
                          className="text-destructive"
                        >
                          <XCircle className="mr-2 h-4 w-4" />
                          Decline Booking
                        </DropdownMenuItem>
                      </>
                    )}
                    {booking.status === 'confirmed' && (
                      <>
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.stopPropagation()
                            onUpdateStatus(booking.id, 'completed')
                          }}
                        >
                          <CheckCircle className="mr-2 h-4 w-4" />
                          Mark as Completed
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.stopPropagation()
                            onUpdateStatus(booking.id, 'no_show')
                          }}
                          className="text-destructive"
                        >
                          <XCircle className="mr-2 h-4 w-4" />
                          Mark as No Show
                        </DropdownMenuItem>
                      </>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </CardHeader>
            
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span>{format(bookingTime, compact ? 'h:mm a' : 'MMM d, h:mm a')}</span>
                </div>
                
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <span>{booking.party_size} guests</span>
                </div>
                
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <span>{formatGuestPhone(booking)}</span>
                </div>

                <div className="flex items-center gap-2">
                  <Table2 className="h-4 w-4 text-muted-foreground" />
                  <span>
                    {hasAssignedTables ? (
                      booking.tables.map((t: { table_number: any }) => t.table_number).join(", ")
                    ) : (
                      <span className="text-yellow-600">No table assigned</span>
                    )}
                  </span>
                </div>
              </div>

              {booking.special_requests && (
                <div className="mt-3 p-2 bg-muted rounded text-sm">
                  <p className="font-medium">Special requests:</p>
                  <p className="text-muted-foreground">{booking.special_requests}</p>
                </div>
              )}

              {booking.occasion && (
                <Badge variant="secondary" className="mt-2">
                  🎉 {booking.occasion}
                </Badge>
              )}

              {!hasAssignedTables && booking.status === 'confirmed' && (
                <div className="mt-3 p-2 bg-yellow-50 dark:bg-yellow-900/20 rounded text-sm">
                  <p className="text-yellow-800 dark:text-yellow-200 flex items-center gap-2">
                    <AlertCircle className="h-4 w-4" />
                    Table assignment required
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}