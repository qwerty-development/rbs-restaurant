// components/bookings/booking-list.tsx
"use client"

import { useState, useEffect, useMemo } from "react"
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
import { BookingRequestService } from "@/lib/booking-request-service"
import { TableAvailabilityService } from "@/lib/table-availability"
import type { Booking } from "@/types"
import { Alert, AlertDescription } from "../ui/alert"
import { useBookingCustomers } from "@/lib/hooks/use-booking-customers"
import { toast } from "react-hot-toast"

interface BookingListProps {
  bookings: Booking[]
  isLoading: boolean
  onSelectBooking: (booking: Booking) => void
  onUpdateStatus: (bookingId: string, status: string) => void
  compact?: boolean
  restaurantId?: string
  onAssignTable?: (bookingId: string) => void
  onSwitchTable?: (bookingId: string, fromTableId: string, toTableId: string) => void
  onRemoveTable?: (bookingId: string, tableId?: string) => void
}

// Fixed status configuration with all statuses
const STATUS_CONFIG: Record<string, { icon: any; color: string; bgColor: string; label: string }> = {
  'pending': {
    icon: Timer,
    color: 'text-secondary-foreground',
    bgColor: 'bg-secondary/50',
    label: 'Pending'
  },
  'confirmed': {
    icon: CheckCircle,
    color: 'text-primary',
    bgColor: 'bg-primary/20',
    label: 'Confirmed'
  },
  'arrived': {
    icon: UserCheck,
    color: 'text-accent-foreground',
    bgColor: 'bg-accent/30',
    label: 'Arrived'
  },
  'seated': {
    icon: ChefHat,
    color: 'text-primary',
    bgColor: 'bg-primary/30',
    label: 'Seated'
  },
  'ordered': {
    icon: Coffee,
    color: 'text-secondary-foreground',
    bgColor: 'bg-secondary/70',
    label: 'Ordered'
  },
  'appetizers': {
    icon: Utensils,
    color: 'text-accent-foreground',
    bgColor: 'bg-accent/50',
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
  },
  'auto_declined': { 
    icon: Timer, 
    color: 'text-gray-600', 
    bgColor: 'bg-gray-100',
    label: 'Expired'
  },
  'acceptance_failed': { 
    icon: AlertTriangle, 
    color: 'text-orange-600', 
    bgColor: 'bg-orange-100',
    label: 'Acceptance Failed'
  }
}

// Fixed RequestExpiryTimer with singleton service
const RequestExpiryTimer = ({ booking, requestService }: { 
  booking: any
  requestService: BookingRequestService 
}) => {
  const [timeLeft, setTimeLeft] = useState<{ 
    hours: number
    minutes: number
    expired: boolean
    percentage: number
  } | null>(null)
  
  useEffect(() => {
    if (booking.status !== 'pending' || !booking.request_expires_at) return

    const updateTimer = async () => {
      const info = await requestService.getTimeUntilExpiry(booking)
      setTimeLeft(info)
    }

    updateTimer()
    const interval = setInterval(updateTimer, 30000) // Update every 30 seconds

    return () => clearInterval(interval)
  }, [booking, requestService])

  if (!timeLeft || booking.status !== 'pending') return null

  return (
    <div className="space-y-2">
      <div className={cn(
        "flex items-center gap-2 text-sm tablet:text-base font-medium",
        timeLeft.expired ? "text-destructive" :
        timeLeft.hours < 2 ? "text-secondary-foreground" :
        "text-muted-foreground"
      )}>
        <Timer className="h-4 w-4 tablet:h-5 tablet:w-5" />
        <span suppressHydrationWarning>
          {timeLeft.expired ? (
            <span className="font-bold">EXPIRED</span>
          ) : (
            <span>Expires in {timeLeft.hours}h {timeLeft.minutes}m</span>
          )}
        </span>
      </div>
      <Progress 
        value={timeLeft.percentage} 
        className="h-2 tablet:h-3" 
        indicatorClassName={cn(
          timeLeft.percentage < 20 ? "bg-destructive" :
          timeLeft.percentage < 50 ? "bg-secondary" :
          "bg-accent"
        )}
      />
    </div>
  )
}

