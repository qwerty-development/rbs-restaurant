// components/bookings/manual-booking-form.tsx
"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
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
import { cn } from "@/lib/utils"
import { CalendarIcon, Clock } from "lucide-react"

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
      party_size: 2,
      turn_time_minutes: 120,
      status: "confirmed",
      booking_date: new Date(),
      booking_time: format(new Date(), "HH:mm"),
    },
  })

  const bookingDate = watch("booking_date")
  const bookingTime = watch("booking_time")

  // Fetch available tables
  const { data: tables } = useQuery({
    queryKey: ["available-tables", restaurantId],
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

  const handleFormSubmit = (data: FormData) => {
    const [hours, minutes] = data.booking_time.split(":")
    const bookingDateTime = new Date(data.booking_date)
    bookingDateTime.setHours(parseInt(hours), parseInt(minutes))

    onSubmit({
      ...data,
      booking_time: bookingDateTime.toISOString(),
      table_ids: selectedTables,
    })
  }

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4">
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
            <Input
              id="party_size"
              type="number"
              min="1"
              max="20"
              {...register("party_size", { valueAsNumber: true })}
              disabled={isLoading}
            />
          </div>

          <div>
            <Label htmlFor="turn_time_minutes">Turn Time (minutes)</Label>
            <Input
              id="turn_time_minutes"
              type="number"
              min="30"
              max="240"
              step="15"
              {...register("turn_time_minutes", { valueAsNumber: true })}
              disabled={isLoading}
            />
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
        <h3 className="text-lg font-semibold">Table Assignment (Optional)</h3>
        
        <div className="grid grid-cols-4 gap-2">
          {tables?.map((table) => (
            <label
              key={table.id}
              className={cn(
                "flex items-center justify-center p-3 border rounded-lg cursor-pointer hover:bg-muted",
                selectedTables.includes(table.id) && "bg-primary text-primary-foreground"
              )}
            >
              <input
                type="checkbox"
                value={table.id}
                checked={selectedTables.includes(table.id)}
                onChange={(e) => {
                  if (e.target.checked) {
                    setSelectedTables([...selectedTables, table.id])
                  } else {
                    setSelectedTables(selectedTables.filter(id => id !== table.id))
                  }
                }}
                className="sr-only"
                disabled={isLoading}
              />
              <span className="text-sm font-medium">
                {table.table_number} ({table.capacity})
              </span>
            </label>
          ))}
        </div>
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
        <Button type="submit" disabled={isLoading}>
          {isLoading ? "Creating..." : "Create Booking"}
        </Button>
      </div>
    </form>
  )
}