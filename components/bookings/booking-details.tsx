// components/bookings/booking-details.tsx
"use client"

import { useState, useEffect } from "react"
import { format, addMinutes } from "date-fns"
import { createClient } from "@/lib/supabase/client"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { TableAvailabilityService } from "@/lib/table-availability"
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
  RefreshCw
} from "lucide-react"
import type { Booking } from "@/types"

interface BookingDetailsProps {
  booking: Booking
  onClose: () => void
  onUpdate: (updates: Partial<Booking>) => void
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
  
  const supabase = createClient()
  const queryClient = useQueryClient()
  const tableService = new TableAvailabilityService()

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
        booking.id // Exclude current booking from conflict check
      )
    },
    enabled: isEditing && selectedTableIds.length > 0,
  })

  // Update booking with table assignments
  const updateBookingMutation = useMutation({
    mutationFn: async () => {
      const { error: bookingError } = await supabase
        .from("bookings")
        .update({
          ...editedData,
          updated_at: new Date().toISOString()
        })
        .eq("id", booking.id)

      if (bookingError) throw bookingError

      // Update table assignments
      // First, remove existing assignments
      await supabase
        .from("booking_tables")
        .delete()
        .eq("booking_id", booking.id)

      // Then add new assignments
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

      return { ...editedData, tableIds: selectedTableIds }
    },
    onSuccess: (data) => {
      toast.success("Booking updated successfully")
      onUpdate(data)
      setIsEditing(false)
      queryClient.invalidateQueries({ queryKey: ["bookings"] })
    },
    onError: (error) => {
      console.error("Update error:", error)
      toast.error("Failed to update booking")
    },
  })

  const handleSave = async () => {
    // Validate table capacity
    if (selectedTableIds.length > 0 && allTables) {
      const selectedTables = allTables.filter(t => selectedTableIds.includes(t.id))
      const capacityCheck = tableService.validateCapacity(selectedTables, editedData.party_size)
      
      if (!capacityCheck.valid) {
        toast.error(capacityCheck.message || "Invalid table selection")
        return
      }
    }

    // Check availability before saving
    if (tableAvailability && !tableAvailability.available) {
      toast.error("Selected tables have conflicts. Please choose different tables.")
      return
    }

    updateBookingMutation.mutate()
  }

  const handleTableToggle = (tableId: string) => {
    setSelectedTableIds(prev => {
      if (prev.includes(tableId)) {
        return prev.filter(id => id !== tableId)
      } else {
        return [...prev, tableId]
      }
    })
  }

  // Auto-suggest tables
  const suggestOptimalTables = async () => {
    setCheckingAvailability(true)
    try {
      const optimal = await tableService.getOptimalTableAssignment(
        booking.restaurant_id,
        new Date(booking.booking_time),
        editedData.party_size,
        editedData.turn_time_minutes
      )

      if (optimal) {
        setSelectedTableIds(optimal.tableIds)
        toast.success(
          optimal.requiresCombination
            ? "Found table combination for your party"
            : "Found optimal table"
        )
      } else {
        toast.error("No available tables found for this time slot")
      }
    } catch (error) {
      console.error("Error suggesting tables:", error)
      toast.error("Failed to find available tables")
    } finally {
      setCheckingAvailability(false)
    }
  }

  const bookingDate = new Date(booking.booking_time)
  const displayName = booking.user?.full_name || booking.guest_name || "Guest"
  const displayPhone = booking.user?.phone_number || booking.guest_phone || "-"
  const displayEmail = booking.user?.email || booking.guest_email || "-"

  // Calculate total capacity of selected tables
  const selectedTablesCapacity = allTables
    ?.filter(t => selectedTableIds.includes(t.id))
    .reduce((sum, t) => sum + t.capacity, 0) || 0

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle>Booking Details</DialogTitle>
            <div className="flex gap-2">
              {isEditing ? (
                <>
                  <Button 
                    size="sm" 
                    onClick={handleSave}
                    disabled={updateBookingMutation.isPending}
                  >
                    <Save className="h-4 w-4 mr-1" />
                    Save
                  </Button>
                  <Button 
                    size="sm" 
                    variant="outline" 
                    onClick={() => {
                      setIsEditing(false)
                      setSelectedTableIds(booking.tables?.map(t => t.id) || [])
                      setEditedData({
                        party_size: booking.party_size,
                        turn_time_minutes: booking.turn_time_minutes,
                        special_requests: booking.special_requests || "",
                        status: booking.status,
                      })
                    }}
                  >
                    <X className="h-4 w-4 mr-1" />
                    Cancel
                  </Button>
                </>
              ) : (
                <Button size="sm" variant="outline" onClick={() => setIsEditing(true)}>
                  <Edit className="h-4 w-4 mr-1" />
                  Edit
                </Button>
              )}
            </div>
          </div>
        </DialogHeader>

        <Tabs defaultValue="details" className="mt-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="details">Details</TabsTrigger>
            <TabsTrigger value="guest">Guest Info</TabsTrigger>
            <TabsTrigger value="tables">Tables</TabsTrigger>
          </TabsList>

          <TabsContent value="details" className="space-y-4">
            {/* Confirmation Code */}
            <div className="bg-muted p-4 rounded-lg">
              <Label className="text-sm text-muted-foreground">Confirmation Code</Label>
              <p className="font-mono text-lg font-semibold">{booking.confirmation_code}</p>
            </div>

            {/* Date & Time */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Date
                </Label>
                <p className="font-medium">{format(bookingDate, "PPP")}</p>
              </div>
              <div>
                <Label className="flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Time
                </Label>
                <p className="font-medium">
                  {format(bookingDate, "p")} - 
                  {format(addMinutes(bookingDate, booking.turn_time_minutes || 120), "p")}
                </p>
              </div>
            </div>

            {/* Party Size & Turn Time */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Party Size
                </Label>
                {isEditing ? (
                  <Input
                    type="number"
                    min="1"
                    max="20"
                    value={editedData.party_size}
                    onChange={(e) => setEditedData({
                      ...editedData,
                      party_size: parseInt(e.target.value)
                    })}
                  />
                ) : (
                  <p className="font-medium">{booking.party_size} guests</p>
                )}
              </div>
              <div>
                <Label>Turn Time</Label>
                {isEditing ? (
                  <Select
                    value={editedData.turn_time_minutes.toString()}
                    onValueChange={(value) => setEditedData({
                      ...editedData,
                      turn_time_minutes: parseInt(value)
                    })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="60">1 hour</SelectItem>
                      <SelectItem value="90">1.5 hours</SelectItem>
                      <SelectItem value="120">2 hours</SelectItem>
                      <SelectItem value="150">2.5 hours</SelectItem>
                      <SelectItem value="180">3 hours</SelectItem>
                    </SelectContent>
                  </Select>
                ) : (
                  <p className="font-medium">{booking.turn_time_minutes} minutes</p>
                )}
              </div>
            </div>

            {/* Status */}
            <div>
              <Label>Status</Label>
              {isEditing ? (
                <Select
                  value={editedData.status}
                  onValueChange={(value) => setEditedData({
                    ...editedData,
                    status: value as Booking['status']
                  })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="confirmed">Confirmed</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="cancelled_by_user">Cancelled by User</SelectItem>
                    <SelectItem value="declined_by_restaurant">Declined</SelectItem>
                    <SelectItem value="no_show">No Show</SelectItem>
                  </SelectContent>
                </Select>
              ) : (
                <Badge className="mt-2">{booking.status}</Badge>
              )}
            </div>

            {/* Special Requests */}
            <div>
              <Label className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4" />
                Special Requests
              </Label>
              {isEditing ? (
                <Textarea
                  value={editedData.special_requests}
                  onChange={(e) => setEditedData({
                    ...editedData,
                    special_requests: e.target.value
                  })}
                  placeholder="Any special requirements..."
                />
              ) : (
                <p className="text-sm mt-1">{booking.special_requests || "None"}</p>
              )}
            </div>

            {/* Occasion */}
            {booking.occasion && (
              <div>
                <Label className="flex items-center gap-2">
                  <Gift className="h-4 w-4" />
                  Occasion
                </Label>
                <p className="font-medium mt-1">{booking.occasion}</p>
              </div>
            )}
          </TabsContent>

          <TabsContent value="guest" className="space-y-4">
            <div className="space-y-4">
              <div>
                <Label>Name</Label>
                <p className="font-medium">{displayName}</p>
              </div>
              
              <div>
                <Label className="flex items-center gap-2">
                  <Phone className="h-4 w-4" />
                  Phone
                </Label>
                <p className="font-medium">{displayPhone}</p>
              </div>
              
              <div>
                <Label className="flex items-center gap-2">
                  <Mail className="h-4 w-4" />
                  Email
                </Label>
                <p className="font-medium">{displayEmail}</p>
              </div>

              {booking.dietary_notes && booking.dietary_notes.length > 0 && (
                <div>
                  <Label>Dietary Requirements</Label>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {booking.dietary_notes.map((note, index) => (
                      <Badge key={index} variant="secondary">{note}</Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="tables" className="space-y-4">
            {isEditing ? (
              <>
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <Label>Assign Tables</Label>
                    <p className="text-sm text-muted-foreground">
                      Select tables for {editedData.party_size} guests 
                      (Selected capacity: {selectedTablesCapacity})
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={suggestOptimalTables}
                    disabled={checkingAvailability}
                  >
                    <RefreshCw className={`h-4 w-4 mr-1 ${checkingAvailability ? 'animate-spin' : ''}`} />
                    Auto-suggest
                  </Button>
                </div>

                {/* Show availability conflicts */}
                {tableAvailability && !tableAvailability.available && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      Selected tables have conflicts:
                      <ul className="mt-2 text-sm">
                        {tableAvailability.conflicts.map((conflict: any) => (
                          <li key={conflict.id}>
                            • {conflict.guestName} - {format(new Date(conflict.booking_time), "h:mm a")}
                          </li>
                        ))}
                      </ul>
                    </AlertDescription>
                  </Alert>
                )}

                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {allTables?.map((table) => {
                    const isSelected = selectedTableIds.includes(table.id)
                    const isAvailable = !tableAvailability?.tables.find(
                      t => t.tableId === table.id && !t.isAvailable
                    )

                    return (
                      <label
                        key={table.id}
                        className={`
                          flex items-center p-3 border rounded-lg cursor-pointer transition-colors
                          ${isSelected ? 'bg-primary/10 border-primary' : 'hover:bg-muted'}
                          ${!isAvailable && !isSelected ? 'opacity-50 cursor-not-allowed' : ''}
                        `}
                      >
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => handleTableToggle(table.id)}
                          disabled={!isAvailable && !isSelected}
                          className="mr-3"
                        />
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <Table2 className="h-4 w-4" />
                            <span className="font-medium">{table.table_number}</span>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            Capacity: {table.capacity} • {table.table_type}
                          </p>
                          {!isAvailable && !isSelected && (
                            <p className="text-xs text-red-600 mt-1">Unavailable</p>
                          )}
                        </div>
                      </label>
                    )
                  })}
                </div>
              </>
            ) : (
              <div>
                <Label className="flex items-center gap-2 mb-3">
                  <Table2 className="h-4 w-4" />
                  Assigned Tables
                </Label>
                {booking.tables && booking.tables.length > 0 ? (
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {booking.tables.map((table) => (
                      <div
                        key={table.id}
                        className="p-3 border rounded-lg"
                      >
                        <p className="font-medium">{table.table_number}</p>
                        <p className="text-sm text-muted-foreground">
                          Capacity: {table.capacity} • {table.table_type}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      No tables assigned. Click Edit to assign tables.
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}