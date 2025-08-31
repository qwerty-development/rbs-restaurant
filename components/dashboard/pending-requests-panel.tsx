// components/dashboard/pending-requests-panel.tsx
"use client"

import { useState, useEffect, useMemo } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Progress } from "@/components/ui/progress"
import { format, differenceInMinutes, addMinutes } from "date-fns"
import { 
  Clock, 
  Users, 
  Timer,
  CheckCircle,
  XCircle,
  AlertCircle,
  Phone,
  MessageSquare,
  Table2,
  RefreshCw,
  AlertTriangle,
  Star,
  UserX
} from "lucide-react"
import { cn } from "@/lib/utils"
import { BookingRequestService } from "@/lib/booking-request-service"
import { TableAvailabilityService } from "@/lib/table-availability"
import { toast } from "react-hot-toast"
import { useQuery } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"

interface PendingRequestsPanelProps {
  bookings: any[]
  restaurantId: string
  userId: string
  onUpdate: () => void
}

export function PendingRequestsPanel({ 
  bookings, 
  restaurantId, 
  userId,
  onUpdate 
}: PendingRequestsPanelProps) {
  const [processingId, setProcessingId] = useState<string | null>(null)
  const [selectedTables, setSelectedTables] = useState<Record<string, string[]>>({})
  
  const requestService = new BookingRequestService()
  const tableService = new TableAvailabilityService()
  const supabase = createClient()

  // Filter pending requests
  const pendingRequests = bookings
    .filter(b => b.status === 'pending')
    .sort((a, b) => {
      if (a.request_expires_at && b.request_expires_at) {
        return new Date(a.request_expires_at).getTime() - new Date(b.request_expires_at).getTime()
      }
      return new Date(a.booking_time).getTime() - new Date(b.booking_time).getTime()
    })

  // Fetch all tables for the restaurant
  const { data: allTables = [] } = useQuery({
    queryKey: ["restaurant-tables-pending", restaurantId],
    queryFn: async () => {
      if (!restaurantId) return []
      
      const { data, error } = await supabase
        .from("restaurant_tables")
        .select(`
          *,
          section:restaurant_sections(*)
        `)
        .eq("restaurant_id", restaurantId)
        .eq("is_active", true)
        .order("table_number", { ascending: true })

      if (error) throw error
      return data || []
    },
    enabled: !!restaurantId,
  })

  // Fetch customer data for VIP status
  const { data: customersData = {} } = useQuery({
    queryKey: ["pending-customers", restaurantId, pendingRequests.map(b => b.user?.id).filter(Boolean)],
    queryFn: async () => {
      if (!restaurantId || pendingRequests.length === 0) return {}
      
      const userIds = pendingRequests
        .map(booking => booking.user?.id)
        .filter(Boolean)
        .filter((id, index, self) => self.indexOf(id) === index)
      
      if (userIds.length === 0) return {}

      const { data, error } = await supabase
        .from("restaurant_customers")
        .select(`
          user_id,
          vip_status,
          blacklisted,
          blacklist_reason,
          total_bookings,
          no_show_count
        `)
        .eq("restaurant_id", restaurantId)
        .in("user_id", userIds)

      if (error) throw error

      const customerMap: Record<string, any> = {}
      data?.forEach(customer => {
        customerMap[customer.user_id] = customer
      })

      return customerMap
    },
    enabled: !!restaurantId && pendingRequests.length > 0,
  })

  // Calculate table status for each pending request
  const tableStatusForRequests = useMemo(() => {
    const statusMap: Record<string, any[]> = {}
    
    pendingRequests.forEach(request => {
      const requestTime = new Date(request.booking_time)
      const requestEndTime = addMinutes(requestTime, request.turn_time_minutes || 120)
      
      const tablesWithStatus = allTables.map(table => {
        // Check if table is occupied during the request time
        const conflictingBooking = bookings.find(booking => {
          if (booking.id === request.id) return false // Skip self
          if (!booking.tables || booking.tables.length === 0) return false
          if (!booking.tables.some((t: any) => t.id === table.id)) return false
          
          const bookingTime = new Date(booking.booking_time)
          const bookingEndTime = addMinutes(bookingTime, booking.turn_time_minutes || 120)
          
          // Check for time overlap
          return (requestTime < bookingEndTime && requestEndTime > bookingTime)
        })
        
        // Check if table is currently occupied
        const currentlyOccupied = bookings.find(booking => {
          const occupiedStatuses = ['arrived', 'seated', 'ordered', 'appetizers', 'main_course', 'dessert', 'payment']
          return occupiedStatuses.includes(booking.status) && 
                 booking.tables?.some((t: any) => t.id === table.id)
        })
        
        return {
          ...table,
          isAvailable: !conflictingBooking && !currentlyOccupied,
          conflictingBooking,
          currentlyOccupied,
          canBeSelected: !conflictingBooking && !currentlyOccupied
        }
      })
      
      statusMap[request.id] = tablesWithStatus
    })
    
    return statusMap
  }, [allTables, bookings, pendingRequests])

  // Fetch available tables for each pending request (simplified)
  const availableTablesForRequests = useMemo(() => {
    const availability: Record<string, any> = {}
    
    pendingRequests.forEach(request => {
      const tableStatus = tableStatusForRequests[request.id] || []
      const availableTables = tableStatus.filter(t => t.canBeSelected)
      
      // Group by capacity
      const singleTables = availableTables.filter(t => t.capacity >= request.party_size)
      const allAvailable = availableTables
      
      availability[request.id] = {
        singleTables,
        allAvailable,
        hasAvailable: singleTables.length > 0 || allAvailable.length > 0
      }
    })
    
    return availability
  }, [pendingRequests, tableStatusForRequests])

  const handleAccept = async (bookingId: string) => {
    setProcessingId(bookingId)
    
    try {
      const result = await requestService.acceptRequest(
        bookingId, 
        userId, 
        selectedTables[bookingId] || [],
        { suggestAlternatives: true }
      )
      
      if (result.success) {
        toast.success("Booking request accepted")
        onUpdate()
      } else {
        toast.error(result.error || "Failed to accept request")
      }
    } catch (error) {
      toast.error("Failed to accept request")
    } finally {
      setProcessingId(null)
    }
  }

  const handleDecline = async (bookingId: string) => {
    const confirmDecline = confirm(
      "⚠️ Decline Booking Request?\n\n" +
      "This action cannot be undone. The guest will be notified.\n\n" +
      "We'll suggest alternative times if available."
    )
    
    if (!confirmDecline) return
    
    setProcessingId(bookingId)
    try {
      const result = await requestService.declineRequest(
        bookingId, 
        userId, 
        "Restaurant declined", 
        true
      )
      
      if (result.success) {
        toast.success("Booking request declined")
        if (result.alternatives) {
          toast("Alternative suggestions sent to customer", { icon: "📧" })
        }
        onUpdate()
      }
    } catch (error) {
      toast.error("Failed to decline request")
    } finally {
      setProcessingId(null)
    }
  }

  const getTimeUntilExpiry = (booking: any) => {
    if (!booking.request_expires_at) return null
    
    const expiresAt = new Date(booking.request_expires_at)
    const now = new Date()
    const hoursLeft = differenceInMinutes(expiresAt, now) / 60
    const minutesLeft = differenceInMinutes(expiresAt, now) % 60
    const expired = expiresAt <= now
    
    const totalMinutes = booking.request_response_time || 1440
    const elapsedMinutes = totalMinutes - differenceInMinutes(expiresAt, now)
    const percentage = Math.max(0, Math.min(100, (elapsedMinutes / totalMinutes) * 100))
    
    return { hoursLeft: Math.floor(hoursLeft), minutesLeft, expired, percentage }
  }

  const urgentCount = pendingRequests.filter(r => {
    const expiry = getTimeUntilExpiry(r)
    return expiry && !expiry.expired && expiry.hoursLeft < 2
  }).length

  if (pendingRequests.length === 0) {
    return null
  }

  return (
    <Card className={cn(
      "w-full border-2 shadow-xl",
      urgentCount > 0 
        ? "border-red-400 bg-gradient-to-br from-red-100 to-red-50 animate-pulse" 
        : "border-orange-300 bg-gradient-to-br from-orange-100 to-orange-50"
    )}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={cn(
              "p-2.5 rounded-full shadow-inner",
              urgentCount > 0 
                ? "bg-red-200 animate-bounce" 
                : "bg-orange-200"
            )}>
              <Timer className={cn(
                "h-5 w-5",
                urgentCount > 0 ? "text-red-700" : "text-orange-700"
              )} />
            </div>
            <div>
              <CardTitle className="text-lg font-bold text-gray-900">Pending Requests</CardTitle>
              <CardDescription className="text-sm">
                <span className="font-medium">{pendingRequests.length} awaiting approval</span>
                {urgentCount > 0 && (
                  <Badge 
                    variant="destructive" 
                    className="ml-2 text-xs px-2 py-0.5 animate-pulse"
                  >
                    {urgentCount} URGENT!
                  </Badge>
                )}
              </CardDescription>
            </div>
          </div>
          <Button 
            variant="ghost" 
            size="icon"
            className="h-8 w-8 hover:bg-white/50"
            onClick={onUpdate}
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <ScrollArea className="h-[450px]">
          <div className="space-y-4 pr-4">
            {pendingRequests.map((booking) => {
              const bookingTime = new Date(booking.booking_time)
              const isProcessing = processingId === booking.id
              const availability = availableTablesForRequests[booking.id]
              const hasAvailableTables = availability?.hasAvailable
              const expiry = getTimeUntilExpiry(booking)
              const isUrgent = expiry && !expiry.expired && expiry.hoursLeft < 2
              const customerData = customersData[booking.user?.id]
              const tableStatus = tableStatusForRequests[booking.id] || []
              
              return (
                <div
                  key={booking.id}
                  className={cn(
                    "p-5 rounded-xl border-2 bg-white shadow-lg",
                    "transition-all hover:shadow-xl",
                    isProcessing && "opacity-50",
                    !hasAvailableTables && "border-red-300 bg-gradient-to-br from-red-50 to-white",
                    isUrgent && "ring-2 ring-red-400 ring-offset-1"
                  )}
                >
                  {/* Expiry timer */}
                  {expiry && (
                    <div className="mb-3">
                      <div className={cn(
                        "flex items-center gap-2 text-xs font-bold mb-1",
                        expiry.expired ? "text-red-700" : 
                        expiry.hoursLeft < 2 ? "text-orange-700" : 
                        "text-gray-700"
                      )}>
                        <Timer className="h-4 w-4" />
                        {expiry.expired ? "EXPIRED" : `${expiry.hoursLeft}h ${expiry.minutesLeft}m remaining`}
                      </div>
                      <Progress 
                        value={expiry.percentage} 
                        className="h-2"
                        indicatorClassName={cn(
                          expiry.percentage < 20 ? "bg-red-500" :
                          expiry.percentage < 50 ? "bg-orange-500" :
                          "bg-green-500"
                        )}
                      />
                    </div>
                  )}

                  {/* No tables alert */}
                  {!hasAvailableTables && (
                    <Alert className="mb-3 p-3 border-red-300 bg-red-100">
                      <AlertTriangle className="h-4 w-4" />
                      <AlertDescription className="text-sm font-medium text-red-800">
                        No tables available for this time slot
                      </AlertDescription>
                    </Alert>
                  )}

                  {/* Guest info with VIP status */}
                  <div className="mb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <p className="font-bold text-lg text-gray-900">
                            {booking.user?.full_name || booking.guest_name || 'Guest'}
                          </p>
                          {customerData?.vip_status && (
                            <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 border-yellow-300">
                              <Star className="h-3 w-3 mr-1" />
                              VIP
                            </Badge>
                          )}
                          {customerData?.blacklisted && (
                            <Badge variant="destructive" className="bg-red-100 text-red-800 border-red-300">
                              <UserX className="h-3 w-3 mr-1" />
                              Blacklisted
                            </Badge>
                          )}
                        </div>
                        {(booking.user?.phone_number || booking.guest_phone) && (
                          <p className="text-sm text-gray-600 flex items-center gap-1.5 mt-1">
                            <Phone className="h-3.5 w-3.5" />
                            {booking.user?.phone_number || booking.guest_phone}
                          </p>
                        )}
                        {customerData && (
                          <p className="text-xs text-gray-500 mt-1">
                            {customerData.total_bookings} previous bookings
                            {customerData.no_show_count > 0 && ` • ${customerData.no_show_count} no-shows`}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Booking details */}
                  <div className="grid grid-cols-3 gap-4 mb-4 p-4 bg-gray-50 rounded-lg">
                    <div className="text-center">
                      <Clock className="h-6 w-6 text-gray-500 mx-auto mb-2" />
                      <p className="text-base font-semibold">{format(bookingTime, 'h:mm a')}</p>
                      <p className="text-sm text-gray-600">{format(bookingTime, 'MMM d, yyyy')}</p>
                    </div>
                    <div className="text-center">
                      <Users className="h-6 w-6 text-gray-500 mx-auto mb-2" />
                      <p className="text-base font-semibold">{booking.party_size} guests</p>
                      <p className="text-sm text-gray-600">Party size</p>
                    </div>
                    <div className="text-center">
                      <Timer className="h-6 w-6 text-gray-500 mx-auto mb-2" />
                      <p className="text-base font-semibold">{booking.turn_time_minutes || 120}m</p>
                      <p className="text-sm text-gray-600">Duration</p>
                    </div>
                  </div>

                  {/* Special requests */}
                  {booking.special_requests && (
                    <div className="mb-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
                      <p className="text-sm text-blue-900 flex items-start gap-1.5">
                        <MessageSquare className="h-4 w-4 mt-0.5 flex-shrink-0 text-blue-600" />
                        <span className="font-medium">Note:</span> {booking.special_requests}
                      </p>
                    </div>
                  )}

                  {/* Enhanced table selection with status */}
                  {hasAvailableTables && (
                    <div className="mb-3">
                      <p className="text-xs font-medium text-gray-700 mb-2">
                        Quick table assignment ({availability.singleTables.length} suitable):
                      </p>
                      <div className="grid grid-cols-4 gap-1.5 max-h-20 overflow-y-auto">
                        {availability.singleTables.slice(0, 12).map((table: any) => {
                          const isSelected = (selectedTables[booking.id] || []).includes(table.id)
                          const tableStatusInfo = tableStatus.find(t => t.id === table.id)
                          
                          return (
                            <Button
                              key={table.id}
                              size="sm"
                              variant={isSelected ? "default" : "outline"}
                              className={cn(
                                "h-8 text-xs px-2 relative",
                                isSelected && "bg-blue-600 hover:bg-blue-700 border-blue-600",
                                !tableStatusInfo?.canBeSelected && "opacity-50 cursor-not-allowed",
                                tableStatusInfo?.currentlyOccupied && "bg-red-100 border-red-300 text-red-700",
                                tableStatusInfo?.conflictingBooking && "bg-orange-100 border-orange-300 text-orange-700"
                              )}
                              onClick={() => {
                                if (!tableStatusInfo?.canBeSelected) return
                                
                                setSelectedTables(prev => ({
                                  ...prev,
                                  [booking.id]: isSelected
                                    ? prev[booking.id].filter(id => id !== table.id)
                                    : [...(prev[booking.id] || []), table.id]
                                }))
                              }}
                              disabled={isProcessing || !tableStatusInfo?.canBeSelected}
                              title={
                                tableStatusInfo?.currentlyOccupied ? "Currently occupied" :
                                tableStatusInfo?.conflictingBooking ? "Booked during this time" :
                                `Table ${table.table_number} (${table.capacity} seats)`
                              }
                            >
                              T{table.table_number}
                              <span className="ml-1 text-xs opacity-70">({table.capacity})</span>
                              {!tableStatusInfo?.canBeSelected && (
                                <div className="absolute inset-0 bg-gray-200 opacity-50 rounded" />
                              )}
                            </Button>
                          )
                        })}
                        {availability.singleTables.length > 12 && (
                          <span className="text-xs text-gray-500 flex items-center col-span-2">
                            +{availability.singleTables.length - 12} more
                          </span>
                        )}
                      </div>
                      
                      {/* Show table status legend */}
                      <div className="flex items-center gap-3 text-xs text-gray-600 mt-2">
                        <div className="flex items-center gap-1">
                          <div className="w-3 h-3 bg-white border border-gray-300 rounded"></div>
                          Available
                        </div>
                        <div className="flex items-center gap-1">
                          <div className="w-3 h-3 bg-red-100 border border-red-300 rounded"></div>
                          Occupied
                        </div>
                        <div className="flex items-center gap-1">
                          <div className="w-3 h-3 bg-orange-100 border border-orange-300 rounded"></div>
                          Booked
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Action buttons */}
                  <div className="flex gap-3">
                    <Button
                      size="default"
                      className={cn(
                        "flex-1 h-10 font-medium shadow-md",
                        hasAvailableTables || selectedTables[booking.id]?.length
                          ? "bg-gradient-to-r from-green-600 to-green-500 hover:from-green-700 hover:to-green-600 text-white"
                          : "bg-gray-200 text-gray-500 cursor-not-allowed"
                      )}
                      onClick={() => handleAccept(booking.id)}
                      disabled={isProcessing || (!hasAvailableTables && !selectedTables[booking.id]?.length)}
                    >
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Accept Request
                    </Button>
                    <Button
                      size="default"
                      variant="outline"
                      className="flex-1 h-10 font-medium border-red-300 text-red-700 hover:bg-red-50 hover:border-red-400 shadow-md"
                      onClick={() => handleDecline(booking.id)}
                      disabled={isProcessing}
                    >
                      <XCircle className="h-4 w-4 mr-2" />
                      Decline
                    </Button>
                  </div>
                </div>
              )
            })}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  )
}