// components/basic/basic-manual-booking-form.tsx
"use client"

import { useState, useEffect } from "react"
import { useForm, SubmitHandler } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { format } from "date-fns"
import { createClient } from "@/lib/supabase/client"
import { useQuery } from "@tanstack/react-query"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { cn } from "@/lib/utils"
import { 
  CalendarIcon, 
  Clock, 
  AlertCircle, 
  Users,
  UserCheck,
  MapPin,
  Gift
} from "lucide-react"
import { toast } from "react-hot-toast"

// Simplified form schema for basic restaurants (no tables, no existing customers)
const formSchema = z.object({
  guest_name: z.string().min(1, "Guest name is required"),
  guest_email: z.string().email("Valid email is required").optional().or(z.literal("")),
  guest_phone: z.string().optional(), // Made optional
  booking_date: z.date(),
  booking_time: z.string(),
  party_size: z.number().min(1, "At least 1 guest required").max(50, "Maximum 50 guests"),
  special_requests: z.string().optional(),
  occasion: z.string().optional(),
  assigned_table: z.string().optional(),
  preferred_section: z.string().optional(),
  dietary_notes: z.string().optional(),
  event_occurrence_id: z.string().optional(), // For event bookings
  status: z.enum(["pending", "confirmed"]),
})

type FormData = z.infer<typeof formSchema>

interface BasicManualBookingFormProps {
  restaurantId: string
  onSubmit: (data: any) => void
  onCancel: () => void
  isLoading: boolean
}

