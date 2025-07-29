// components/dashboard/recent-bookings.tsx
import { format } from "date-fns"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ArrowUpRight } from "lucide-react"
import Link from "next/link"
import type { Booking } from "@/types"

interface RecentBookingsProps {
  bookings: Booking[]
}

const STATUS_VARIANTS = {
  pending: "secondary",
  confirmed: "default",
  completed: "outline",
  cancelled_by_user: "destructive",
  declined_by_restaurant: "destructive",
  no_show: "destructive",
} as const

export function RecentBookings({ bookings }: RecentBookingsProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Recent Bookings</CardTitle>
            <CardDescription>Latest customer reservations</CardDescription>
          </div>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/bookings">
              View all
              <ArrowUpRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {bookings.length === 0 ? (
            <p className="text-center text-muted-foreground py-4">
              No recent bookings
            </p>
          ) : (
            bookings.map((booking) => (
              <div
                key={booking.id}
                className="flex items-center justify-between space-x-4"
              >
                <div className="flex-1 space-y-1">
                  <p className="text-sm font-medium leading-none">
                    {booking.user?.full_name || booking.guest_name || "Guest"}
                  </p>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span>{format(new Date(booking.booking_time), "MMM d, h:mm a")}</span>
                    <span>•</span>
                    <span>{booking.party_size} guests</span>
                  </div>
                </div>
                <Badge variant={STATUS_VARIANTS[booking.status]}>
                  {booking.status.replace(/_/g, " ")}
                </Badge>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  )
}

