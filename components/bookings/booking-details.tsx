// components/bookings/booking-details.tsx
"use client"

import { useState } from "react"
import { format } from "date-fns"
import { createClient } from "@/lib/supabase/client"
import { useQuery } from "@tanstack/react-query"
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
  X
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
  
  const supabase = createClient()

  // Fetch available tables
  const { data: availableTables } = useQuery({
    queryKey: ["available-tables", booking.restaurant_id, booking.booking_time],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("restaurant_tables")
        .select("*")
        .eq("restaurant_id", booking.restaurant_id)
        .eq("is_active", true)

      if (error) throw error
      return data
    },
  })

  const handleSave = () => {
    onUpdate(editedData)
    setIsEditing(false)
  }

  const bookingDate = new Date(booking.booking_time)
  const displayName = booking.user?.full_name || booking.guest_name || "Guest"
  const displayPhone = booking.user?.phone_number || booking.guest_phone || "-"
  const displayEmail = booking.user?.email || booking.guest_email || "-"

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle>Booking Details</DialogTitle>
            <div className="flex gap-2">
              {isEditing ? (
                <>
                  <Button size="sm" onClick={handleSave}>
                    <Save className="h-4 w-4 mr-1" />
                    Save
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setIsEditing(false)}>
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
                <p className="font-medium">{format(bookingDate, "p")}</p>
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
                  <Input
                    type="number"
                    min="30"
                    max="240"
                    step="15"
                    value={editedData.turn_time_minutes}
                    onChange={(e) => setEditedData({
                      ...editedData,
                      turn_time_minutes: parseInt(e.target.value)
                    })}
                  />
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
            <div>
              <Label>Assigned Tables</Label>
              {booking.tables && booking.tables.length > 0 ? (
                <div className="grid grid-cols-3 gap-2 mt-2">
                  {booking.tables.map((table) => (
                    <div
                      key={table.id}
                      className="p-3 border rounded-lg text-center"
                    >
                      <p className="font-medium">{table.table_number}</p>
                      <p className="text-sm text-muted-foreground">
                        Capacity: {table.capacity}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground mt-2">No tables assigned</p>
              )}
            </div>

            {isEditing && (
              <div>
                <Label>Available Tables</Label>
                <div className="grid grid-cols-4 gap-2 mt-2">
                  {availableTables?.map((table) => (
                    <label
                      key={table.id}
                      className="flex items-center justify-center p-2 border rounded cursor-pointer hover:bg-muted"
                    >
                      <input
                        type="checkbox"
                        className="sr-only"
                        // Add table assignment logic here
                      />
                      <span className="text-sm">
                        {table.table_number} ({table.capacity})
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}