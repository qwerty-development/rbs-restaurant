"use client"

import { useState } from "react"
import { useRouter, useParams } from "next/navigation"
import { useEvent, useUpdateEvent, useCreateEventOccurrence, useDeleteEvent, useEventBookings } from "@/lib/hooks/use-events"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  ArrowLeft,
  Calendar,
  Clock,
  Users,
  Plus,
  Edit,
  Trash2,
  AlertCircle,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  Mail,
  Phone,
  MessageSquare,
  Gift,
  User,
  Filter,
} from "lucide-react"
import { format } from "date-fns"
import { toast } from "sonner"
import type { CreateEventOccurrenceInput } from "@/types/events"
import { formatEventDateTime, getEventStatusColor, getCapacityPercentage } from "@/types/events"

export default function EventDetailsPage() {
  const router = useRouter()
  const params = useParams()
  const eventId = params?.id as string

  const { data: event, isLoading } = useEvent(eventId)
  const { data: bookings = [], isLoading: bookingsLoading } = useEventBookings(eventId)
  const updateEvent = useUpdateEvent()
  const createOccurrence = useCreateEventOccurrence()
  const deleteEvent = useDeleteEvent()

  const [showAddOccurrence, setShowAddOccurrence] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [bookingStatusFilter, setBookingStatusFilter] = useState<string>("all")
  const [expandedOccurrences, setExpandedOccurrences] = useState<Set<string>>(new Set())
  const [occurrenceForm, setOccurrenceForm] = useState<CreateEventOccurrenceInput>({
    event_id: eventId,
    occurrence_date: "",
    start_time: "",
    end_time: "",
    max_capacity: null,
    special_notes: "",
  })

  const handleToggleActive = async () => {
    if (!event) return

    try {
      await updateEvent.mutateAsync({
        eventId: event.id,
        updates: { is_active: !event.is_active }
      })
      toast.success(event.is_active ? "Event deactivated" : "Event activated")
    } catch (error) {
      console.error("Error toggling event status:", error)
    }
  }

  const handleAddOccurrence = async () => {
    if (!occurrenceForm.occurrence_date) {
      toast.error("Please select a date")
      return
    }

    try {
      await createOccurrence.mutateAsync(occurrenceForm)
      setShowAddOccurrence(false)
      setOccurrenceForm({
        event_id: eventId,
        occurrence_date: "",
        start_time: "",
        end_time: "",
        max_capacity: null,
        special_notes: "",
      })
    } catch (error) {
      console.error("Error creating occurrence:", error)
    }
  }

  const handleDeleteEvent = async () => {
    try {
      await deleteEvent.mutateAsync(eventId)
      toast.success("Event deleted successfully")
      router.push("/events")
    } catch (error) {
      console.error("Error deleting event:", error)
    }
  }

  const toggleOccurrence = (occurrenceId: string) => {
    setExpandedOccurrences(prev => {
      const newSet = new Set(prev)
      if (newSet.has(occurrenceId)) {
        newSet.delete(occurrenceId)
      } else {
        newSet.add(occurrenceId)
      }
      return newSet
    })
  }

  // Get bookings for a specific occurrence
  const getOccurrenceBookings = (occurrenceId: string) => {
    return bookings.filter(booking => 
      booking.event_occurrence_id === occurrenceId &&
      (bookingStatusFilter === "all" || booking.status === bookingStatusFilter)
    )
  }

  // Get status badge variant
  const getStatusBadgeVariant = (status: string): "default" | "secondary" | "destructive" | "outline" => {
    switch (status) {
      case "pending": return "secondary"
      case "confirmed": return "default"
      case "cancelled_by_user":
      case "cancelled_by_restaurant":
      case "declined_by_restaurant":
        return "destructive"
      case "completed": return "default"
      default: return "outline"
    }
  }

  // Format status label
  const formatStatus = (status: string) => {
    const statusMap: Record<string, string> = {
      pending: "Pending",
      confirmed: "Confirmed",
      cancelled_by_user: "Cancelled",
      cancelled_by_restaurant: "Cancelled",
      declined_by_restaurant: "Declined",
      completed: "Completed",
      no_show: "No Show"
    }
    return statusMap[status] || status
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-16 w-16 border-4 border-border" />
      </div>
    )
  }

  if (!event) {
    return (
      <div className="flex flex-col items-center justify-center h-screen">
        <h2 className="text-2xl font-bold mb-2">Event Not Found</h2>
        <p className="text-muted-foreground mb-4">
          The event you're looking for doesn't exist
        </p>
        <Button onClick={() => router.push("/events")}>
          Back to Events
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div>
        <Button
          variant="ghost"
          onClick={() => router.back()}
          className="mb-4"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>

        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-3xl font-bold tracking-tight">{event.title}</h1>
              <Badge variant="default">
                {event.is_active ? "Active" : "Inactive"}
              </Badge>
            </div>
            {event.description && (
              <p className="text-muted-foreground">{event.description}</p>
            )}
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={handleToggleActive}
              disabled={updateEvent.isPending}
            >
              {event.is_active ? "Deactivate" : "Activate"}
            </Button>
            <Button
              variant="outline"
              onClick={() => router.push(`/events/${event.id}/edit`)}
            >
              <Edit className="h-4 w-4 mr-2" />
              Edit
            </Button>
            <Button
              variant="destructive"
              onClick={() => setShowDeleteDialog(true)}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete
            </Button>
          </div>
        </div>
      </div>

      {/* Event Image */}
      {event.image_url && (
        <Card>
          <CardContent className="p-0">
            <img
              src={event.image_url}
              alt={event.title}
              className="w-full h-64 object-cover rounded-lg"
            />
          </CardContent>
        </Card>
      )}

      {/* Event Details */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Event Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {event.event_type && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Type:</span>
                <span className="font-medium capitalize">{event.event_type.replace('_', ' ')}</span>
              </div>
            )}
            {event.minimum_age && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Minimum Age:</span>
                <span className="font-medium">{event.minimum_age}+</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-muted-foreground">Party Size:</span>
              <span className="font-medium">
                {event.minimum_party_size}
                {event.maximum_party_size && ` - ${event.maximum_party_size}`}
              </span>
            </div>
            {event.special_requirements && (
              <div>
                <span className="text-muted-foreground block mb-1">Requirements:</span>
                <p className="text-sm">{event.special_requirements}</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Statistics</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Total Occurrences:</span>
              <span className="font-medium">{event.occurrences?.length || 0}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Upcoming:</span>
              <span className="font-medium">
                {event.occurrences?.filter(o => o.status === 'scheduled' || o.status === 'full').length || 0}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Total Bookings:</span>
              <span className="font-medium">
                {event.occurrences?.reduce((acc, o) => acc + o.current_bookings, 0) || 0}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Event Occurrences with Bookings */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div className="flex-1">
            <CardTitle>Event Dates & Bookings</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              View bookings for each event occurrence
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Select value={bookingStatusFilter} onValueChange={setBookingStatusFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Filter bookings" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Bookings</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="confirmed">Confirmed</SelectItem>
                <SelectItem value="cancelled_by_user">Cancelled</SelectItem>
                <SelectItem value="declined_by_restaurant">Declined</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
              </SelectContent>
            </Select>
            <Button
              onClick={() => setShowAddOccurrence(true)}
              size="sm"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Date
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {event.occurrences && event.occurrences.length > 0 ? (
            <div className="space-y-4">
              {event.occurrences.map((occurrence) => {
                const occurrenceBookings = getOccurrenceBookings(occurrence.id)
                const isExpanded = expandedOccurrences.has(occurrence.id)
                
                return (
                  <Collapsible 
                    key={occurrence.id}
                    open={isExpanded}
                    onOpenChange={() => toggleOccurrence(occurrence.id)}
                  >
                    <Card className="overflow-hidden">
                      <CollapsibleTrigger className="w-full">
                        <div className="p-4 hover:bg-muted/50 transition-colors">
                          <div className="flex items-start justify-between">
                            <div className="space-y-2 flex-1">
                              <div className="flex items-center gap-3">
                                <Calendar className="h-5 w-5 text-muted-foreground" />
                                <div className="text-left">
                                  <p className="font-medium">
                                    {format(new Date(occurrence.occurrence_date), 'EEEE, MMMM d, yyyy')}
                                  </p>
                                  {(occurrence.start_time || occurrence.end_time) && (
                                    <p className="text-sm text-muted-foreground">
                                      {occurrence.start_time}
                                      {occurrence.end_time && ` - ${occurrence.end_time}`}
                                    </p>
                                  )}
                                </div>
                              </div>

                              <div className="flex items-center gap-4 ml-8">
                                {occurrence.max_capacity && (
                                  <div className="flex items-center gap-2">
                                    <Users className="h-4 w-4 text-muted-foreground" />
                                    <span className="text-sm font-medium">
                                      {occurrence.current_bookings} / {occurrence.max_capacity}
                                    </span>
                                    <div className="w-24 h-2 bg-muted rounded-full overflow-hidden">
                                      <div
                                        className={`h-full ${getEventStatusColor(occurrence.status)}`}
                                        style={{ width: `${getCapacityPercentage(occurrence)}%` }}
                                      />
                                    </div>
                                  </div>
                                )}
                                
                                <div className="flex items-center gap-2">
                                  <CheckCircle className="h-4 w-4 text-muted-foreground" />
                                  <span className="text-sm font-medium">
                                    {occurrenceBookings.length} booking{occurrenceBookings.length !== 1 ? 's' : ''}
                                  </span>
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-2">
                              <Badge
                                variant={occurrence.status === 'scheduled' ? 'default' : 'secondary'}
                                className={occurrence.status === 'full' ? 'bg-yellow-500' : occurrence.status === 'scheduled' ? 'bg-green-500' : ''}
                              >
                                {occurrence.status}
                              </Badge>
                              {isExpanded ? (
                                <ChevronUp className="h-5 w-5 text-muted-foreground" />
                              ) : (
                                <ChevronDown className="h-5 w-5 text-muted-foreground" />
                              )}
                            </div>
                          </div>
                        </div>
                      </CollapsibleTrigger>

                      <CollapsibleContent>
                        <div className="border-t bg-muted/30 p-4">
                          {bookingsLoading ? (
                            <div className="flex items-center justify-center py-8">
                              <div className="animate-spin rounded-full h-8 w-8 border-4 border-border" />
                            </div>
                          ) : occurrenceBookings.length > 0 ? (
                            <div className="space-y-3">
                              <h4 className="font-semibold text-sm text-muted-foreground mb-3">
                                Bookings for this date:
                              </h4>
                              {occurrenceBookings.map((booking) => {
                                const customer = Array.isArray(booking.profiles)
                                  ? booking.profiles[0]
                                  : booking.profiles
                                const guestName = booking.guest_name || customer?.full_name || "Unknown"
                                const guestEmail = booking.guest_email || customer?.email
                                const guestPhone = booking.guest_phone || customer?.phone_number

                                return (
                                  <Card key={booking.id} className="p-3 bg-background">
                                    <div className="flex items-start justify-between gap-3">
                                      <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-2">
                                          <User className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                                          <span className="font-semibold truncate">{guestName}</span>
                                          <Badge 
                                            variant={getStatusBadgeVariant(booking.status)}
                                            className="text-xs"
                                          >
                                            {formatStatus(booking.status)}
                                          </Badge>
                                        </div>

                                        <div className="space-y-1 text-sm text-muted-foreground ml-6">
                                          {guestPhone && (
                                            <div className="flex items-center gap-2">
                                              <Phone className="h-3 w-3" />
                                              <span>{guestPhone}</span>
                                            </div>
                                          )}
                                          {guestEmail && (
                                            <div className="flex items-center gap-2">
                                              <Mail className="h-3 w-3" />
                                              <span className="truncate">{guestEmail}</span>
                                            </div>
                                          )}
                                          <div className="flex items-center gap-2">
                                            <Users className="h-3 w-3" />
                                            <span>{booking.party_size} guest{booking.party_size !== 1 ? 's' : ''}</span>
                                          </div>
                                          {booking.confirmation_code && (
                                            <div className="flex items-center gap-2">
                                              <AlertCircle className="h-3 w-3" />
                                              <span className="font-mono">#{booking.confirmation_code}</span>
                                            </div>
                                          )}
                                        </div>

                                        {booking.special_requests && (
                                          <div className="mt-2 p-2 bg-muted/50 rounded text-xs">
                                            <div className="flex items-start gap-2">
                                              <MessageSquare className="h-3 w-3 text-muted-foreground mt-0.5 flex-shrink-0" />
                                              <span className="text-muted-foreground">
                                                {booking.special_requests}
                                              </span>
                                            </div>
                                          </div>
                                        )}

                                        {booking.occasion && (
                                          <div className="mt-2 flex items-center gap-2 text-xs">
                                            <Gift className="h-3 w-3 text-muted-foreground" />
                                            <span className="text-muted-foreground">
                                              Occasion: <span className="font-medium">{booking.occasion}</span>
                                            </span>
                                          </div>
                                        )}
                                      </div>

                                      <div className="text-right text-xs text-muted-foreground">
                                        <div>{format(new Date(booking.created_at), 'MMM d')}</div>
                                        <div>{format(new Date(booking.created_at), 'h:mm a')}</div>
                                      </div>
                                    </div>
                                  </Card>
                                )
                              })}
                            </div>
                          ) : (
                            <div className="text-center py-8">
                              <Users className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                              <p className="text-sm text-muted-foreground">
                                No bookings for this date yet
                              </p>
                            </div>
                          )}
                        </div>
                      </CollapsibleContent>
                    </Card>
                  </Collapsible>
                )
              })}
            </div>
          ) : (
            <div className="text-center py-12">
              <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="font-semibold mb-2">No dates scheduled</h3>
              <p className="text-muted-foreground mb-4">
                Add event dates to make this event bookable
              </p>
              <Button onClick={() => setShowAddOccurrence(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add First Date
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Occurrence Dialog */}
      <Dialog open={showAddOccurrence} onOpenChange={setShowAddOccurrence}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Event Date</DialogTitle>
            <DialogDescription>
              Schedule a new occurrence for this event
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="occurrence_date">Date *</Label>
              <Input
                id="occurrence_date"
                type="date"
                value={occurrenceForm.occurrence_date}
                onChange={(e) =>
                  setOccurrenceForm(prev => ({ ...prev, occurrence_date: e.target.value }))
                }
                min={new Date().toISOString().split('T')[0]}
                required
                className="mt-1.5"
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <Label htmlFor="start_time">Start Time</Label>
                <Input
                  id="start_time"
                  type="time"
                  value={occurrenceForm.start_time || ""}
                  onChange={(e) =>
                    setOccurrenceForm(prev => ({ ...prev, start_time: e.target.value }))
                  }
                  className="mt-1.5"
                />
              </div>

              <div>
                <Label htmlFor="end_time">End Time</Label>
                <Input
                  id="end_time"
                  type="time"
                  value={occurrenceForm.end_time || ""}
                  onChange={(e) =>
                    setOccurrenceForm(prev => ({ ...prev, end_time: e.target.value }))
                  }
                  className="mt-1.5"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="max_capacity">Maximum Capacity</Label>
              <Input
                id="max_capacity"
                type="number"
                min="1"
                value={occurrenceForm.max_capacity || ""}
                onChange={(e) =>
                  setOccurrenceForm(prev => ({
                    ...prev,
                    max_capacity: e.target.value ? parseInt(e.target.value) : null
                  }))
                }
                placeholder="Leave empty for unlimited"
                className="mt-1.5"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowAddOccurrence(false)}
              disabled={createOccurrence.isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={handleAddOccurrence}
              disabled={createOccurrence.isPending}
            >
              {createOccurrence.isPending ? "Adding..." : "Add Date"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Event</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this event? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowDeleteDialog(false)}
              disabled={deleteEvent.isPending}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteEvent}
              disabled={deleteEvent.isPending}
            >
              {deleteEvent.isPending ? "Deleting..." : "Delete Event"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
