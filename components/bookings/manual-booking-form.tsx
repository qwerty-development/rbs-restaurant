// components/bookings/manual-booking-form.tsx
"use client"

import { useState, useEffect, JSXElementConstructor, Key, ReactElement, ReactNode, ReactPortal } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { format, addMinutes } from "date-fns"
import { createClient } from "@/lib/supabase/client"
import { useQuery } from "@tanstack/react-query"
import { TableAvailabilityService } from "@/lib/table-availability"
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
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { 
  CalendarIcon, 
  Clock, 
  AlertCircle, 
  Table2,
  RefreshCw,
  Users
} from "lucide-react"
import { toast } from "react-hot-toast"
import { ScrollArea } from "@/components/ui/scroll-area"

const formSchema = z.object({
  guest_name: z.string().min(2, "Name is required"),
  guest_email: z.string().email().optional().or(z.literal("")),
  guest_phone: z.string().min(10, "Phone number is required"),
  booking_date: z.date(),
  booking_time: z.string(),
  party_size: z.number().min(1).max(20),
  turn_time_minutes: z.number().min(30).max(240),
  special_requests: z.string().optional(),
  occasion: z.string().optional(),
  table_ids: z.array(z.string()).optional(),
  status: z.enum(["pending", "confirmed", "completed"]),
})

type FormData = z.infer<typeof formSchema>

interface ManualBookingFormProps {
  restaurantId: string
  onSubmit: (data: any) => void
  onCancel: () => void
  isLoading: boolean
}

