// components/bookings/booking-list.tsx
"use client"

import { format, differenceInMinutes } from "date-fns"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "../ui/skeleton"
import { Progress } from "@/components/ui/progress"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from "@/components/ui/dropdown-menu"
import { 
  Clock, 
  Users, 
  Phone, 
  MoreVertical,
  CheckCircle,
  XCircle,
  AlertCircle,
  Table2,
  UserCheck,
  ChefHat,
  Utensils,
  CreditCard,
  Timer,
  Activity,
  ArrowRight,
  Coffee,
  Cake,
  Star,
  StickyNote,
  Ban,
  AlertTriangle
} from "lucide-react"
import { cn } from "@/lib/utils"
import { TableStatusService, type DiningStatus } from "@/lib/table-status"
import type { Booking } from "@/types"
import { Alert, AlertDescription } from "../ui/alert"
import { useBookingCustomers } from "@/lib/hooks/use-booking-customers"

interface BookingListProps {
  bookings: Booking[]
  isLoading: boolean
  onSelectBooking: (booking: Booking) => void
  onUpdateStatus: (bookingId: string, status: string) => void
  compact?: boolean
  restaurantId?: string
}

// Status configuration mapping
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
    icon: UserCheck, 
    color: 'text-indigo-600', 
    bgColor: 'bg-indigo-100',
    label: 'Arrived'
  },
  'seated': { 
    icon: ChefHat, 
    color: 'text-purple-600', 
    bgColor: 'bg-purple-100',
    label: 'Seated'
  },
  'ordered': { 
    icon: Coffee, 
    color: 'text-orange-600', 
    bgColor: 'bg-orange-100',
    label: 'Ordered'
  },
  'appetizers': { 
    icon: Utensils, 
    color: 'text-green-600', 
    bgColor: 'bg-green-100',
    label: 'Appetizers'
  },
  'main_course': { 
    icon: Utensils, 
    color: 'text-green-700', 
    bgColor: 'bg-green-200',
    label: 'Main Course'
  },
  'dessert': { 
    icon: Cake, 
    color: 'text-pink-600', 
    bgColor: 'bg-pink-100',
    label: 'Dessert'
  },
  'payment': { 
    icon: CreditCard, 
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

export function BookingList({
  bookings,
  isLoading,
  onSelectBooking,
  onUpdateStatus,
  compact = false,
  restaurantId
}: BookingListProps) {
  const tableStatusService = new TableStatusService()
  
  // Load customer data for all bookings
  const { customerData, loading: customerLoading } = useBookingCustomers(
    bookings, 
    restaurantId || ''
  )

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

  const formatGuestName = (booking: Booking) => {
    return booking.user?.full_name || booking.guest_name || 'Guest'
  }

  const formatGuestPhone = (booking: Booking) => {
    return booking.user?.phone_number || booking.guest_phone || 'No phone'
  }

  const isDiningStatus = (status: string) => {
    return ['seated', 'ordered', 'appetizers', 'main_course', 'dessert', 'payment'].includes(status)
  }

  const getValidTransitions = (currentStatus: string): Array<{ status: string; label: string }> => {
    const transitions = tableStatusService.getValidTransitions(currentStatus as DiningStatus)
    return transitions.map(t => ({
      status: t.to,
      label: t.label
    }))
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
      {bookings.map((booking: any) => {
        const bookingTime = new Date(booking.booking_time)
        const now = new Date()
        const hasAssignedTables = booking.tables && booking.tables.length > 0
        const statusConfig = STATUS_CONFIG[booking.status] || STATUS_CONFIG['pending']
        const StatusIcon = statusConfig.icon
        const isDining = isDiningStatus(booking.status)
        const diningProgress = isDining ? TableStatusService.getDiningProgress(booking.status as DiningStatus) : 0
        const elapsedMinutes = differenceInMinutes(now, bookingTime)
        const isLate = booking.status === 'confirmed' && elapsedMinutes > 15
        const validTransitions = getValidTransitions(booking.status)

        return (
          <Card
            key={booking.id}
            className={cn(
              "cursor-pointer hover:shadow-md transition-all",
              isDining && "border-l-4 border-l-purple-500",
              isLate && "border-l-4 border-l-red-500"
            )}
            onClick={() => onSelectBooking(booking)}
          >
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="space-y-1 flex-1">
                  <div className="flex items-center gap-3">
                    <StatusIcon className={cn("h-5 w-5", statusConfig.color)} />
                    <h3 className="font-semibold text-lg">
                      {formatGuestName(booking)}
                    </h3>
                    
                    {/* Customer Indicators */}
                    {customerData[booking.id] && (
                      <div className="flex items-center gap-1">
                        {customerData[booking.id].isVip && (
                          <Badge variant="default" className="text-xs bg-gold text-gold-foreground">
                            <Star className="h-3 w-3 mr-1" />
                            VIP
                          </Badge>
                        )}
                        {customerData[booking.id].isBlacklisted && (
                          <Badge variant="destructive" className="text-xs">
                            <Ban className="h-3 w-3 mr-1" />
                            Blacklisted
                          </Badge>
                        )}
                        {customerData[booking.id].hasImportantNotes && (
                          <Badge variant="secondary" className="text-xs">
                            <StickyNote className="h-3 w-3 mr-1" />
                            Notes
                          </Badge>
                        )}
                        {customerData[booking.id].hasDietaryRestrictions && (
                          <Badge variant="outline" className="text-xs border-orange-300 text-orange-700">
                            <AlertTriangle className="h-3 w-3 mr-1" />
                            Dietary
                          </Badge>
                        )}
                        {customerData[booking.id].tagCount > 0 && (
                          <Badge variant="outline" className="text-xs">
                            {customerData[booking.id].tagCount} tag{customerData[booking.id].tagCount !== 1 ? 's' : ''}
                          </Badge>
                        )}
                      </div>
                    )}
                    
                    <Badge 
                      variant={getStatusBadgeVariant(booking.status)}
                      className={cn(statusConfig.bgColor, statusConfig.color)}
                    >
                      {statusConfig.label}
                    </Badge>
                    {isLate && (
                      <Badge variant="destructive" className="text-xs">
                        Late ({elapsedMinutes}m)
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span className="font-mono">#{booking.confirmation_code}</span>
                    {booking.occasion && (
                      <Badge variant="secondary" className="text-xs">
                        🎉 {booking.occasion}
                      </Badge>
                    )}
                  </div>
                </div>
                
                <DropdownMenu>
                  <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                    <Button variant="ghost" size="icon">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuLabel>Quick Actions</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    
                    {/* Status-specific actions */}
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
                            onUpdateStatus(booking.id, 'arrived')
                          }}
                        >
                          <UserCheck className="mr-2 h-4 w-4" />
                          Check In Guest
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
                    
                    {/* Dining progress transitions */}
                    {validTransitions.length > 0 && (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuSub>
                          <DropdownMenuSubTrigger>
                            <Activity className="mr-2 h-4 w-4" />
                            Update Status
                          </DropdownMenuSubTrigger>
                          <DropdownMenuSubContent>
                            {validTransitions.map(transition => {
                              const transitionConfig = STATUS_CONFIG[transition.status]
                              const TransitionIcon = transitionConfig?.icon || ArrowRight
                              
                              return (
                                <DropdownMenuItem
                                  key={transition.status}
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    onUpdateStatus(booking.id, transition.status)
                                  }}
                                >
                                  <TransitionIcon className={cn("mr-2 h-4 w-4", transitionConfig?.color)} />
                                  {transition.label}
                                </DropdownMenuItem>
                              )
                            })}
                          </DropdownMenuSubContent>
                        </DropdownMenuSub>
                      </>
                    )}
                    
                    {/* Complete/Cancel options for dining statuses */}
                    {isDining && (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.stopPropagation()
                            onUpdateStatus(booking.id, 'completed')
                          }}
                        >
                          <CheckCircle className="mr-2 h-4 w-4" />
                          Complete Service
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.stopPropagation()
                            onUpdateStatus(booking.id, 'cancelled_by_restaurant')
                          }}
                          className="text-destructive"
                        >
                          <XCircle className="mr-2 h-4 w-4" />
                          Cancel Booking
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
                  <div>
                    <span>{format(bookingTime, compact ? 'h:mm a' : 'MMM d, h:mm a')}</span>
                    {isDining && (
                      <p className="text-xs text-muted-foreground">
                        {elapsedMinutes}m elapsed
                      </p>
                    )}
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <span>{booking.party_size} guests</span>
                </div>
                
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <span className="truncate">{formatGuestPhone(booking)}</span>
                </div>

                <div className="flex items-center gap-2">
                  <Table2 className="h-4 w-4 text-muted-foreground" />
                  <span>
                    {hasAssignedTables ? (
                      <span className="font-medium">
                        Table {booking.tables.map((t: { table_number: any }) => t.table_number).join(", ")}
                      </span>
                    ) : (
                      <Badge variant="destructive" className="text-xs">
                        No table
                      </Badge>
                    )}
                  </span>
                </div>
              </div>

              {/* Dining progress bar */}
              {isDining && (
                <div className="mt-3 space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Service Progress</span>
                    <span className="font-medium">{diningProgress}%</span>
                  </div>
                  <Progress value={diningProgress} className="h-2" />
                </div>
              )}

              {/* Special requests */}
              {booking.special_requests && (
                <div className="mt-3 p-2 bg-muted rounded text-sm">
                  <p className="font-medium mb-1">Special requests:</p>
                  <p className="text-muted-foreground">{booking.special_requests}</p>
                </div>
              )}

              {/* Alerts and warnings */}
              <div className="mt-3 space-y-2">
                {!hasAssignedTables && ['confirmed', 'arrived'].includes(booking.status) && (
                  <Alert className="py-2">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription className="text-sm">
                      Table assignment required
                    </AlertDescription>
                  </Alert>
                )}
                
                {booking.status === 'payment' && (
                  <Alert className="py-2 border-yellow-200 bg-yellow-50">
                    <CreditCard className="h-4 w-4 text-yellow-600" />
                    <AlertDescription className="text-sm text-yellow-800">
                      Guest is ready to pay
                    </AlertDescription>
                  </Alert>
                )}
                
                {booking.status === 'arrived' && hasAssignedTables && (
                  <Alert className="py-2 border-blue-200 bg-blue-50">
                    <UserCheck className="h-4 w-4 text-blue-600" />
                    <AlertDescription className="text-sm text-blue-800">
                      Guest has arrived - ready to be seated at Table {booking.tables[0].table_number}
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}