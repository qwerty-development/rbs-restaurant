// components/bookings/booking-details.tsx
import { format } from "date-fns"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { 
  Calendar, 
  Clock, 
  Users, 
  Phone, 
  Mail,
  MessageSquare,
  Utensils,
  CreditCard,
  AlertCircle
} from "lucide-react"
import type { Booking } from "@/types"

interface BookingDetailsProps {
  booking: Booking
  onClose: () => void
  onUpdateStatus: (status: string) => void
}

export function BookingDetails({ booking, onClose, onUpdateStatus }: BookingDetailsProps) {
  const STATUS_CONFIG = {
    pending: { label: "Pending", variant: "secondary" as const },
    confirmed: { label: "Confirmed", variant: "default" as const },
    cancelled_by_user: { label: "Cancelled by User", variant: "destructive" as const },
    declined_by_restaurant: { label: "Declined", variant: "destructive" as const },
    completed: { label: "Completed", variant: "outline" as const },
    no_show: { label: "No Show", variant: "destructive" as const },
  }

  const status = STATUS_CONFIG[booking.status]

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Booking Details</DialogTitle>
          <DialogDescription>
            Confirmation Code: <code className="bg-muted px-2 py-1 rounded">{booking.confirmation_code}</code>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Status */}
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Status</span>
            <Badge variant={status.variant}>{status.label}</Badge>
          </div>

          <Separator />

          {/* Guest Information */}
          <div className="space-y-3">
            <h4 className="font-medium">Guest Information</h4>
            <div className="grid gap-3 text-sm">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">Name:</span>
                <span>{booking.guest_name || booking.user?.full_name || "N/A"}</span>
              </div>
              {(booking.guest_email || booking.user?.email) && (
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">Email:</span>
                  <span>{booking.guest_email || booking.user?.email}</span>
                </div>
              )}
              {(booking.guest_phone || booking.user?.phone_number) && (
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">Phone:</span>
                  <span>{booking.guest_phone || booking.user?.phone_number}</span>
                </div>
              )}
            </div>
          </div>

          <Separator />

          {/* Booking Details */}
          <div className="space-y-3">
            <h4 className="font-medium">Booking Details</h4>
            <div className="grid gap-3 text-sm">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">Date:</span>
                <span>{format(new Date(booking.booking_time), "EEEE, MMMM d, yyyy")}</span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">Time:</span>
                <span>{format(new Date(booking.booking_time), "h:mm a")}</span>
              </div>
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">Party Size:</span>
                <span>{booking.party_size} guests</span>
              </div>
            </div>
          </div>

          {/* Special Requests */}
          {(booking.special_requests || booking.dietary_notes || booking.occasion) && (
            <>
              <Separator />
              <div className="space-y-3">
                <h4 className="font-medium">Special Requirements</h4>
                {booking.occasion && (
                  <div className="flex items-start gap-2 text-sm">
                    <AlertCircle className="h-4 w-4 text-muted-foreground mt-0.5" />
                    <div>
                      <span className="font-medium">Occasion:</span>
                      <p className="text-muted-foreground">{booking.occasion}</p>
                    </div>
                  </div>
                )}
                {booking.dietary_notes && booking.dietary_notes.length > 0 && (
                  <div className="flex items-start gap-2 text-sm">
                    <Utensils className="h-4 w-4 text-muted-foreground mt-0.5" />
                    <div>
                      <span className="font-medium">Dietary Restrictions:</span>
                      <p className="text-muted-foreground">{booking.dietary_notes.join(", ")}</p>
                    </div>
                  </div>
                )}
                {booking.special_requests && (
                  <div className="flex items-start gap-2 text-sm">
                    <MessageSquare className="h-4 w-4 text-muted-foreground mt-0.5" />
                    <div>
                      <span className="font-medium">Special Requests:</span>
                      <p className="text-muted-foreground">{booking.special_requests}</p>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}

          {/* Assigned Tables */}
          {booking.tables && booking.tables.length > 0 && (
            <>
              <Separator />
              <div className="space-y-3">
                <h4 className="font-medium">Assigned Tables</h4>
                <div className="flex gap-2">
                  {booking.tables.map((tableAssignment:any) => (
                    <Badge key={tableAssignment.table.id} variant="secondary">
                      Table {tableAssignment.table.table_number}
                    </Badge>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Actions */}
          <Separator />
          <div className="flex justify-end gap-2">
            {booking.status === "pending" && (
              <>
                <Button
                  variant="outline"
                  onClick={() => onUpdateStatus("declined_by_restaurant")}
                >
                  Decline
                </Button>
                <Button
                  onClick={() => onUpdateStatus("confirmed")}
                >
                  Confirm Booking
                </Button>
              </>
            )}
            {booking.status === "confirmed" && (
              <>
                <Button
                  variant="outline"
                  onClick={() => onUpdateStatus("no_show")}
                >
                  Mark No Show
                </Button>
                <Button
                  onClick={() => onUpdateStatus("completed")}
                >
                  Mark Completed
                </Button>
              </>
            )}
            <Button variant="outline" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}