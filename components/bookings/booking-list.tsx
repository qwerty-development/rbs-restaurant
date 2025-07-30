// components/bookings/booking-list.tsx
"use client"

import { format } from "date-fns"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { 
  Calendar, 
  Clock, 
  Users, 
  Phone, 
  Mail,
  MoreHorizontal,
  CheckCircle,
  XCircle,
  Clock3
} from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import type { Booking } from "@/types"

interface BookingListProps {
  bookings: Booking[]
  isLoading: boolean
  onSelectBooking: (booking: Booking) => void
  onUpdateStatus: (bookingId: string, status: string) => void
  compact?: boolean
}

export function BookingList({ 
  bookings, 
  isLoading, 
  onSelectBooking, 
  onUpdateStatus,
  compact = false 
}: BookingListProps) {
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'confirmed':
        return <CheckCircle className="h-4 w-4" />
      case 'pending':
        return <Clock3 className="h-4 w-4" />
      case 'cancelled_by_user':
      case 'declined_by_restaurant':
        return <XCircle className="h-4 w-4" />
      default:
        return null
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'confirmed':
        return 'bg-green-100 text-green-800'
      case 'pending':
        return 'bg-yellow-100 text-yellow-800'
      case 'completed':
        return 'bg-blue-100 text-blue-800'
      case 'cancelled_by_user':
      case 'declined_by_restaurant':
        return 'bg-red-100 text-red-800'
      case 'no_show':
        return 'bg-gray-100 text-gray-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="text-center text-muted-foreground">
            Loading bookings...
          </div>
        </CardContent>
      </Card>
    )
  }

  if (bookings.length === 0) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="text-center text-muted-foreground">
            No bookings found
          </div>
        </CardContent>
      </Card>
    )
  }

  const getDisplayName = (booking: Booking) => {
    return booking.user?.full_name || booking.guest_name || 'Guest'
  }

  const getDisplayPhone = (booking: Booking) => {
    return booking.user?.phone_number || booking.guest_phone || '-'
  }

  const getDisplayEmail = (booking: Booking) => {
    return booking.user?.email || booking.guest_email || '-'
  }

  if (compact) {
    return (
      <div className="space-y-2">
        {bookings.map((booking) => {
          const bookingDate = new Date(booking.booking_time)
          
          return (
            <Card 
              key={booking.id} 
              className="cursor-pointer hover:bg-muted/50 transition-colors"
              onClick={() => onSelectBooking(booking)}
            >
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-4">
                      <div>
                        <p className="font-medium">{getDisplayName(booking)}</p>
                        <p className="text-sm text-muted-foreground">
                          {format(bookingDate, "h:mm a")} • {booking.party_size} guests
                        </p>
                      </div>
                    </div>
                  </div>
                  <Badge className={getStatusColor(booking.status)}>
                    {getStatusIcon(booking.status)}
                    <span className="ml-1">{booking.status.replace(/_/g, ' ')}</span>
                  </Badge>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>
    )
  }

  return (
    <Card>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Guest</TableHead>
              <TableHead>Contact</TableHead>
              <TableHead>Date & Time</TableHead>
              <TableHead>Party</TableHead>
              <TableHead>Tables</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {bookings.map((booking) => {
              const bookingDate = new Date(booking.booking_time)
              
              return (
                <TableRow 
                  key={booking.id} 
                  className="cursor-pointer"
                  onClick={() => onSelectBooking(booking)}
                >
                  <TableCell>
                    <div>
                      <p className="font-medium">{getDisplayName(booking)}</p>
                      <p className="text-xs text-muted-foreground">
                        {booking.confirmation_code}
                      </p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      <div className="flex items-center gap-1 text-sm">
                        <Phone className="h-3 w-3" />
                        {getDisplayPhone(booking)}
                      </div>
                      <div className="flex items-center gap-1 text-sm">
                        <Mail className="h-3 w-3" />
                        {getDisplayEmail(booking)}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      <div className="flex items-center gap-1 text-sm">
                        <Calendar className="h-3 w-3" />
                        {format(bookingDate, "MMM d, yyyy")}
                      </div>
                      <div className="flex items-center gap-1 text-sm">
                        <Clock className="h-3 w-3" />
                        {format(bookingDate, "h:mm a")}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Users className="h-4 w-4" />
                      {booking.party_size}
                    </div>
                  </TableCell>
                  <TableCell>
                    {booking.tables && booking.tables.length > 0 ? (
                      <div className="flex gap-1">
                        {booking.tables.map((table) => (
                          <Badge key={table.id} variant="outline">
                            {table.table_number}
                          </Badge>
                        ))}
                      </div>
                    ) : (
                      <span className="text-sm text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge className={getStatusColor(booking.status)}>
                      {booking.status.replace(/_/g, ' ')}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Actions</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.stopPropagation()
                            onUpdateStatus(booking.id, 'confirmed')
                          }}
                        >
                          Confirm Booking
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.stopPropagation()
                            onUpdateStatus(booking.id, 'completed')
                          }}
                        >
                          Mark as Completed
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.stopPropagation()
                            onUpdateStatus(booking.id, 'no_show')
                          }}
                          className="text-red-600"
                        >
                          Mark as No Show
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}