export function BookingList({
  bookings,
  isLoading,
  onSelectBooking,
  onUpdateStatus,
  compact = false,
  restaurantId,
  onAssignTable,
  onSwitchTable,
  onRemoveTable
}: BookingListProps) {
  // Initialize services as singletons
  const tableStatusService = useMemo(() => new TableStatusService(), [])
  const requestService = useMemo(() => new BookingRequestService(), [])
  const tableService = useMemo(() => new TableAvailabilityService(), [])
  
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
    if (['cancelled_by_user', 'cancelled_by_restaurant', 'declined_by_restaurant', 'no_show', 'auto_declined'].includes(status)) {
      return 'destructive'
    }
    return 'secondary'
  }

  const formatGuestName = (booking: Booking) => {
    return booking.guest_name || booking.user?.full_name || 'Guest'
  }

  const formatGuestPhone = (booking: Booking) => {
    return booking.guest_phone || booking.user?.phone_number || 'No phone'
  }

  const isDiningStatus = (status: string) => {
    return ['seated', 'ordered', 'appetizers', 'main_course', 'dessert', 'payment'].includes(status)
  }

  const getValidTransitions = (currentStatus: string): Array<{ status: string; label: string }> => {
    // Get both sequential transitions and all available statuses for flexibility
    const sequentialTransitions = tableStatusService.getValidTransitions(currentStatus as DiningStatus)
    const allStatuses = tableStatusService.getAllAvailableStatuses(currentStatus as DiningStatus)
    
    // Combine and deduplicate
    const allTransitions = [...sequentialTransitions, ...allStatuses]
    const uniqueTransitions = allTransitions.filter((transition, index, self) => 
      index === self.findIndex(t => t.to === transition.to)
    )
    
    return uniqueTransitions.map(t => ({
      status: t.to,
      label: t.label
    }))
  }

  const handlePendingAction = async (bookingId: string, action: 'confirm' | 'decline') => {
    if (action === 'confirm') {
      // Quick validation before accepting
      const booking = bookings.find(b => b.id === bookingId)
      if (!booking) return

      const hasAvailableTables = await tableService.getAvailableTablesForSlot(
        booking.restaurant_id,
        new Date(booking.booking_time),
        booking.party_size,
        booking.turn_time_minutes || 120
      )
      
      if (!hasAvailableTables.singleTables.length && !hasAvailableTables.combinations.length) {
        toast.error("No tables available for this time slot. Please review in booking details.")
        return
      }
    }
    
    onUpdateStatus(bookingId, action === 'confirm' ? 'confirmed' : 'declined_by_restaurant')
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
        <CardContent className="py-12 tablet:py-16 text-center">
          <p className="text-muted-foreground text-base tablet:text-lg">No bookings found</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4 tablet:space-y-6">
      {bookings.map((booking: any) => {
        const bookingTime = new Date(booking.booking_time)
        const now = new Date()
        const hasAssignedTables = booking.tables && booking.tables.length > 0
        const statusConfig = STATUS_CONFIG[booking.status] || STATUS_CONFIG['pending']
        const StatusIcon = statusConfig.icon
        const isDining = isDiningStatus(booking.status)
        const diningProgress = isDining ? TableStatusService.getDiningProgress(booking.status as DiningStatus) : 0
        
        // Use checked_in_at for elapsed time if guest has checked in, otherwise use booking_time
        const timeReference = booking.checked_in_at ? new Date(booking.checked_in_at) : bookingTime
        const elapsedMinutes = differenceInMinutes(now, timeReference)
        const isLate = booking.status === 'confirmed' && elapsedMinutes > 15
        const validTransitions = getValidTransitions(booking.status)

        return (
          <Card
            key={booking.id}
            className={cn(
              "cursor-pointer hover:shadow-lg transition-all min-h-touch-lg",
              "tablet:hover:scale-[1.01] tablet:active:scale-[0.99]",
              isDining && "border-l-4 tablet:border-l-6 border-l-purple-500",
              isLate && "border-l-4 tablet:border-l-6 border-l-red-500",
              booking.status === 'pending' && booking.request_expires_at && "border-l-4 tablet:border-l-6 border-l-yellow-500"
            )}
            onClick={() => onSelectBooking(booking)}
          >
            <CardHeader className="pb-4 tablet:pb-6">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-2 flex-1">
                  <div className="flex items-center gap-3 tablet:gap-4">
                    <StatusIcon className={cn("h-5 w-5 tablet:h-6 tablet:w-6", statusConfig.color)} />
                    <h3 className="font-semibold text-lg tablet:text-xl">
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
                      </div>
                    )}
                    
                    <Badge 
                      variant={getStatusBadgeVariant(booking.status)}
                      className={cn(statusConfig.bgColor, statusConfig.color, "px-3 py-1 text-sm tablet:text-base font-medium")}
                    >
                      {statusConfig.label}
                    </Badge>
                    {isLate && (
                      <Badge variant="destructive" className="px-3 py-1 text-sm tablet:text-base font-medium">
                        <span suppressHydrationWarning>Late ({elapsedMinutes}m)</span>
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-4 text-sm tablet:text-base text-muted-foreground">
                    <span className="font-mono font-medium">#{booking.confirmation_code}</span>
                    {booking.occasion && (
                      <Badge variant="secondary" className="px-3 py-1 text-sm">
                        🎉 {booking.occasion}
                      </Badge>
                    )}
                  </div>
                </div>
                
                <DropdownMenu>
                  <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                    <Button variant="ghost" size="default" className="min-h-touch min-w-touch">
                      <MoreVertical className="h-5 w-5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuLabel>Quick Actions</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    
                    {/* Table assignment actions */}
                    {onAssignTable && ['confirmed', 'pending', 'arrived', 'seated'].includes(booking.status) && (
                      <>
                        {hasAssignedTables ? (
                          <>
                            <DropdownMenuItem
                              onClick={(e) => {
                                e.stopPropagation()
                                onAssignTable(booking.id)
                              }}
                            >
                              <Table2 className="mr-2 h-4 w-4" />
                              Change Tables
                            </DropdownMenuItem>
                            {onRemoveTable && (
                              <DropdownMenuItem
                                onClick={(e) => {
                                  e.stopPropagation()
                                  if (confirm("Remove all table assignments for this booking?")) {
                                    onRemoveTable(booking.id)
                                  }
                                }}
                                className="text-red-600"
                              >
                                <XCircle className="mr-2 h-4 w-4" />
                                Remove Tables
                              </DropdownMenuItem>
                            )}
                          </>
                        ) : (
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation()
                              onAssignTable(booking.id)
                            }}
                            className="text-green-600"
                          >
                            <Table2 className="mr-2 h-4 w-4" />
                            Assign Tables
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuSeparator />
                      </>
                    )}
                    
                    {/* Status-specific actions */}
                    {booking.status === 'pending' && (
                      <>
                        <DropdownMenuItem
                          onClick={async (e) => {
                            e.stopPropagation()
                            await handlePendingAction(booking.id, 'confirm')
                          }}
                          className="text-green-600"
                        >
                          <CheckCircle className="mr-2 h-4 w-4" />
                          Accept Request
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.stopPropagation()
                            if (confirm("Are you sure you want to decline this request?")) {
                              handlePendingAction(booking.id, 'decline')
                            }
                          }}
                          className="text-red-600"
                        >
                          <XCircle className="mr-2 h-4 w-4" />
                          Decline Request
                        </DropdownMenuItem>
                        {booking.acceptance_attempted_at && (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={(e) => {
                                e.stopPropagation()
                                // Force accept with override
                                onUpdateStatus(booking.id, 'confirmed')
                              }}
                              className="text-orange-600"
                            >
                              <AlertTriangle className="mr-2 h-4 w-4" />
                              Force Accept (Override)
                            </DropdownMenuItem>
                          </>
                        )}
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
                    
                    {/* Complete/Cancel options for active bookings */}
                    {(isDining || booking.status === 'arrived') && (
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
            
            <CardContent className="pt-0">
              <div className="grid grid-cols-1 tablet:grid-cols-2 lg:grid-cols-4 gap-4 tablet:gap-6 text-sm tablet:text-base">
                <div className="flex items-center gap-3">
                  <Clock className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                  <div>
                    <span className="font-medium">{format(bookingTime, compact ? 'h:mm a' : 'MMM d, h:mm a')}</span>
                    {isDining && (
                      <p className="text-xs tablet:text-sm text-muted-foreground">
                        <span suppressHydrationWarning>{elapsedMinutes}m elapsed</span>
                      </p>
                    )}
                  </div>
                </div>
                
                <div className="flex items-center gap-3">
                  <Users className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                  <span className="font-medium">{booking.party_size} guests</span>
                </div>
                
                <div className="flex items-center gap-3">
                  <Phone className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                  <span className="truncate font-medium">{formatGuestPhone(booking)}</span>
                </div>

                <div className="flex items-center gap-3">
                  <Table2 className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                  <div className="flex items-center gap-2 flex-1">
                    {hasAssignedTables ? (
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">
                          Table {booking.tables.map((t: { table_number: any }) => t.table_number).join(", ")}
                        </span>
                        {onAssignTable && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation()
                              onAssignTable(booking.id)
                            }}
                            className="h-6 px-2 text-xs"
                          >
                            Switch
                          </Button>
                        )}
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <Badge variant="destructive" className="px-3 py-1 text-sm font-medium">
                          No table
                        </Badge>
                        {onAssignTable && ['confirmed', 'pending', 'arrived'].includes(booking.status) && (
                          <Button
                            variant="default"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation()
                              onAssignTable(booking.id)
                            }}
                            className="h-6 px-2 text-xs bg-primary hover:bg-primary/90"
                          >
                            Assign
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Request expiry timer - Enhanced visibility */}
              {booking.status === 'pending' && booking.request_expires_at && (
                <div className="mt-4 tablet:mt-6">
                  <RequestExpiryTimer booking={booking} requestService={requestService} />
                </div>
              )}

              {/* Dining progress bar - Enhanced visibility */}
              {isDining && (
                <div className="mt-4 tablet:mt-6 space-y-2">
                  <div className="flex items-center justify-between text-sm tablet:text-base">
                    <span className="text-muted-foreground font-medium">Service Progress</span>
                    <span className="font-bold text-lg">{diningProgress}%</span>
                  </div>
                  <Progress value={diningProgress} className="h-3 tablet:h-4" />
                </div>
              )}

              {/* Special requests */}
              {booking.special_requests && (
                <div className="mt-4 tablet:mt-6 p-3 tablet:p-4 bg-muted rounded-lg text-sm tablet:text-base">
                  <p className="font-semibold mb-2">Special requests:</p>
                  <p className="text-muted-foreground leading-relaxed">{booking.special_requests}</p>
                </div>
              )}

              {/* Alerts and warnings */}
              <div className="mt-4 tablet:mt-6 space-y-3">
                {!hasAssignedTables && ['confirmed', 'arrived'].includes(booking.status) && (
                  <Alert className="py-3 tablet:py-4">
                    <AlertCircle className="h-5 w-5" />
                    <AlertDescription className="text-sm tablet:text-base font-medium">
                      Table assignment required
                    </AlertDescription>
                  </Alert>
                )}
                
                {booking.status === 'payment' && (
                  <Alert className="py-3 tablet:py-4 border-yellow-200 bg-yellow-50">
                    <CreditCard className="h-5 w-5 text-yellow-600" />
                    <AlertDescription className="text-sm tablet:text-base text-yellow-800 font-medium">
                      Guest is ready to pay
                    </AlertDescription>
                  </Alert>
                )}
                
                {booking.status === 'arrived' && hasAssignedTables && (
                  <Alert className="py-3 tablet:py-4 border-blue-200 bg-blue-50">
                    <UserCheck className="h-5 w-5 text-blue-600" />
                    <AlertDescription className="text-sm tablet:text-base text-blue-800 font-medium">
                      Guest has arrived - ready to be seated at Table {booking.tables[0].table_number}
                    </AlertDescription>
                  </Alert>
                )}
                
                {booking.status === 'pending' && booking.acceptance_attempted_at && (
                  <Alert className="py-3 tablet:py-4 border-orange-200 bg-orange-50">
                    <AlertTriangle className="h-5 w-5 text-orange-600" />
                    <AlertDescription className="text-sm tablet:text-base text-orange-800 font-medium">
                      Previous acceptance failed: {booking.acceptance_failed_reason}
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