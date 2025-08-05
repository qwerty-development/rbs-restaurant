// components/dashboard/pending-requests-panel.tsx
"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Progress } from "@/components/ui/progress"
import { format, differenceInMinutes } from "date-fns"
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
  AlertTriangle
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

  // Fetch available tables for each pending request
  const { data: availableTables } = useQuery({
    queryKey: ["available-tables-requests", pendingRequests.map(r => r.id)],
    queryFn: async () => {
      const availability: Record<string, any> = {}
      
      for (const request of pendingRequests) {
        const available = await tableService.getAvailableTablesForSlot(
          restaurantId,
          new Date(request.booking_time),
          request.party_size,
          request.turn_time_minutes || 120
        )
        availability[request.id] = available
      }
      
      return availability
    },
    enabled: pendingRequests.length > 0,
    refetchInterval: 30000
  })

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
      "m-4 border-2 shadow-xl",
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
        <ScrollArea className="h-[320px]">
          <div className="space-y-3 pr-4">
            {pendingRequests.map((booking) => {
              const bookingTime = new Date(booking.booking_time)
              const isProcessing = processingId === booking.id
              const availability = availableTables?.[booking.id]
              const hasAvailableTables = availability && 
                (availability.singleTables.length > 0 || availability.combinations.length > 0)
              const expiry = getTimeUntilExpiry(booking)
              const isUrgent = expiry && !expiry.expired && expiry.hoursLeft < 2
              
              return (
                <div
                  key={booking.id}
                  className={cn(
                    "p-4 rounded-xl border-2 bg-white shadow-lg",
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

                  {/* Guest info */}
                  <div className="mb-3">
                    <p className="font-bold text-lg text-gray-900">
                      {booking.user?.full_name || booking.guest_name || 'Guest'}
                    </p>
                    {(booking.user?.phone_number || booking.guest_phone) && (
                      <p className="text-sm text-gray-600 flex items-center gap-1.5 mt-1">
                        <Phone className="h-3.5 w-3.5" />
                        {booking.user?.phone_number || booking.guest_phone}
                      </p>
                    )}
                  </div>

                  {/* Booking details */}
                  <div className="grid grid-cols-3 gap-3 mb-3 p-3 bg-gray-50 rounded-lg">
                    <div className="text-center">
                      <Clock className="h-5 w-5 text-gray-500 mx-auto mb-1" />
                      <p className="text-sm font-semibold">{format(bookingTime, 'h:mm a')}</p>
                      <p className="text-xs text-gray-600">{format(bookingTime, 'MMM d')}</p>
                    </div>
                    <div className="text-center">
                      <Users className="h-5 w-5 text-gray-500 mx-auto mb-1" />
                      <p className="text-sm font-semibold">{booking.party_size} guests</p>
                      <p className="text-xs text-gray-600">Party size</p>
                    </div>
                    <div className="text-center">
                      <Timer className="h-5 w-5 text-gray-500 mx-auto mb-1" />
                      <p className="text-sm font-semibold">{booking.turn_time_minutes}m</p>
                      <p className="text-xs text-gray-600">Duration</p>
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

                  {/* Table selection */}
                  {hasAvailableTables && (
                    <div className="mb-3">
                      <p className="text-xs font-medium text-gray-700 mb-2">Quick table assignment:</p>
                      <div className="flex flex-wrap gap-1.5">
                        {availability.singleTables.slice(0, 6).map((table: any) => (
                          <Button
                            key={table.id}
                            size="sm"
                            variant={
                              (selectedTables[booking.id] || []).includes(table.id) 
                                ? "default" 
                                : "outline"
                            }
                            className={cn(
                              "h-7 text-xs px-3",
                              (selectedTables[booking.id] || []).includes(table.id) &&
                              "bg-blue-600 hover:bg-blue-700"
                            )}
                            onClick={() => {
                              setSelectedTables(prev => ({
                                ...prev,
                                [booking.id]: prev[booking.id]?.includes(table.id)
                                  ? prev[booking.id].filter(id => id !== table.id)
                                  : [...(prev[booking.id] || []), table.id]
                              }))
                            }}
                            disabled={isProcessing}
                          >
                            T{table.table_number}
                          </Button>
                        ))}
                        {availability.singleTables.length > 6 && (
                          <span className="text-xs text-gray-500 flex items-center">
                            +{availability.singleTables.length - 6} more
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Action buttons */}
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      className={cn(
                        "flex-1 h-9 font-medium shadow-md",
                        hasAvailableTables || selectedTables[booking.id]?.length
                          ? "bg-gradient-to-r from-green-600 to-green-500 hover:from-green-700 hover:to-green-600 text-white"
                          : "bg-gray-200 text-gray-500 cursor-not-allowed"
                      )}
                      onClick={() => handleAccept(booking.id)}
                      disabled={isProcessing || (!hasAvailableTables && !selectedTables[booking.id]?.length)}
                    >
                      <CheckCircle className="h-4 w-4 mr-1.5" />
                      Accept
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1 h-9 font-medium border-red-300 text-red-700 hover:bg-red-50 hover:border-red-400 shadow-md"
                      onClick={() => handleDecline(booking.id)}
                      disabled={isProcessing}
                    >
                      <XCircle className="h-4 w-4 mr-1.5" />
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