export function ManualBookingForm({
  restaurantId,
  onSubmit,
  onCancel,
  isLoading
}: ManualBookingFormProps) {
  const [selectedTables, setSelectedTables] = useState<string[]>([])
  const [checkingAvailability, setCheckingAvailability] = useState(false)
  const supabase = createClient()
  const tableService = new TableAvailabilityService()

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
  } = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      party_size: 2,
      turn_time_minutes: 120,
      status: "confirmed",
      booking_date: new Date(),
      booking_time: format(new Date(), "HH:mm"),
    },
  })

  const bookingDate = watch("booking_date")
  const bookingTime = watch("booking_time")
  const partySize = watch("party_size")
  const turnTime = watch("turn_time_minutes")

  // Fetch all tables
  const { data: allTables } = useQuery({
    queryKey: ["restaurant-tables", restaurantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("restaurant_tables")
        .select("*")
        .eq("restaurant_id", restaurantId)
        .eq("is_active", true)
        .order("table_number")

      if (error) throw error
      return data
    },
  })

  // Check availability when date/time/tables change
  const { data: availability, refetch: checkAvailability } = useQuery({
    queryKey: [
      "manual-booking-availability",
      bookingDate,
      bookingTime,
      selectedTables,
      turnTime
    ],
    queryFn: async () => {
      if (!bookingDate || !bookingTime || selectedTables.length === 0) return null

      const [hours, minutes] = bookingTime.split(":")
      const bookingDateTime = new Date(bookingDate)
      bookingDateTime.setHours(parseInt(hours), parseInt(minutes))

      return await tableService.checkTableAvailability(
        restaurantId,
        selectedTables,
        bookingDateTime,
        turnTime
      )
    },
    enabled: selectedTables.length > 0,
  })

  // Auto-suggest optimal tables
  const suggestTables = async () => {
    if (!bookingDate || !bookingTime) {
      toast.error("Please select date and time first")
      return
    }

    setCheckingAvailability(true)
    try {
      const [hours, minutes] = bookingTime.split(":")
      const bookingDateTime = new Date(bookingDate)
      bookingDateTime.setHours(parseInt(hours), parseInt(minutes))

      const optimal = await tableService.getOptimalTableAssignment(
        restaurantId,
        bookingDateTime,
        partySize,
        turnTime
      )

      if (optimal) {
        setSelectedTables(optimal.tableIds)
        toast.success(
          optimal.requiresCombination
            ? `Found ${optimal.tableIds.length} tables that can be combined`
            : "Found optimal table"
        )
      } else {
        toast.error("No available tables for this time slot")
      }
    } catch (error) {
      console.error("Error suggesting tables:", error)
      toast.error("Failed to find available tables")
    } finally {
      setCheckingAvailability(false)
    }
  }

  // Get available tables for the time slot
  const { data: availableTablesData } = useQuery({
    queryKey: [
      "available-tables-slot",
      bookingDate,
      bookingTime,
      partySize,
      turnTime
    ],
    queryFn: async () => {
      if (!bookingDate || !bookingTime) return null

      const [hours, minutes] = bookingTime.split(":")
      const bookingDateTime = new Date(bookingDate)
      bookingDateTime.setHours(parseInt(hours), parseInt(minutes))

      return await tableService.getAvailableTablesForSlot(
        restaurantId,
        bookingDateTime,
        partySize,
        turnTime
      )
    },
    enabled: !!bookingDate && !!bookingTime,
  })

  const handleFormSubmit = (data: FormData) => {
    // Validate table selection
    if (selectedTables.length === 0) {
      toast.error("Please select at least one table")
      return
    }

    // Check if there are conflicts
    if (availability && !availability.available) {
      toast.error("Selected tables have conflicts. Please choose different tables or time.")
      return
    }

    // Validate capacity
    const selectedTableObjects = allTables?.filter(t => selectedTables.includes(t.id)) || []
    const capacityCheck = tableService.validateCapacity(selectedTableObjects, data.party_size)
    
    if (!capacityCheck.valid) {
      toast.error(capacityCheck.message || "Invalid table selection")
      return
    }

    const [hours, minutes] = data.booking_time.split(":")
    const bookingDateTime = new Date(data.booking_date)
    bookingDateTime.setHours(parseInt(hours), parseInt(minutes))

    onSubmit({
      ...data,
      booking_time: bookingDateTime.toISOString(),
      table_ids: selectedTables,
    })
  }

  const handleTableToggle = (tableId: string) => {
    setSelectedTables(prev => {
      if (prev.includes(tableId)) {
        return prev.filter(id => id !== tableId)
      } else {
        return [...prev, tableId]
      }
    })
  }

  // Calculate total capacity
  const selectedTablesCapacity = allTables
    ?.filter(t => selectedTables.includes(t.id))
    .reduce((sum, t) => sum + t.capacity, 0) || 0

  // Determine which tables are available
  const getTableAvailability = (tableId: string) => {
    if (!availableTablesData) return true
    
    const isInSingleTables = availableTablesData.singleTables.some(t => t.id === tableId)
    const isInCombinations = availableTablesData.combinations.some(c => 
      c.tables.includes(tableId)
    )
    
    return isInSingleTables || isInCombinations
  }

  return (
    <ScrollArea className="h-[80vh] pr-4">
      <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6">
        {/* Guest Information */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Guest Information</h3>
        
        <div>
          <Label htmlFor="guest_name">Guest Name *</Label>
          <Input
            id="guest_name"
            {...register("guest_name")}
            disabled={isLoading}
          />
          {errors.guest_name && (
            <p className="text-sm text-red-600 mt-1">{errors.guest_name.message}</p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="guest_phone">Phone Number *</Label>
            <Input
              id="guest_phone"
              type="tel"
              {...register("guest_phone")}
              disabled={isLoading}
            />
            {errors.guest_phone && (
              <p className="text-sm text-red-600 mt-1">{errors.guest_phone.message}</p>
            )}
          </div>

          <div>
            <Label htmlFor="guest_email">Email (Optional)</Label>
            <Input
              id="guest_email"
              type="email"
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
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Booking Details</h3>
        
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Date *</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant={"outline"}
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !bookingDate && "text-muted-foreground"
                  )}
                  disabled={isLoading}
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
                  initialFocus
                  disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                />
              </PopoverContent>
            </Popover>
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
                disabled={isLoading}
              />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <Label htmlFor="party_size">Party Size *</Label>
            <div className="relative">
              <Users className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="party_size"
                type="number"
                min="1"
                max="20"
                {...register("party_size", { valueAsNumber: true })}
                className="pl-10"
                disabled={isLoading}
              />
            </div>
          </div>

          <div>
            <Label htmlFor="turn_time_minutes">Turn Time</Label>
            <Select
              value={turnTime.toString()}
              onValueChange={(value) => setValue("turn_time_minutes", parseInt(value))}
              disabled={isLoading}
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
                <SelectItem value="completed">Completed</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Table Assignment */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold">Table Assignment</h3>
            <p className="text-sm text-muted-foreground">
              Select tables for {partySize} guests 
              (Selected capacity: {selectedTablesCapacity})
            </p>
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={suggestTables}
            disabled={checkingAvailability || isLoading}
          >
            <RefreshCw className={`h-4 w-4 mr-1 ${checkingAvailability ? 'animate-spin' : ''}`} />
            Auto-suggest
          </Button>
        </div>

        {/* Show conflicts if any */}
        {availability && !availability.available && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Selected tables have conflicts at this time:
              <ul className="mt-2 text-sm">
                {availability.conflicts.map((conflict: any) => (
                  <li key={conflict.id}>
                    • {conflict.guestName} - {format(new Date(conflict.booking_time), "h:mm a")}
                    ({conflict.party_size} guests)
                  </li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        )}

        {/* Capacity warning */}
        {selectedTablesCapacity > 0 && selectedTablesCapacity < partySize && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Selected tables only have capacity for {selectedTablesCapacity} guests, 
              but you need seating for {partySize} guests.
            </AlertDescription>
          </Alert>
        )}
        
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {allTables?.map((table) => {
            const isSelected = selectedTables.includes(table.id)
            const isAvailable = getTableAvailability(table.id)
            const availabilityInfo = availability?.tables.find(t => t.tableId === table.id)

            return (
              <label
                key={table.id}
                className={cn(
                  "flex items-center p-3 border rounded-lg cursor-pointer transition-colors",
                  isSelected && "bg-primary/10 border-primary",
                  !isSelected && "hover:bg-muted",
                  !isAvailable && !isSelected && "opacity-50 cursor-not-allowed"
                )}
              >
                <Checkbox
                  checked={isSelected}
                  onCheckedChange={() => handleTableToggle(table.id)}
                  disabled={isLoading || (!isAvailable && !isSelected)}
                  className="mr-3"
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <Table2 className="h-4 w-4" />
                    <span className="font-medium">{table.table_number}</span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {table.capacity} seats • {table.table_type}
                  </p>
                  {table.features && table.features.length > 0 && (
                    <div className="flex gap-1 mt-1">
                      {table.features.slice(0, 2).map((feature: string | number | bigint | boolean | ReactElement<unknown, string | JSXElementConstructor<any>> | Iterable<ReactNode> | ReactPortal | Promise<string | number | bigint | boolean | ReactPortal | ReactElement<unknown, string | JSXElementConstructor<any>> | Iterable<ReactNode> | null | undefined> | null | undefined, idx: Key | null | undefined) => (
                        <Badge key={idx} variant="outline" className="text-xs">
                          {feature}
                        </Badge>
                      ))}
                    </div>
                  )}
                  {availabilityInfo && !availabilityInfo.isAvailable && (
                    <p className="text-xs text-red-600 mt-1">
                      Booked at this time
                    </p>
                  )}
                </div>
              </label>
            )
          })}
        </div>

        {/* Show suggested combinations if no single table works */}
        {availableTablesData?.combinations && 
         availableTablesData.combinations.length > 0 &&
         availableTablesData.singleTables.length === 0 && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              No single table available for {partySize} guests. 
              Consider combining tables using auto-suggest.
            </AlertDescription>
          </Alert>
        )}
      </div>

      {/* Additional Information */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Additional Information</h3>
        
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
          <Label htmlFor="special_requests">Special Requests</Label>
          <Textarea
            id="special_requests"
            placeholder="Any special requirements or requests..."
            {...register("special_requests")}
            disabled={isLoading}
          />
        </div>
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-2 pt-4">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={isLoading}
        >
          Cancel
        </Button>
        <Button 
          type="submit" 
          disabled={
            isLoading || 
            selectedTables.length === 0 ||
            (availability && !availability.available) ||
            (selectedTablesCapacity > 0 && selectedTablesCapacity < partySize)
          }
        >
          {isLoading ? "Creating..." : "Create Booking"}
        </Button>
      </div>
    </form>
    </ScrollArea>
  )
}