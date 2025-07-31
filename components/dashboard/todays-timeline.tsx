// components/dashboard/todays-timeline.tsx
"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area"
import { 
  Clock, 
  Users, 
  Table2,
  AlertCircle,
  CheckCircle,
  XCircle,
  ChevronRight,
  Timer,
  Phone,
  MessageSquare,
  Calendar
} from "lucide-react"
import { format, addMinutes, isWithinInterval, startOfDay, addHours, differenceInMinutes } from "date-fns"
import { cn } from "@/lib/utils"

interface TodaysTimelineProps {
  bookings: any[]
  currentTime: Date
  onSelectBooking: (booking: any) => void
  onUpdateStatus: (bookingId: string, status: string) => void
  customersData?: Record<string, any>
}

export function TodaysTimeline({ 
  bookings, 
  currentTime, 
  onSelectBooking,
  onUpdateStatus,
  customersData = {}
}: TodaysTimelineProps) {
  // Filter to only show active bookings (confirmed and pending)
  const activeBookings = bookings.filter(booking => 
    ['confirmed', 'pending'].includes(booking.status)
  ).sort((a, b) => 
    new Date(a.booking_time).getTime() - new Date(b.booking_time).getTime()
  )

  // Group bookings by hour
  const bookingsByHour: Record<number, any[]> = {}
  activeBookings.forEach(booking => {
    const hour = new Date(booking.booking_time).getHours()
    if (!bookingsByHour[hour]) bookingsByHour[hour] = []
    bookingsByHour[hour].push(booking)
  })

  // Generate hours from 10 AM to 12 AM (midnight)
  const hours = Array.from({ length: 15 }, (_, i) => (i + 10) % 24)

  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'confirmed':
        return {
          icon: CheckCircle,
          color: 'text-green-600',
          bgColor: 'bg-green-50 border-green-200',
          badge: 'bg-green-100 text-green-800'
        }
      case 'pending':
        return {
          icon: Timer,
          color: 'text-amber-600',
          bgColor: 'bg-amber-50 border-amber-200',
          badge: 'bg-amber-100 text-amber-800'
        }
      default:
        return {
          icon: AlertCircle,
          color: 'text-gray-600',
          bgColor: 'bg-gray-50 border-gray-200',
          badge: 'bg-gray-100 text-gray-800'
        }
    }
  }

  const isCurrentlyDining = (booking: any) => {
    if (booking.status !== 'confirmed') return false
    const bookingStart = new Date(booking.booking_time)
    const bookingEnd = addMinutes(bookingStart, booking.turn_time_minutes || 120)
    return isWithinInterval(currentTime, { start: bookingStart, end: bookingEnd })
  }

  const getTimeUntilBooking = (booking: any) => {
    const bookingTime = new Date(booking.booking_time)
    const minutesUntil = differenceInMinutes(bookingTime, currentTime)
    
    if (minutesUntil < 0) return "Now"
    if (minutesUntil < 60) return `${minutesUntil}m`
    if (minutesUntil < 1440) return `${Math.floor(minutesUntil / 60)}h ${minutesUntil % 60}m`
    return format(bookingTime, 'MMM d')
  }

  // Check if we have any active bookings
  if (activeBookings.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Today's Timeline</CardTitle>
          <CardDescription>
            {format(currentTime, "EEEE, MMMM d")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-16">
            <Calendar className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-xl font-semibold mb-2">No active bookings today</h3>
            <p className="text-muted-foreground">All confirmed and pending reservations will appear here</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  const currentHour = currentTime.getHours()

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-xl">Today's Timeline</CardTitle>
            <CardDescription className="text-base">
              {format(currentTime, "EEEE, MMMM d")} • {activeBookings.length} active reservations
            </CardDescription>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-sm">
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded-full bg-green-500" />
                <span>Confirmed</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded-full bg-amber-500" />
                <span>Pending</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded-full bg-blue-500" />
                <span>Dining Now</span>
              </div>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-6">
        <div className="relative">
          {/* Current time indicator line */}
          <div 
            className="absolute top-0 bottom-0 w-0.5 bg-red-500 z-20 opacity-80" 
            style={{ 
              left: `${Math.max(0, Math.min(100, ((currentTime.getHours() + currentTime.getMinutes() / 60 - 10) / 14) * 100))}%` 
            }}
          >
            <div className="absolute -top-6 left-1/2 transform -translate-x-1/2">
              <div className="bg-red-500 text-white text-xs font-medium px-2 py-1 rounded shadow-lg">
                Now • {format(currentTime, 'h:mm a')}
              </div>
            </div>
            <div className="absolute top-0 left-1/2 transform -translate-x-1/2 w-2 h-2 bg-red-500 rounded-full" />
          </div>

          {/* Hour headers */}
          <div className="flex mb-6 pb-4 border-b">
            {hours.map(hour => {
              const isCurrentHour = hour === currentHour
              return (
                <div 
                  key={hour} 
                  className={cn(
                    "flex-1 text-center text-sm font-medium transition-colors",
                    isCurrentHour ? "text-red-600 font-bold" : "text-muted-foreground"
                  )}
                >
                  {format(startOfDay(currentTime).setHours(hour), hour === 0 ? 'h a' : 'h a')}
                </div>
              )
            })}
          </div>

          {/* Timeline content */}
          <div className="space-y-2">
            {hours.map(hour => {
              const hourBookings = bookingsByHour[hour] || []
              const isCurrentHour = hour === currentHour
              
              return (
                <div key={hour} className="flex min-h-[80px] group">
                  {/* Time label */}
                  <div className={cn(
                    "w-20 flex-shrink-0 text-sm pt-3 pr-4 text-right border-r transition-colors",
                    isCurrentHour ? "text-red-600 font-bold border-red-200" : "text-muted-foreground border-border"
                  )}>
                    {format(startOfDay(currentTime).setHours(hour), 'h:mm a')}
                  </div>
                  
                  {/* Bookings content */}
                  <div className="flex-1 pl-6 relative">
                    {hourBookings.length === 0 ? (
                      <div className="h-full flex items-center">
                        <div className={cn(
                          "text-sm transition-opacity",
                          isCurrentHour ? "text-muted-foreground/60" : "text-muted-foreground/40"
                        )}>
                          No reservations
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {hourBookings.map((booking, index) => {
                          const isDining = isCurrentlyDining(booking)
                          const statusConfig = getStatusConfig(booking.status)
                          const StatusIcon = statusConfig.icon
                          const bookingTime = new Date(booking.booking_time)
                          const timeUntil = getTimeUntilBooking(booking)
                          const guestName = booking.user?.full_name || booking.guest_name || 'Guest'
                          const guestPhone = booking.user?.phone_number || booking.guest_phone
                          const customerData = booking.user?.id ? customersData[booking.user.id] : null
                          
                          return (
                            <div
                              key={booking.id}
                              className={cn(
                                "relative p-4 rounded-xl border-2 cursor-pointer transition-all duration-200 hover:shadow-lg hover:scale-[1.02]",
                                statusConfig.bgColor,
                                isDining && "ring-2 ring-blue-400 shadow-lg scale-[1.01]"
                              )}
                              onClick={() => onSelectBooking(booking)}
                            >
                              {/* Dining indicator */}
                              {isDining && (
                                <div className="absolute -top-2 -right-2 bg-blue-500 text-white text-xs px-2 py-1 rounded-full font-medium shadow-sm">
                                  Dining Now
                                </div>
                              )}

                              <div className="flex items-start justify-between gap-4">
                                {/* Main content */}
                                <div className="flex-1 min-w-0">
                                  {/* Guest name and status */}
                                  <div className="flex items-center gap-3 mb-2">
                                    <StatusIcon className={cn("h-5 w-5", statusConfig.color)} />
                                    <h4 className="text-lg font-semibold text-gray-900 truncate">
                                      {guestName}
                                    </h4>
                                    <Badge className={cn("text-xs font-medium", statusConfig.badge)}>
                                      {booking.status === 'pending' ? 'Awaiting Confirmation' : 'Confirmed'}
                                    </Badge>
                                    {/* Customer Indicators */}
                                    <div className="flex items-center gap-1">
                                      {customerData?.vip_status && (
                                        <Badge variant="default" className="text-xs px-1.5 py-0.5">
                                          ⭐ VIP
                                        </Badge>
                                      )}
                                      {customerData?.blacklisted && (
                                        <Badge variant="destructive" className="text-xs px-1.5 py-0.5">
                                          🚫 Alert
                                        </Badge>
                                      )}
                                    </div>
                                  </div>

                                  {/* Booking details */}
                                  <div className="grid grid-cols-2 gap-4 text-sm">
                                    <div className="space-y-2">
                                      <div className="flex items-center gap-2 text-gray-600">
                                        <Clock className="h-4 w-4" />
                                        <span className="font-medium">
                                          {format(bookingTime, 'h:mm a')}
                                        </span>
                                        {timeUntil !== "Now" && (
                                          <span className="text-muted-foreground">
                                            ({timeUntil})
                                          </span>
                                        )}
                                      </div>
                                      <div className="flex items-center gap-2 text-gray-600">
                                        <Users className="h-4 w-4" />
                                        <span>{booking.party_size} guests</span>
                                      </div>
                                    </div>
                                    
                                    <div className="space-y-2">
                                      {booking.tables && booking.tables.length > 0 ? (
                                        <div className="flex items-center gap-2 text-gray-600">
                                          <Table2 className="h-4 w-4" />
                                          <span>
                                            Tables {booking.tables.map((t: any) => t.table_number).join(", ")}
                                          </span>
                                        </div>
                                      ) : (
                                        <div className="flex items-center gap-2">
                                          <Table2 className="h-4 w-4 text-red-500" />
                                          <Badge variant="destructive" className="text-xs">
                                            No table assigned
                                          </Badge>
                                        </div>
                                      )}
                                      
                                      {guestPhone && (
                                        <div className="flex items-center gap-2 text-gray-600">
                                          <Phone className="h-4 w-4" />
                                          <span className="text-sm">{guestPhone}</span>
                                        </div>
                                      )}
                                    </div>
                                  </div>

                                  {/* Special requests */}
                                  {booking.special_requests && (
                                    <div className="mt-3 p-2 bg-gray-50 rounded-lg">
                                      <div className="flex items-start gap-2">
                                        <MessageSquare className="h-4 w-4 text-gray-500 mt-0.5 flex-shrink-0" />
                                        <p className="text-sm text-gray-700 leading-relaxed">
                                          {booking.special_requests}
                                        </p>
                                      </div>
                                    </div>
                                  )}
                                </div>

                                {/* Action buttons */}
                                <div className="flex flex-col gap-2 flex-shrink-0">
                                  {booking.status === 'pending' && (
                                    <Button
                                      size="sm"
                                      className="h-8 px-3 bg-green-600 hover:bg-green-700"
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        onUpdateStatus(booking.id, 'confirmed')
                                      }}
                                    >
                                      <CheckCircle className="h-3 w-3 mr-1" />
                                      Confirm
                                    </Button>
                                  )}
                                  
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-8 px-3 text-gray-600 hover:text-gray-900"
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      onSelectBooking(booking)
                                    }}
                                  >
                                    <ChevronRight className="h-4 w-4" />
                                  </Button>
                                </div>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}