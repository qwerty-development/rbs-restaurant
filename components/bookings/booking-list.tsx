// components/bookings/booking-list.tsx
import { format } from "date-fns"
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
  Clock, 
  Users, 
  Phone, 
  MoreHorizontal,
  CheckCircle,
  XCircle,
  AlertCircle
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

const STATUS_CONFIG = {
  pending: { 
    label: "Pending", 
    variant: "secondary" as const, 
    icon: AlertCircle,
    color: "text-yellow-600"
  },
  confirmed: { 
    label: "Confirmed", 
    variant: "default" as const, 
    icon: CheckCircle,
    color: "text-green-600"
  },
  cancelled_by_user: { 
    label: "Cancelled", 
    variant: "destructive" as const, 
    icon: XCircle,
    color: "text-red-600"
  },
  declined_by_restaurant: { 
    label: "Declined", 
    variant: "destructive" as const, 
    icon: XCircle,
    color: "text-red-600"
  },
  completed: { 
    label: "Completed", 
    variant: "outline" as const, 
    icon: CheckCircle,
    color: "text-gray-600"
  },
  no_show: { 
    label: "No Show", 
    variant: "destructive" as const, 
    icon: XCircle,
    color: "text-red-600"
  },
}

export function BookingList({ 
  bookings, 
  isLoading, 
  onSelectBooking, 
  onUpdateStatus,
  compact = false 
}: BookingListProps) {
  if (isLoading) {
    return (
      <div className="text-center py-8">
        Loading bookings...
      </div>
    )
  }

  if (bookings.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No bookings found
      </div>
    )
  }

  if (compact) {
    return (
      <div className="space-y-2">
        {bookings.map((booking) => {
          const status = STATUS_CONFIG[booking.status]
          const StatusIcon = status.icon
          
          return (
            <div
              key={booking.id}
              className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 cursor-pointer"
              onClick={() => onSelectBooking(booking)}
            >
              <div className="flex items-center gap-3">
                <div>
                  <div className="font-medium">
                    {booking.guest_name || booking.user?.full_name || "Guest"}
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    {format(new Date(booking.booking_time), "h:mm a")}
                    <span>•</span>
                    <Users className="h-3 w-3" />
                    {booking.party_size}
                  </div>
                </div>
              </div>
              <Badge variant={status.variant}>
                <StatusIcon className="mr-1 h-3 w-3" />
                {status.label}
              </Badge>
            </div>
          )
        })}
      </div>
    )
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Guest</TableHead>
          <TableHead>Date & Time</TableHead>
          <TableHead>Party</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Confirmation</TableHead>
          <TableHead>Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {bookings.map((booking) => {
          const status = STATUS_CONFIG[booking.status]
          const StatusIcon = status.icon
          
          return (
            <TableRow key={booking.id}>
              <TableCell>
                <div>
                  <div className="font-medium">
                    {booking.guest_name || booking.user?.full_name || "Guest"}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {booking.guest_email || booking.user?.email}
                  </div>
                </div>
              </TableCell>
              <TableCell>
                <div>
                  <div className="font-medium">
                    {format(new Date(booking.booking_time), "MMM d, yyyy")}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {format(new Date(booking.booking_time), "h:mm a")}
                  </div>
                </div>
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-1">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  {booking.party_size}
                </div>
              </TableCell>
              <TableCell>
                <Badge variant={status.variant} className="gap-1">
                  <StatusIcon className="h-3 w-3" />
                  {status.label}
                </Badge>
              </TableCell>
              <TableCell>
                <code className="text-xs bg-muted px-2 py-1 rounded">
                  {booking.confirmation_code}
                </code>
              </TableCell>
              <TableCell>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuLabel>Actions</DropdownMenuLabel>
                    <DropdownMenuItem onClick={() => onSelectBooking(booking)}>
                      View Details
                    </DropdownMenuItem>
                    {booking.user?.phone_number && (
                      <DropdownMenuItem>
                        <Phone className="mr-2 h-4 w-4" />
                        Call Guest
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuSeparator />
                    {booking.status === "pending" && (
                      <>
                        <DropdownMenuItem 
                          onClick={() => onUpdateStatus(booking.id, "confirmed")}
                          className="text-green-600"
                        >
                          <CheckCircle className="mr-2 h-4 w-4" />
                          Confirm Booking
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          onClick={() => onUpdateStatus(booking.id, "declined_by_restaurant")}
                          className="text-red-600"
                        >
                          <XCircle className="mr-2 h-4 w-4" />
                          Decline Booking
                        </DropdownMenuItem>
                      </>
                    )}
                    {booking.status === "confirmed" && (
                      <>
                        <DropdownMenuItem 
                          onClick={() => onUpdateStatus(booking.id, "completed")}
                        >
                          Mark as Completed
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          onClick={() => onUpdateStatus(booking.id, "no_show")}
                          className="text-red-600"
                        >
                          Mark as No Show
                        </DropdownMenuItem>
                      </>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          )
        })}
      </TableBody>
    </Table>
  )
}