export function BasicManualBookingForm({
  restaurantId,
  onSubmit,
  onCancel,
  isLoading,
}: BasicManualBookingFormProps) {
  const supabase = createClient()

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
  } = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      guest_name: "",
      guest_email: "",
      guest_phone: "",
      party_size: 2,
      status: "confirmed",
      booking_date: new Date(),
      booking_time: format(new Date(), "HH:mm"),
      special_requests: "",
      occasion: "",
      assigned_table: "",
      preferred_section: "",
      dietary_notes: "",
      event_occurrence_id: "",
    },
  })

  const bookingDate = watch("booking_date")
  const bookingTime = watch("booking_time")
  const partySize = watch("party_size")
  const selectedEventId = watch("event_occurrence_id")

  // Fetch restaurant sections
  const { data: sections } = useQuery({
    queryKey: ["restaurant-sections", restaurantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("restaurant_sections")
        .select("*")
        .eq("restaurant_id", restaurantId)
        .eq("is_active", true)
        .order("name")

      if (error) throw error
      return data
    },
    enabled: !!restaurantId,
  })

  // Fetch upcoming events for optional event booking
  const { data: upcomingEvents } = useQuery({
    queryKey: ["upcoming-events", restaurantId, bookingDate],
    queryFn: async () => {
      if (!bookingDate) return []

      const { data, error } = await supabase
        .from("event_occurrences")
        .select(`
          id,
          occurrence_date,
          start_time,
          end_time,
          status,
          max_capacity,
          current_bookings,
          event:restaurant_events!event_occurrences_event_id_fkey (
            id,
            title,
            description,
            event_type
          )
        `)
        .eq("status", "scheduled")
        .gte("occurrence_date", bookingDate.toISOString().split("T")[0])
        .order("occurrence_date")
        .order("start_time")
        .limit(10)

      if (error) throw error
      return data || []
    },
    enabled: !!restaurantId && !!bookingDate,
  })

  // Get the selected event details
  const selectedEvent = upcomingEvents?.find(e => e.id === selectedEventId)

  // Update date and time when event is selected
  useEffect(() => {
    if (selectedEvent) {
      // Set date to event's occurrence date
      const eventDate = new Date(selectedEvent.occurrence_date)
      setValue("booking_date", eventDate)
      
      // Set time to event's start time
      setValue("booking_time", selectedEvent.start_time)
    }
  }, [selectedEvent, setValue])

  const handleFormSubmit: SubmitHandler<FormData> = async (data: FormData): Promise<void> => {
    // Validate required fields
    if (!data.guest_name?.trim()) {
      toast.error("Guest name is required")
      return
    }

    // Combine date and time to create booking datetime
    const [hours, minutes] = data.booking_time.split(":")
    const bookingDateTime = new Date(data.booking_date)
    bookingDateTime.setHours(parseInt(hours), parseInt(minutes), 0, 0)

    // Prepare booking data
    const processedData = {
      guest_name: data.guest_name.trim(),
      guest_email: data.guest_email?.trim() || null,
      guest_phone: data.guest_phone?.trim() ? `+961${data.guest_phone.trim()}` : null,
      booking_time: bookingDateTime.toISOString(),
      party_size: data.party_size,
      status: data.status,
      special_requests: data.special_requests?.trim() || null,
      occasion: data.occasion?.trim() || null,
      assigned_table: data.assigned_table?.trim() || null,
      preferred_section: data.preferred_section?.trim() || null,
      dietary_notes: data.dietary_notes?.trim() || null,
      event_occurrence_id: data.event_occurrence_id || null,
      is_event_booking: !!data.event_occurrence_id,
      turn_time_minutes: 120, // Default 2 hours
    }

    onSubmit(processedData)
  }

  return (
    <div className="basic-manual-booking-form max-w-full overflow-x-hidden">
      <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6 max-w-full overflow-x-hidden pb-24">
        
        {/* Guest Information */}
        <div className="space-y-4 rounded-xl border border-slate-200 dark:border-slate-700 p-6 bg-white dark:bg-accent shadow-sm">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-50 flex items-center gap-2">
            <UserCheck className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            Guest Information
          </h3>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Enter the guest's contact details for this booking
          </p>
        
          <div>
            <Label htmlFor="guest_name">Guest Name *</Label>
            <Input
              id="guest_name"
              placeholder="Enter guest's full name"
              {...register("guest_name")}
              disabled={isLoading}
            />
            {errors.guest_name && (
              <p className="text-sm text-red-600 mt-1">{errors.guest_name.message}</p>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="guest_phone">Phone Number (Optional)</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-medium">
                  +961
                </span>
                <Input
                  id="guest_phone"
                  type="tel"
                  placeholder="Enter phone number"
                  {...register("guest_phone")}
                  disabled={isLoading}
                  className="pl-12"
                />
              </div>
              {errors.guest_phone && (
                <p className="text-sm text-red-600 mt-1">{errors.guest_phone.message}</p>
              )}
            </div>

            <div>
              <Label htmlFor="guest_email">Email (Optional)</Label>
              <Input
                id="guest_email"
                type="email"
                placeholder="Enter email address"
                {...register("guest_email")}
                disabled={isLoading}
              />
              {errors.guest_email && (
                <p className="text-sm text-red-600 mt-1">{errors.guest_email.message}</p>
              )}
            </div>
          </div>
        </div>

        {/* Booking Details */}
        <div className="space-y-4 rounded-xl border border-slate-200 dark:border-slate-700 p-6 bg-white dark:bg-accent shadow-sm">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-50 flex items-center gap-2">
            <CalendarIcon className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            Booking Details
          </h3>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label>Date *</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !bookingDate && "text-muted-foreground"
                    )}
                    disabled={isLoading || !!selectedEvent}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {bookingDate ? format(bookingDate, "PPP") : <span>Pick a date</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={bookingDate}
                    onSelect={(date) => date && setValue("booking_date", date)}
                    disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                  />
                </PopoverContent>
              </Popover>
              {selectedEvent && (
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Using event date
                </p>
              )}
            </div>

            <div>
              <Label htmlFor="booking_time">Time *</Label>
              <div className="relative">
                <Clock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="booking_time"
                  type="time"
                  {...register("booking_time")}
                  className="pl-10"
                  disabled={isLoading || !!selectedEvent}
                />
              </div>
              {selectedEvent && (
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Using event time
                </p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="party_size">Party Size *</Label>
              <div className="relative">
                <Users className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="party_size"
                  type="number"
                  min="1"
                  max="50"
                  {...register("party_size", { valueAsNumber: true })}
                  className="pl-10"
                  disabled={isLoading}
                />
              </div>
              {errors.party_size && (
                <p className="text-sm text-red-600 mt-1">{errors.party_size.message}</p>
              )}
            </div>

            <div>
              <Label htmlFor="status">Status</Label>
              <Select
                value={watch("status")}
                onValueChange={(value: any) => setValue("status", value)}
                disabled={isLoading}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="confirmed">Confirmed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Optional Event Selection */}
        {upcomingEvents && upcomingEvents.length > 0 && (
          <div className="space-y-4 rounded-xl border border-purple-200 dark:border-purple-700 p-6 bg-purple-50 dark:bg-purple-950/30 shadow-sm">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-50 flex items-center gap-2">
              <Gift className="h-5 w-5 text-purple-600 dark:text-purple-400" />
              Book for Event (Optional)
            </h3>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Select an event if this booking is for a special restaurant event
            </p>

            <div>
              <Label htmlFor="event_occurrence_id">Select Event</Label>
              <Select
                value={watch("event_occurrence_id") || "none"}
                onValueChange={(value) => setValue("event_occurrence_id", value === "none" ? "" : value)}
                disabled={isLoading}
              >
                <SelectTrigger>
                  <SelectValue placeholder="No event (regular booking)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No event (regular booking)</SelectItem>
                  {upcomingEvents.map((occurrence: any) => {
                    const event = occurrence.event
                    const currentBookings = occurrence.current_bookings || 0
                    const maxCapacity = occurrence.max_capacity || 0
                    const availableSeats = maxCapacity - currentBookings
                    const isFull = maxCapacity > 0 && availableSeats < partySize

                    return (
                      <SelectItem 
                        key={occurrence.id} 
                        value={occurrence.id}
                        disabled={isFull}
                      >
                        {event.title} - {format(new Date(occurrence.occurrence_date), "MMM d")} at {occurrence.start_time}
                        {isFull ? " (Full)" : maxCapacity > 0 ? ` (${availableSeats} seats left)` : ""}
                      </SelectItem>
                    )
                  })}
                </SelectContent>
              </Select>
              {watch("event_occurrence_id") && watch("event_occurrence_id") !== "" && (
                <p className="text-sm text-purple-700 dark:text-purple-300 mt-2 flex items-center gap-1">
                  <AlertCircle className="h-3.5 w-3.5" />
                  This booking will use the event's date and time
                </p>
              )}
            </div>
          </div>
        )}

        {/* Additional Information */}
        <div className="space-y-4 rounded-xl border border-slate-200 dark:border-slate-700 p-6 bg-white dark:bg-accent shadow-sm">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-50 flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            Additional Information (Optional)
          </h3>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="occasion">Occasion</Label>
              <Input
                id="occasion"
                placeholder="Birthday, Anniversary, etc."
                {...register("occasion")}
                disabled={isLoading}
              />
            </div>

            <div>
              <Label htmlFor="assigned_table">Assigned Table</Label>
              <Input
                id="assigned_table"
                placeholder="Table number (e.g., 5, 12, A1)"
                {...register("assigned_table")}
                disabled={isLoading}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {sections && sections.length > 0 && (
              <div>
                <Label htmlFor="preferred_section">
                  <MapPin className="inline h-4 w-4 mr-1" />
                  Preferred Section
                </Label>
                <Select
                  value={watch("preferred_section") || "none"}
                  onValueChange={(value) => setValue("preferred_section", value === "none" ? "" : value)}
                  disabled={isLoading}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="No preference" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No preference</SelectItem>
                    {sections.map((section: any) => (
                      <SelectItem key={section.id} value={section.name}>
                        {section.name}
                        {section.description && ` - ${section.description}`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <div>
            <Label htmlFor="dietary_notes">Dietary Restrictions/Notes</Label>
            <Textarea
              id="dietary_notes"
              placeholder="Allergies, dietary restrictions, etc."
              {...register("dietary_notes")}
              disabled={isLoading}
              rows={2}
            />
          </div>

          <div>
            <Label htmlFor="special_requests">Special Requests</Label>
            <Textarea
              id="special_requests"
              placeholder="Any special requirements or requests..."
              {...register("special_requests")}
              disabled={isLoading}
              rows={3}
            />
          </div>
        </div>

        {/* Info Alert */}
        <Alert className="bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800">
          <AlertCircle className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          <AlertDescription className="text-blue-900 dark:text-blue-100">
            <strong>Basic Tier Booking:</strong> This booking will be created without table assignment. 
            You can manage seating arrangements when the guest arrives.
          </AlertDescription>
        </Alert>

        {/* Actions */}
        <div className="sticky bottom-0  border-t border-slate-200 dark:border-slate-700 pt-4 pb-4 flex justify-end gap-3 shadow-lg">
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={isLoading}
            className="px-6 border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-accent"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={isLoading}
            className="bg-blue-600 hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-700 text-white shadow-md px-8 font-semibold"
          >
            {isLoading ? "Creating..." : "Create Booking"}
          </Button>
        </div>
      </form>
    </div>
  )
}
