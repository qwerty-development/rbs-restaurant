// components/bookings/booking-details.tsx
"use client"

import { useState, useEffect } from "react"
import { format, addMinutes, differenceInMinutes } from "date-fns"
import { createClient } from "@/lib/supabase/client"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { TableAvailabilityService } from "@/lib/table-availability"
import { TableStatusService, type DiningStatus } from "@/lib/table-status"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Checkbox } from "@/components/ui/checkbox"
import { Progress } from "@/components/ui/progress"
import { Separator } from "@/components/ui/separator"
import { ScrollArea } from "@/components/ui/scroll-area"
import { toast } from "react-hot-toast"
import { 
  Calendar,
  Clock,
  Users,
  Phone,
  Mail,
  MessageSquare,
  Gift,
  Edit,
  Save,
  X,
  AlertCircle,
  Table2,
  RefreshCw,
  UserCheck,
  ChefHat,
  Utensils,
  CreditCard,
  CheckCircle,
  History,
  ArrowRight,
  Timer,
  Activity
} from "lucide-react"
import { cn } from "@/lib/utils"

// Helper function to format status names for display
const formatStatusLabel = (status: string): string => {
  return status
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

// Helper function to get confirmation message for status changes
const getStatusConfirmationMessage = (status: string, guestName?: string): string => {
  const guest = guestName || 'this guest'
  
  switch (status) {
    case 'no_show':
      return `Mark ${guest} as a no-show?\n\nThis will:\n• Record that the guest didn't arrive\n• Free up the table for other guests\n• This action cannot be easily undone`
    case 'cancelled_by_restaurant':
      return `Cancel this booking for ${guest}?\n\nThis will:\n• Cancel the reservation\n• Free up the table\n• Guest should be notified separately`
    case 'cancelled_by_user':
      return `Mark this booking as cancelled by ${guest}?\n\nThis confirms the guest cancelled their own reservation.`
    default:
      return `Change status to "${formatStatusLabel(status)}" for ${guest}?`
  }
}
import type { Booking } from "@/types"
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "../ui/card"
import BookingCustomerDetails from "./booking-customer-details"

interface BookingDetailsProps {
  booking: Booking
  onClose: () => void
  onUpdate: (updates: Partial<Booking>) => void
}

const STATUS_CONFIGS = {
  pending: { icon: Timer, color: 'text-yellow-600', bg: 'bg-yellow-100' },
  confirmed: { icon: CheckCircle, color: 'text-blue-600', bg: 'bg-blue-100' },
  arrived: { icon: UserCheck, color: 'text-indigo-600', bg: 'bg-indigo-100' },
  seated: { icon: ChefHat, color: 'text-purple-600', bg: 'bg-purple-100' },
  ordered: { icon: Clock, color: 'text-orange-600', bg: 'bg-orange-100' },
  appetizers: { icon: Utensils, color: 'text-green-600', bg: 'bg-green-100' },
  main_course: { icon: Utensils, color: 'text-green-700', bg: 'bg-green-200' },
  dessert: { icon: Utensils, color: 'text-pink-600', bg: 'bg-pink-100' },
  payment: { icon: CreditCard, color: 'text-yellow-700', bg: 'bg-yellow-200' },
  completed: { icon: CheckCircle, color: 'text-gray-600', bg: 'bg-gray-100' },
  no_show: { icon: AlertCircle, color: 'text-red-600', bg: 'bg-red-100' },
  cancelled: { icon: X, color: 'text-red-600', bg: 'bg-red-100' }
}



export function BookingDetails({ booking, onClose, onUpdate }: BookingDetailsProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [editedData, setEditedData] = useState({
    party_size: booking.party_size,
    turn_time_minutes: booking.turn_time_minutes,
    special_requests: booking.special_requests || "",
    status: booking.status,
  })
  const [selectedTableIds, setSelectedTableIds] = useState<string[]>(
    booking.tables?.map(t => t.id) || []
  )
  const [checkingAvailability, setCheckingAvailability] = useState(false)
  const [showCapacityWarning, setShowCapacityWarning] = useState(false)
  const [capacityWarningMessage, setCapacityWarningMessage] = useState("")
  const [activeTab, setActiveTab] = useState("details")
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false)
  const [currentBookingStatus, setCurrentBookingStatus] = useState(booking.status)
  
  const supabase = createClient()
  const queryClient = useQueryClient()
  const tableService = new TableAvailabilityService()
  const statusService = new TableStatusService()

  // Get current user
  const [userId, setUserId] = useState<string>("")
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setUserId(user.id)
    })
  }, [])

  // Update local state when booking prop changes
  useEffect(() => {
    setEditedData({
      party_size: booking.party_size,
      turn_time_minutes: booking.turn_time_minutes,
      special_requests: booking.special_requests || "",
      status: booking.status,
    })
    setSelectedTableIds(booking.tables?.map(t => t.id) || [])
    setCurrentBookingStatus(booking.status)
  }, [booking.id, booking.party_size, booking.turn_time_minutes, booking.special_requests, booking.status, booking.tables])

  // Fetch status history
  const { data: statusHistory } = useQuery({
    queryKey: ["booking-status-history", booking.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("booking_status_history")
        .select(`
          *,
          changed_by_user:profiles!booking_status_history_changed_by_fkey(full_name)
        `)
        .eq("booking_id", booking.id)
        .order("changed_at", { ascending: false })

      if (error) throw error
      return data
    },
  })

  // Fetch all tables for the restaurant
  const { data: allTables } = useQuery({
    queryKey: ["restaurant-tables", booking.restaurant_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("restaurant_tables")
        .select("*")
        .eq("restaurant_id", booking.restaurant_id)
        .eq("is_active", true)
        .order("table_number")

      if (error) throw error
      return data
    },
  })

  // Check table availability when selection changes
  const { data: tableAvailability, refetch: checkAvailability } = useQuery({
    queryKey: [
      "table-availability",
      booking.id,
      selectedTableIds,
      editedData.turn_time_minutes
    ],
    queryFn: async () => {
      if (selectedTableIds.length === 0) return null
      
      return await tableService.checkTableAvailability(
        booking.restaurant_id,
        selectedTableIds,
        new Date(booking.booking_time),
        editedData.turn_time_minutes,
        booking.id
      )
    },
    enabled: isEditing && selectedTableIds.length > 0,
  })

  // Validate table capacity vs party size
  const validateTableCapacity = () => {
    if (!allTables || selectedTableIds.length === 0) return { isValid: true, message: "" }
    
    const selectedTables = allTables.filter(table => selectedTableIds.includes(table.id))
    const totalCapacity = selectedTables.reduce((sum, table) => sum + table.capacity, 0)
    const partySize = editedData.party_size
    
    if (totalCapacity < partySize) {
      const deficit = partySize - totalCapacity
      return {
        isValid: false,
        message: `Warning: Party size (${partySize}) exceeds table capacity (${totalCapacity}) by ${deficit} ${deficit === 1 ? 'guest' : 'guests'}.\n\nSelected tables: ${selectedTables.map(t => `T${t.table_number} (${t.capacity})`).join(', ')}\n\nDo you want to proceed with this assignment?`
      }
    }
    
    return { isValid: true, message: "" }
  }

  // Update booking with table assignments
  const updateBookingMutation = useMutation({
    mutationFn: async (forceUpdate?: boolean) => {
      // Validate capacity unless forcing the update
      if (!forceUpdate) {
        const validation = validateTableCapacity()
        if (!validation.isValid) {
          setCapacityWarningMessage(validation.message)
          setShowCapacityWarning(true)
          throw new Error("Capacity validation failed") // This will trigger onError but won't show a toast
        }
      }

      const { error: bookingError } = await supabase
        .from("bookings")
        .update({
          ...editedData,
          updated_at: new Date().toISOString()
        })
        .eq("id", booking.id)

      if (bookingError) throw bookingError

      // Update table assignments if changed
      const currentTableIds = booking.tables?.map(t => t.id) || []
      const tablesChanged = JSON.stringify(currentTableIds.sort()) !== JSON.stringify(selectedTableIds.sort())

      if (tablesChanged) {
        // Remove existing assignments
        await supabase
          .from("booking_tables")
          .delete()
          .eq("booking_id", booking.id)

        // Add new assignments
        if (selectedTableIds.length > 0) {
          const tableAssignments = selectedTableIds.map(tableId => ({
            booking_id: booking.id,
            table_id: tableId
          }))

          const { error: tablesError } = await supabase
            .from("booking_tables")
            .insert(tableAssignments)

          if (tablesError) throw tablesError
        }
      }

      return { ...editedData, tableIds: selectedTableIds }
    },
    onSuccess: (data) => {
      toast.success("Booking updated successfully")
      onUpdate(data)
      setIsEditing(false)
      // Invalidate multiple query keys to ensure dashboard refreshes
      queryClient.invalidateQueries({ queryKey: ["bookings"] })
      queryClient.invalidateQueries({ queryKey: ["todays-bookings"] })
      queryClient.invalidateQueries({ queryKey: ["booking-status-history"] })
    },
    onError: (error) => {
      console.error("Update error:", error)
      // Don't show toast for validation errors as we handle them with dialog
      if (error.message !== "Capacity validation failed") {
        toast.error("Failed to update booking")
      }
    },
  })

  // Handle status transitions with debouncing
  const handleStatusTransition = async (newStatus: any) => {
    if (isUpdatingStatus) return // Prevent multiple clicks
    if (currentBookingStatus === newStatus) return // Prevent duplicate status updates
    
    setIsUpdatingStatus(true)
    try {
      console.log(`Attempting to change status from ${currentBookingStatus} to ${newStatus}`)
      const result = await statusService.updateBookingStatus(booking.id, newStatus, userId)
      
      // Only update UI if status actually changed
      if (!result.noChange) {
        setCurrentBookingStatus(newStatus) // Update local state immediately
        
        // Only call onUpdate after a brief delay to prevent cascading updates
        setTimeout(() => {
          onUpdate({ status: newStatus })
        }, 100)
        
        // Delay the query invalidation to prevent immediate refetches
        setTimeout(() => {
          queryClient.invalidateQueries({ queryKey: ["booking-status-history"] })
          queryClient.invalidateQueries({ queryKey: ["todays-bookings"] })
          queryClient.invalidateQueries({ queryKey: ["bookings"] })
        }, 200)
        
        toast.success(`Status updated to ${formatStatusLabel(newStatus)}`)
      } else {
        console.log(`Status was already ${newStatus}, skipping UI update`)
        console.log(`Status is already ${formatStatusLabel(newStatus)}`)
      }
    } catch (error) {
      console.error("Status transition error:", error)
      toast.error("Failed to update status")
    } finally {
      // Add a small delay before re-enabling to prevent rapid successive clicks
      setTimeout(() => {
        setIsUpdatingStatus(false)
      }, 300)
    }
  }

  // Handle table switch
  const handleTableSwitch = async (newTableIds: string[]) => {
    try {
      await statusService.switchTables(booking.id, newTableIds, userId, "Table switch from booking details")
      toast.success("Tables switched successfully")
      setSelectedTableIds(newTableIds)
      // Invalidate multiple query keys to ensure dashboard refreshes
      queryClient.invalidateQueries({ queryKey: ["bookings"] })
      queryClient.invalidateQueries({ queryKey: ["todays-bookings"] })
      queryClient.invalidateQueries({ queryKey: ["shared-tables-summary"] })
      queryClient.invalidateQueries({ queryKey: ["shared-table-availability"] })
    } catch (error) {
      toast.error("Failed to switch tables")
    }
  }

  // Get guest name for confirmations
  const guestName = booking.guest_name || booking.user?.full_name || 'Guest'

  // Get valid status transitions - use current booking status instead of original booking.status
  const validTransitions = statusService.getValidTransitions(currentBookingStatus as DiningStatus)
  const allAvailableStatuses = statusService.getAllAvailableStatuses(currentBookingStatus as DiningStatus)
  const currentProgress = TableStatusService.getDiningProgress(currentBookingStatus as DiningStatus)
  const statusConfig = STATUS_CONFIGS[currentBookingStatus as keyof typeof STATUS_CONFIGS]
  const StatusIcon = statusConfig?.icon || Timer

  // Calculate dining time
  const bookingTime = new Date(booking.booking_time)
  const now = new Date()
  
  // Use checked_in_at for elapsed time if guest has checked in, otherwise use booking_time
  const timeReference = booking.checked_in_at ? new Date(booking.checked_in_at) : bookingTime
  const elapsedMinutes = differenceInMinutes(now, timeReference)
  const isCurrentlyDining = ['seated', 'ordered', 'appetizers', 'main_course', 'dessert', 'payment'].includes(currentBookingStatus)

  return (
    <>
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl w-full max-h-[90vh] flex flex-col p-0 overflow-hidden">
        <div className="flex-shrink-0 px-6 py-4 border-b">
          <DialogHeader className="space-y-0">
            <div className="flex items-center justify-between pr-8">
              <DialogTitle className="flex items-center gap-3">
                <StatusIcon className={cn("h-6 w-6", statusConfig?.color)} />
                Booking Details
              </DialogTitle>
              <div className="flex items-center gap-2">
                {!isEditing ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsEditing(true)}
                  >
                    <Edit className="h-4 w-4 mr-2" />
                    Edit
                  </Button>
                ) : (
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setIsEditing(false)
                        setEditedData({
                          party_size: booking.party_size,
                          turn_time_minutes: booking.turn_time_minutes,
                          special_requests: booking.special_requests || "",
                          status: booking.status,
                        })
                        setSelectedTableIds(booking.tables?.map(t => t.id) || [])
                      }}
                    >
                      <X className="h-4 w-4 mr-2" />
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => updateBookingMutation.mutate(false)}
                      disabled={updateBookingMutation.isPending}
                    >
                      <Save className="h-4 w-4 mr-2" />
                      Save
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </DialogHeader>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
            <TabsList className="grid w-full grid-cols-4 flex-shrink-0 mb-4">
              <TabsTrigger value="details">Details</TabsTrigger>
              <TabsTrigger value="customer">Customer</TabsTrigger>
              <TabsTrigger value="status">Status</TabsTrigger>
              <TabsTrigger value="history">History</TabsTrigger>
            </TabsList>

            <div className="flex-1">
              <TabsContent value="details" className="space-y-6 m-0">{/* Guest Information */}
                <div>
                  <h3 className="font-semibold mb-3">Guest Information</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <Label className="text-sm text-muted-foreground">Name</Label>
                      <p className="font-medium">
                        {booking.guest_name || booking.user?.full_name || 'Guest'}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-sm text-muted-foreground">Phone</Label>
                      <p className="font-medium">
                        {booking.guest_phone || booking.user?.phone_number || 'Not provided'}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-sm text-muted-foreground">Email</Label>
                      <p className="font-medium">
                        {booking.guest_email || booking.user?.email || 'Not provided'}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-sm text-muted-foreground">Confirmation Code</Label>
                      <div>
                        <code className="font-mono text-sm bg-muted px-2 py-1 rounded">
                          {booking.confirmation_code}
                        </code>
                      </div>
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Booking Details */}
                <div>
                  <h3 className="font-semibold mb-3">Booking Details</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <Label className="text-sm text-muted-foreground">Date & Time</Label>
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <p className="font-medium">
                          {format(bookingTime, "MMM d, yyyy")} at {format(bookingTime, "h:mm a")}
                        </p>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-sm text-muted-foreground">Party Size</Label>
                      {isEditing ? (
                        <Input
                          type="number"
                          min="1"
                          max="20"
                          value={editedData.party_size}
                          onChange={(e) => setEditedData(prev => ({
                            ...prev,
                            party_size: parseInt(e.target.value) || 1
                          }))}
                        />
                      ) : (
                        <div className="flex items-center gap-2">
                          <Users className="h-4 w-4 text-muted-foreground" />
                          <p className="font-medium">{editedData.party_size} guests</p>
                        </div>
                      )}
                    </div>
                    <div className="space-y-1">
                      <Label className="text-sm text-muted-foreground">Turn Time</Label>
                      {isEditing ? (
                        <Select
                          value={editedData.turn_time_minutes.toString()}
                          onValueChange={(value) => setEditedData(prev => ({
                            ...prev,
                            turn_time_minutes: parseInt(value)
                          }))}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="90">1.5 hours</SelectItem>
                            <SelectItem value="120">2 hours</SelectItem>
                            <SelectItem value="150">2.5 hours</SelectItem>
                            <SelectItem value="180">3 hours</SelectItem>
                          </SelectContent>
                        </Select>
                      ) : (
                        <p className="font-medium">{editedData.turn_time_minutes / 60} hours</p>
                      )}
                    </div>
                    <div className="space-y-1">
                      <Label className="text-sm text-muted-foreground">Status</Label>
                      <div>
                        <Badge className={cn("text-sm", statusConfig?.bg, statusConfig?.color)}>
                          {formatStatusLabel(currentBookingStatus)}
                        </Badge>
                      </div>
                    </div>
                  </div>

                  {booking.occasion && (
                    <div className="mt-4">
                      <Label className="text-sm text-muted-foreground">Occasion</Label>
                      <Badge variant="secondary" className="mt-1">
                        <Gift className="h-3 w-3 mr-1" />
                        {booking.occasion}
                      </Badge>
                    </div>
                  )}
                </div>

                <Separator />

                {/* Table Assignment */}
                <div>
                  <h3 className="font-semibold mb-3">Table Assignment</h3>
                  {isEditing ? (
                    <div className="space-y-3">
                      <div className="grid grid-cols-4 gap-2">
                        {allTables?.map(table => {
                          const isSelected = selectedTableIds.includes(table.id)
                          const isAvailable = tableAvailability?.tables.find(t => t.tableId === table.id)?.isAvailable !== false
                          
                          return (
                            <Button
                              key={table.id}
                              variant={isSelected ? "default" : "outline"}
                              size="sm"
                              onClick={() => {
                                setSelectedTableIds(prev => 
                                  prev.includes(table.id)
                                    ? prev.filter(id => id !== table.id)
                                    : [...prev, table.id]
                                )
                              }}
                              disabled={!isAvailable && !isSelected}
                              className={cn(
                                !isAvailable && !isSelected && "opacity-50"
                              )}
                            >
                              T{table.table_number} ({table.capacity})
                              {!isAvailable && !isSelected && (
                                <AlertCircle className="h-3 w-3 ml-1" />
                              )}
                            </Button>
                          )
                        })}
                      </div>
                      {tableAvailability && !tableAvailability.available && (
                        <Alert>
                          <AlertCircle className="h-4 w-4" />
                          <AlertDescription>
                            Some selected tables have conflicts
                          </AlertDescription>
                        </Alert>
                      )}
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <Table2 className="h-4 w-4 text-muted-foreground" />
                      {booking.tables && booking.tables.length > 0 ? (
                        <p className="font-medium">
                          Tables {booking.tables.map(t => t.table_number).join(", ")}
                        </p>
                      ) : (
                        <Badge variant="destructive">No table assigned</Badge>
                      )}
                    </div>
                  )}
                </div>

                <Separator />

                {/* Special Requests */}
                <div>
                  <Label className="text-sm text-muted-foreground">Special Requests</Label>
                  {isEditing ? (
                    <Textarea
                      value={editedData.special_requests}
                      onChange={(e) => setEditedData(prev => ({
                        ...prev,
                        special_requests: e.target.value
                      }))}
                      placeholder="Any special requests..."
                      className="mt-2"
                    />
                  ) : (
                    <p className="mt-2 text-sm">
                      {editedData.special_requests || "No special requests"}
                    </p>
                  )}
                </div>

                {/* Applied Offer */}
                {booking.special_offers && (
                  <div>
                    <Label className="text-sm text-muted-foreground">Applied Offer</Label>
                    <div className="mt-2 p-4 bg-green-50 border border-green-200 rounded-lg">
                      <div className="flex items-start gap-3">
                        <Gift className="h-5 w-5 mt-0.5 text-green-600 flex-shrink-0" />
                        <div className="flex-1">
                          <h4 className="font-semibold text-green-800 mb-1">
                            {booking.special_offers.title}
                          </h4>
                          {booking.special_offers.description && (
                            <p className="text-sm text-green-700 mb-2">
                              {booking.special_offers.description}
                            </p>
                          )}
                          {booking.special_offers.discount_percentage && (
                            <Badge variant="secondary" className="bg-green-100 text-green-800">
                              {booking.special_offers.discount_percentage}% OFF
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Preferred Section */}
                {booking.preferred_section && (
                  <div>
                    <Label className="text-sm text-muted-foreground">Preferred Section</Label>
                    <div className="mt-2 flex items-center gap-2">
                      <div className="h-3 w-3 rounded-full bg-primary/20"></div>
                      <Badge variant="outline" className="px-2 py-1 text-sm">
                        {booking.preferred_section}
                      </Badge>
                    </div>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="customer" className="space-y-6 m-0">
                <BookingCustomerDetails 
                  key={`customer-details-${booking.id}`}
                  booking={booking} 
                  restaurantId={booking.restaurant_id}
                  currentUserId={userId}
                />
              </TabsContent>

              <TabsContent value="status" className="space-y-6 m-0">
                {/* Quick Status Selector */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Quick Status Change</CardTitle>
                    <CardDescription>Select a new status directly</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Select 
                      value={currentBookingStatus} 
                      onValueChange={(newStatus) => {
                        const statusOption = allAvailableStatuses.find(s => s.to === newStatus)
                        if (statusOption?.requiresConfirmation) {
                          if (confirm(getStatusConfirmationMessage(newStatus, guestName))) {
                            handleStatusTransition(newStatus)
                          }
                        } else {
                          handleStatusTransition(newStatus)
                        }
                      }}
                      disabled={isUpdatingStatus}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Change status..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={currentBookingStatus} disabled>
                          {formatStatusLabel(currentBookingStatus)} (Current)
                        </SelectItem>
                        {allAvailableStatuses.map(status => (
                          <SelectItem 
                            key={status.to} 
                            value={status.to}
                            className={status.requiresConfirmation ? "text-red-600" : ""}
                          >
                            {formatStatusLabel(status.to)}
                            {status.requiresConfirmation && " ⚠️"}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </CardContent>
                </Card>

                {/* Current Status Overview */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Current Status</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <StatusIcon className={cn("h-8 w-8", statusConfig?.color)} />
                        <div>
                          <p className="font-semibold text-lg">
                            {formatStatusLabel(currentBookingStatus)}
                          </p>
                          {isCurrentlyDining && (
                            <p className="text-sm text-muted-foreground">
                              Dining for {Math.floor(elapsedMinutes / 60)}h {elapsedMinutes % 60}m
                            </p>
                          )}
                        </div>
                      </div>
                      <Badge variant="outline" className="text-lg px-3 py-1">
                        {currentProgress}%
                      </Badge>
                    </div>

                    <Progress value={currentProgress} className="h-3" />

                    {isCurrentlyDining && (
                      <Alert>
                        <Activity className="h-4 w-4" />
                        <AlertDescription>
                          Guest has been dining for {elapsedMinutes} minutes.
                          Estimated {statusService.estimateRemainingTime(currentBookingStatus as DiningStatus, booking.turn_time_minutes)} minutes remaining.
                        </AlertDescription>
                      </Alert>
                    )}
                  </CardContent>
                </Card>

                {/* Status Transitions */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Update Status</CardTitle>
                    <CardDescription>
                      Quick transitions or jump to any status
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Sequential Transitions (if available) */}
                    {validTransitions.length > 0 && (
                      <div>
                        <Label className="text-sm font-medium text-muted-foreground mb-2 block">
                          Next Steps
                        </Label>
                        <div className="grid grid-cols-2 gap-2">
                          {validTransitions.map(transition => {
                            const ToIcon = STATUS_CONFIGS[transition.to as keyof typeof STATUS_CONFIGS]?.icon || ArrowRight
                            const toConfig = STATUS_CONFIGS[transition.to as keyof typeof STATUS_CONFIGS]
                            
                            return (
                              <Button
                                key={`next-${transition.to}`}
                                variant="default"
                                size="sm"
                                className={cn(
                                  "justify-start",
                                  transition.requiresConfirmation && "bg-red-500 hover:bg-red-600"
                                )}
                                disabled={isUpdatingStatus}
                                onClick={() => {
                                  if (transition.requiresConfirmation) {
                                    if (confirm(getStatusConfirmationMessage(transition.to, guestName))) {
                                      handleStatusTransition(transition.to)
                                    }
                                  } else {
                                    handleStatusTransition(transition.to)
                                  }
                                }}
                              >
                                <ToIcon className="h-4 w-4 mr-2" />
                                {transition.label}
                              </Button>
                            )
                          })}
                        </div>
                      </div>
                    )}

                    {/* All Available Statuses */}
                    <div>
                      <Label className="text-sm font-medium text-muted-foreground mb-2 block">
                        Jump to Any Status
                      </Label>
                      <div className="grid grid-cols-2 gap-2">
                        {allAvailableStatuses.map(status => {
                          const ToIcon = STATUS_CONFIGS[status.to as keyof typeof STATUS_CONFIGS]?.icon || ArrowRight
                          const toConfig = STATUS_CONFIGS[status.to as keyof typeof STATUS_CONFIGS]
                          
                          return (
                            <Button
                              key={`all-${status.to}`}
                              variant="outline"
                              size="sm"
                              className={cn(
                                "justify-start text-xs h-auto py-2 px-3",
                                status.requiresConfirmation && "border-red-200 text-red-600 hover:bg-red-50"
                              )}
                              disabled={isUpdatingStatus}
                              onClick={() => {
                                if (status.requiresConfirmation) {
                                  if (confirm(getStatusConfirmationMessage(status.to, guestName))) {
                                    handleStatusTransition(status.to)
                                  }
                                } else {
                                  handleStatusTransition(status.to)
                                }
                              }}
                            >
                              <ToIcon className={cn("h-3 w-3 mr-1 flex-shrink-0", toConfig?.color)} />
                              <span className="truncate">{formatStatusLabel(status.to)}</span>
                            </Button>
                          )
                        })}
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Quick Actions */}
                {booking.tables && booking.tables.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Quick Actions</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <Button
                        variant="outline"
                        className="w-full justify-start"
                        onClick={() => {
                          // Open table switch dialog
                          setActiveTab("details")
                          setIsEditing(true)
                        }}
                      >
                        <Table2 className="h-4 w-4 mr-2" />
                        Switch Tables
                      </Button>
                      {currentBookingStatus === 'confirmed' && (
                        <Button
                          variant="outline"
                          className="w-full justify-start"
                          disabled={isUpdatingStatus}
                          onClick={() => handleStatusTransition('arrived')}
                        >
                          <UserCheck className="h-4 w-4 mr-2" />
                          Check In Guest
                        </Button>
                      )}
                      {['main_course', 'dessert'].includes(currentBookingStatus) && (
                        <Button
                          variant="outline"
                          className="w-full justify-start"
                          disabled={isUpdatingStatus}
                          onClick={() => handleStatusTransition('payment')}
                        >
                          <CreditCard className="h-4 w-4 mr-2" />
                          Request Bill
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                )}
              </TabsContent>

              <TabsContent value="history" className="space-y-6 m-0">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Status History</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {statusHistory && statusHistory.length > 0 ? (
                      <div className="space-y-3">
                        {statusHistory.map((entry) => {
                          const entryConfig = STATUS_CONFIGS[entry.new_status as keyof typeof STATUS_CONFIGS]
                          const EntryIcon = entryConfig?.icon || History
                          
                          return (
                            <div key={entry.id} className="flex items-start gap-3">
                              <div className={cn(
                                "p-2 rounded-full flex-shrink-0",
                                entryConfig?.bg
                              )}>
                                <EntryIcon className={cn("h-4 w-4", entryConfig?.color)} />
                              </div>
                              <div className="flex-1 space-y-1">
                                <p className="font-medium">
                                  {entry.old_status ? (
                                    <>
                                      {formatStatusLabel(entry.old_status)} → {formatStatusLabel(entry.new_status)}
                                    </>
                                  ) : (
                                    <span>{formatStatusLabel(entry.new_status)}</span>
                                  )}
                                </p>
                                <p className="text-sm text-muted-foreground">
                                  {format(new Date(entry.changed_at), "MMM d, h:mm a")}
                                  {entry.changed_by_user && (
                                    <> by {entry.changed_by_user.full_name}</>
                                  )}
                                </p>
                                {entry.reason && (
                                  <p className="text-sm text-muted-foreground italic">
                                    {entry.reason}
                                  </p>
                                )}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    ) : (
                      <p className="text-center text-muted-foreground py-4">
                        No status history available
                      </p>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </div>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>

    {/* Capacity Warning Dialog */}
    <Dialog open={showCapacityWarning} onOpenChange={setShowCapacityWarning}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-orange-500" />
            Table Capacity Warning
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-sm whitespace-pre-line">{capacityWarningMessage}</p>
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowCapacityWarning(false)}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={() => {
                setShowCapacityWarning(false)
                updateBookingMutation.mutate(true) // Force update with forceUpdate=true
              }}
            >
              Proceed Anyway
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
    </>
  )
}