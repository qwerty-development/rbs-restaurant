// components/dashboard/todays-timeline.tsx
"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Separator } from "@/components/ui/separator"
import {
  Clock,
  Users,
  Table2,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Timer,
  Phone,
  MessageSquare,
  Calendar,
  Filter,
  TrendingUp,
  UserCheck,
  ChefHat,
  CreditCard,
  Star,
  AlertCircle,
  Utensils,
  ArrowRight,
  Eye,
  Coffee,
  Cake
} from "lucide-react"
import { format, differenceInMinutes, isAfter, isBefore, addMinutes } from "date-fns"
import { cn, titleCase } from "@/lib/utils"

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
  const [clientTime, setClientTime] = useState<Date | null>(null)
  const [activeTab, setActiveTab] = useState("overview")
  const [showCompleted, setShowCompleted] = useState(false)

  useEffect(() => {
    setClientTime(currentTime)
    const interval = setInterval(() => {
      setClientTime(new Date())
    }, 30000) // Update every 30 seconds for more real-time feel

    return () => clearInterval(interval)
  }, [currentTime])
  // Group bookings intelligently
  const groupedBookings = {
    needsAttention: bookings.filter(booking => {
      const minutesUntil = differenceInMinutes(new Date(booking.booking_time), clientTime || currentTime)
      return booking.status === 'pending' || 
             (booking.status === 'confirmed' && minutesUntil < 0 && minutesUntil > -30) || // Late arrivals
             booking.status === 'arrived' ||
             (!booking.tables || booking.tables.length === 0) // No table assigned
    }),
    
    currentlyDining: bookings.filter(booking => 
      ['seated', 'ordered', 'appetizers', 'main_course', 'dessert', 'payment'].includes(booking.status)
    ),
    
    arrivingSoon: bookings.filter(booking => {
      const minutesUntil = differenceInMinutes(new Date(booking.booking_time), clientTime || currentTime)
      return booking.status === 'confirmed' && minutesUntil > 0 && minutesUntil <= 60
    }),
    
    laterToday: bookings.filter(booking => {
      const minutesUntil = differenceInMinutes(new Date(booking.booking_time), clientTime || currentTime)
      return booking.status === 'confirmed' && minutesUntil > 60
    }),
    
    completed: bookings.filter(booking => 
      ['completed', 'no_show'].includes(booking.status)
    )
  }

  const getStatusConfig = (booking: any) => {
    const minutesUntil = differenceInMinutes(new Date(booking.booking_time), clientTime || currentTime)
    const customerData = booking.user?.id ? customersData[booking.user.id] : null
    
    switch (booking.status) {
      case 'pending':
        return {
          icon: Timer,
          iconColor: 'text-amber-600',
          bgColor: 'bg-amber-50 border-amber-200 hover:bg-amber-100',
          badge: 'bg-amber-100 text-amber-800',
          badgeText: 'Needs Confirmation',
          urgent: true
        }
      case 'confirmed':
        if (minutesUntil < 0) {
          return {
            icon: AlertTriangle,
            iconColor: 'text-red-600',
            bgColor: 'bg-red-50 border-red-200 hover:bg-red-100',
            badge: 'bg-red-100 text-red-800',
            badgeText: `${Math.abs(minutesUntil)}m Late`,
            urgent: true
          }
        }
        return {
          icon: CheckCircle,
          iconColor: 'text-green-600',
          bgColor: 'bg-green-50 border-green-200 hover:bg-green-100',
          badge: 'bg-green-100 text-green-800',
          badgeText: 'Confirmed',
          urgent: false
        }
      case 'arrived':
        return {
          icon: UserCheck,
          iconColor: 'text-blue-600',
          bgColor: 'bg-blue-50 border-blue-200 hover:bg-blue-100',
          badge: 'bg-blue-100 text-blue-800',
          badgeText: 'Arrived - Needs Seating',
          urgent: true
        }
      case 'seated':
        return {
          icon: Utensils,
          iconColor: 'text-purple-600',
          bgColor: 'bg-purple-50 border-purple-200 hover:bg-purple-100',
          badge: 'bg-purple-100 text-purple-800',
          badgeText: 'Just Seated',
          urgent: false
        }
      case 'ordered':
        return {
          icon: ChefHat,
          iconColor: 'text-indigo-600',
          bgColor: 'bg-indigo-50 border-indigo-200 hover:bg-indigo-100',
          badge: 'bg-indigo-100 text-indigo-800',
          badgeText: 'Order Placed',
          urgent: false
        }
      case 'appetizers':
        return {
          icon: Coffee,
          iconColor: 'text-orange-600',
          bgColor: 'bg-orange-50 border-orange-200 hover:bg-orange-100',
          badge: 'bg-orange-100 text-orange-800',
          badgeText: 'Appetizers Served',
          urgent: false
        }
      case 'main_course':
        return {
          icon: Utensils,
          iconColor: 'text-emerald-600',
          bgColor: 'bg-emerald-50 border-emerald-200 hover:bg-emerald-100',
          badge: 'bg-emerald-100 text-emerald-800',
          badgeText: 'Main Course',
          urgent: false
        }
      case 'dessert':
        return {
          icon: Cake,
          iconColor: 'text-pink-600',
          bgColor: 'bg-pink-50 border-pink-200 hover:bg-pink-100',
          badge: 'bg-pink-100 text-pink-800',
          badgeText: 'Dessert',
          urgent: false
        }
      case 'payment':
        return {
          icon: CreditCard,
          iconColor: 'text-teal-600',
          bgColor: 'bg-teal-50 border-teal-200 hover:bg-teal-100',
          badge: 'bg-teal-100 text-teal-800',
          badgeText: 'Payment',
          urgent: false
        }
      case 'completed':
        return {
          icon: CheckCircle,
          iconColor: 'text-gray-500',
          bgColor: 'bg-gray-50 border-gray-200 hover:bg-gray-100',
          badge: 'bg-gray-100 text-gray-700',
          badgeText: 'Completed',
          urgent: false
        }
      case 'no_show':
        return {
          icon: XCircle,
          iconColor: 'text-red-600',
          bgColor: 'bg-red-50 border-red-200 hover:bg-red-100',
          badge: 'bg-red-100 text-red-800',
          badgeText: 'No Show',
          urgent: false
        }
      default:
        return {
          icon: AlertCircle,
          iconColor: 'text-gray-600',
          bgColor: 'bg-gray-50 border-gray-200 hover:bg-gray-100',
          badge: 'bg-gray-100 text-gray-800',
          badgeText: titleCase(booking.status),
          urgent: false
        }
    }
  }

  const renderBookingCard = (booking: any, showTime = true) => {
    const statusConfig = getStatusConfig(booking)
    const StatusIcon = statusConfig.icon
    const bookingTime = new Date(booking.booking_time)
    const minutesUntil = differenceInMinutes(bookingTime, clientTime || currentTime)
    const guestName = booking.user?.full_name || booking.guest_name || 'Guest'
    const guestPhone = booking.user?.phone_number || booking.guest_phone
    const customerData = booking.user?.id ? customersData[booking.user.id] : null
    
    const getTimeDisplay = () => {
      if (minutesUntil < -60) return `${Math.abs(Math.floor(minutesUntil / 60))}h ${Math.abs(minutesUntil % 60)}m ago`
      if (minutesUntil < 0) return `${Math.abs(minutesUntil)}m ago`
      if (minutesUntil < 60) return `in ${minutesUntil}m`
      if (minutesUntil < 1440) return `in ${Math.floor(minutesUntil / 60)}h ${minutesUntil % 60}m`
      return format(bookingTime, 'h:mm a')
    }

    return (
      <Card 
        key={booking.id}
        className={cn(
          "cursor-pointer transition-all duration-200 hover:shadow-md",
          statusConfig.bgColor,
          statusConfig.urgent && "ring-2 ring-orange-200"
        )}
        onClick={() => onSelectBooking(booking)}
      >
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3 flex-1 min-w-0">
              <div className={cn("p-2 rounded-full bg-white shadow-sm", statusConfig.iconColor)}>
                <StatusIcon className="h-4 w-4" />
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-2">
                  <h3 className="text-lg font-semibold text-gray-900 truncate">
                    {guestName}
                  </h3>
                  <Badge className={cn("text-xs font-medium", statusConfig.badge)}>
                    {statusConfig.badgeText}
                  </Badge>
                  {customerData?.vip_status && (
                    <Badge variant="secondary" className="text-xs bg-yellow-100 text-yellow-800">
                      <Star className="h-3 w-3 mr-1" />
                      VIP
                    </Badge>
                  )}
                  {customerData?.blacklisted && (
                    <Badge variant="destructive" className="text-xs">
                      Alert
                    </Badge>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3 text-sm text-gray-600">
                  <div className="space-y-1">
                    {showTime && (
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4" />
                        <span className="font-medium">
                          {format(bookingTime, 'h:mm a')}
                        </span>
                        <span className="text-muted-foreground">
                          ({getTimeDisplay()})
                        </span>
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4" />
                      <span>{booking.party_size} guests</span>
                    </div>
                  </div>
                  
                  <div className="space-y-1">
                    {booking.tables && booking.tables.length > 0 ? (
                      <div className="flex items-center gap-2">
                        <Table2 className="h-4 w-4" />
                        <span>Table {booking.tables.map((t: any) => t.table_number).join(", ")}</span>
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
                      <div className="flex items-center gap-2">
                        <Phone className="h-4 w-4" />
                        <span className="text-sm">{guestPhone}</span>
                      </div>
                    )}
                  </div>
                </div>

                {booking.special_requests && (
                  <div className="mt-3 p-2 bg-white/50 rounded-lg">
                    <div className="flex items-start gap-2">
                      <MessageSquare className="h-4 w-4 text-gray-500 mt-0.5 flex-shrink-0" />
                      <p className="text-sm text-gray-700 leading-relaxed line-clamp-2">
                        {booking.special_requests}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="flex flex-col gap-2 flex-shrink-0 min-w-[80px]">
              {booking.status === 'pending' && (
                <Button
                  size="sm"
                  className="h-8 px-2 bg-green-600 hover:bg-green-700 text-xs whitespace-nowrap"
                  onClick={(e) => {
                    e.stopPropagation()
                    onUpdateStatus(booking.id, 'confirmed')
                  }}
                >
                  <CheckCircle className="h-3 w-3 mr-1 flex-shrink-0" />
                  Confirm
                </Button>
              )}
              
              {booking.status === 'arrived' && (
                <Button
                  size="sm"
                  className="h-8 px-2 bg-blue-600 hover:bg-blue-700 text-xs whitespace-nowrap"
                  onClick={(e) => {
                    e.stopPropagation()
                    onSelectBooking(booking)
                  }}
                >
                  <Utensils className="h-3 w-3 mr-1 flex-shrink-0" />
                  Seat
                </Button>
              )}
              
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0 flex items-center justify-center"
                onClick={(e) => {
                  e.stopPropagation()
                  onSelectBooking(booking)
                }}
              >
                <Eye className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  const renderTimelineSection = (title: string, bookings: any[], icon: any, showTime = true, emptyMessage = "No bookings") => {
    const Icon = icon
    
    if (bookings.length === 0) {
      return (
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-full bg-muted">
              <Icon className="h-4 w-4 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
            <Badge variant="secondary" className="text-xs">
              {bookings.length}
            </Badge>
          </div>
          <div className="text-center py-8 text-muted-foreground">
            <Icon className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>{emptyMessage}</p>
          </div>
        </div>
      )
    }

    return (
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-full bg-muted">
            <Icon className="h-4 w-4 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
          <Badge variant="secondary" className="text-xs">
            {bookings.length}
          </Badge>
        </div>
        <div className="space-y-3">
          {bookings
            .sort((a, b) => new Date(a.booking_time).getTime() - new Date(b.booking_time).getTime())
            .map(booking => renderBookingCard(booking, showTime))}
        </div>
      </div>
    )
  }

  // Calculate stats
  const stats = {
    total: bookings.filter(b => !['cancelled_by_user', 'declined_by_restaurant'].includes(b.status)).length,
    needsAttention: groupedBookings.needsAttention.length,
    currentlyDining: groupedBookings.currentlyDining.length,
    completed: groupedBookings.completed.length
  }

  if (stats.total === 0) {
    return (
      <Card className="w-full max-w-4xl mx-auto">
        <CardHeader>
          <CardTitle className="flex items-center gap-3">
            <Calendar className="h-6 w-6" />
            Today's Timeline
          </CardTitle>
          <CardDescription>
            <span suppressHydrationWarning>
              {clientTime ? format(clientTime, "EEEE, MMMM d, yyyy") : "Loading..."}
            </span>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-16">
            <Calendar className="h-16 w-16 text-muted-foreground mx-auto mb-4 opacity-50" />
            <h3 className="text-xl font-semibold mb-2">No reservations today</h3>
            <p className="text-muted-foreground">All confirmed and pending reservations will appear here</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="w-full max-w-6xl mx-auto">
      <CardHeader className="pb-6">
        <div className="flex items-start justify-between w-full">
          <div className="flex items-center gap-3">
            <TrendingUp className="h-6 w-6" />
            <div>
              <CardTitle className="flex items-center gap-2 text-2xl">Today's Timeline</CardTitle>
              <CardDescription className="mt-0 text-sm">
                <span suppressHydrationWarning>
                  {clientTime ? format(clientTime, "EEEE, MMMM d, yyyy • h:mm a") : "Loading..."}
                </span>
              </CardDescription>
            </div>
          </div>
        </div>

        {/* Stats row moved below the title and date/time */}
        <div className="w-full mt-4">
          <div className="grid grid-cols-4 gap-4 text-sm">
            <div className="text-center">
              <div className="text-2xl font-bold text-amber-600">{stats.needsAttention}</div>
              <div className="text-muted-foreground">Attention</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">{stats.currentlyDining}</div>
              <div className="text-muted-foreground">Currently Dining</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{stats.completed}</div>
              <div className="text-muted-foreground">Completed</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{stats.total}</div>
              <div className="text-muted-foreground">Total Today</div>
            </div>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="h-auto p-1 bg-muted rounded-lg">
            <div className="flex flex-wrap gap-1 w-full">
              <TabsTrigger value="overview" className="flex-1 min-w-0 text-xs sm:text-sm truncate whitespace-nowrap">
                Overview
              </TabsTrigger>
              <TabsTrigger value="attention" className="flex-1 min-w-0 text-xs sm:text-sm truncate whitespace-nowrap">
               
              Critical
                <span className="ml-1 px-1.5 py-0.5 bg-amber-100 text-amber-800 rounded text-xs">
                  {stats.needsAttention}
                </span>
              </TabsTrigger>
              <TabsTrigger value="dining" className="flex-1 min-w-0 text-xs sm:text-sm truncate whitespace-nowrap">
                Dining
                <span className="ml-1 px-1.5 py-0.5 bg-purple-100 text-purple-800 rounded text-xs">
                  {stats.currentlyDining}
                </span>
              </TabsTrigger>
              <TabsTrigger value="schedule" className="flex-1 min-w-0 text-xs sm:text-sm truncate whitespace-nowrap">
                Schedule
              </TabsTrigger>
            </div>
          </TabsList>
        </Tabs>
      </CardHeader>

      <CardContent className="px-6 pb-6">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsContent value="overview" className="mt-0">
            <ScrollArea className="h-[600px]">
              <div className="space-y-8">
                {stats.needsAttention > 0 && (
                  <>
                    {renderTimelineSection(
                      "Needs Immediate Attention", 
                      groupedBookings.needsAttention, 
                      AlertTriangle,
                      true,
                      "All bookings are handled"
                    )}
                    <Separator />
                  </>
                )}

                {stats.currentlyDining > 0 && (
                  <>
                    {renderTimelineSection(
                      "Currently Dining", 
                      groupedBookings.currentlyDining, 
                      Utensils,
                      false,
                      "No guests are currently dining"
                    )}
                    <Separator />
                  </>
                )}

                {groupedBookings.arrivingSoon.length > 0 && (
                  <>
                    {renderTimelineSection(
                      "Arriving Soon (Next Hour)", 
                      groupedBookings.arrivingSoon, 
                      Clock,
                      true,
                      "No arrivals in the next hour"
                    )}
                    <Separator />
                  </>
                )}

                {groupedBookings.laterToday.length > 0 && (
                  renderTimelineSection(
                    "Later Today", 
                    groupedBookings.laterToday, 
                    Calendar,
                    true,
                    "No more bookings today"
                  )
                )}

                {stats.completed > 0 && (
                  <>
                    <Separator />
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-full bg-muted">
                            <CheckCircle className="h-4 w-4 text-muted-foreground" />
                          </div>
                          <h3 className="text-lg font-semibold text-gray-900">Completed Today</h3>
                          <Badge variant="secondary" className="text-xs">
                            {stats.completed}
                          </Badge>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setShowCompleted(!showCompleted)}
                        >
                          {showCompleted ? "Hide" : "Show"} Completed
                        </Button>
                      </div>
                      
                      {showCompleted && (
                        <div className="space-y-3">
                          {groupedBookings.completed
                            .sort((a, b) => new Date(b.booking_time).getTime() - new Date(a.booking_time).getTime())
                            .map(booking => renderBookingCard(booking, true))}
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="attention" className="mt-0">
            <ScrollArea className="h-[600px]">
              <div className="space-y-4">
                {groupedBookings.needsAttention.map(booking => renderBookingCard(booking, true))}
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="dining" className="mt-0">
            <ScrollArea className="h-[600px]">
              <div className="space-y-4">
                {groupedBookings.currentlyDining.map(booking => renderBookingCard(booking, false))}
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="schedule" className="mt-0">
            <ScrollArea className="h-[600px]">
              <div className="space-y-6">
                {[...groupedBookings.arrivingSoon, ...groupedBookings.laterToday]
                  .sort((a, b) => new Date(a.booking_time).getTime() - new Date(b.booking_time).getTime())
                  .map(booking => renderBookingCard(booking, true))}
              </div>
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}