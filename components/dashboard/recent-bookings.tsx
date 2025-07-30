// components/dashboard/recent-bookings.tsx
"use client"

import { format } from "date-fns"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Users, Calendar, Clock } from "lucide-react"

interface Booking {
  id: string
  confirmation_code: string
  booking_time: string
  party_size: number
  status: string
  guest_name?: string | null
  guest_phone?: string | null
  user?: {
    full_name: string
    phone_number?: string | null
  } | null
}

interface RecentBookingsProps {
  bookings: Booking[]
}

export function RecentBookings({ bookings }: RecentBookingsProps) {
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
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const getDisplayName = (booking: Booking) => {
    return booking.user?.full_name || booking.guest_name || 'Guest'
  }

  const getDisplayPhone = (booking: Booking) => {
    return booking.user?.phone_number || booking.guest_phone || '-'
  }

  if (!bookings || bookings.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Recent Bookings</CardTitle>
          <CardDescription>
            Your latest restaurant reservations
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            No recent bookings found
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Bookings</CardTitle>
        <CardDescription>
          Your latest restaurant reservations
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Guest</TableHead>
              <TableHead>Date & Time</TableHead>
              <TableHead>Party</TableHead>
              <TableHead>Code</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {bookings.map((booking) => {
              const bookingDate = new Date(booking.booking_time)
              
              return (
                <TableRow key={booking.id}>
                  <TableCell>
                    <div>
                      <p className="font-medium">{getDisplayName(booking)}</p>
                      <p className="text-sm text-muted-foreground">
                        {getDisplayPhone(booking)}
                      </p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2 text-sm">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      {format(bookingDate, "MMM d")}
                      <Clock className="h-4 w-4 text-muted-foreground ml-2" />
                      {format(bookingDate, "h:mm a")}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Users className="h-4 w-4 text-muted-foreground" />
                      {booking.party_size}
                    </div>
                  </TableCell>
                  <TableCell>
                    <code className="text-xs">{booking.confirmation_code}</code>
                  </TableCell>
                  <TableCell>
                    <Badge className={getStatusColor(booking.status)}>
                      {booking.status.replace(/_/g, ' ')}
                    </Badge>
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