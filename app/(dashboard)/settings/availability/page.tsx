// app/(dashboard)/settings/availability/page.tsx
"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import * as z from "zod"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { Calendar } from "@/components/ui/calendar"
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { toast } from "react-hot-toast"
import { 
  Clock, 
  Calendar as CalendarIcon,
  Save,
  Plus,
  Trash2,
  ArrowLeft,
  AlertCircle,
  Info
} from "lucide-react"
import { format, addDays } from "date-fns"
import type { Restaurant } from "@/types"

// Regular hours schema
const regularHoursSchema = z.object({
  monday: z.object({
    enabled: z.boolean(),
    openTime: z.string(),
    closeTime: z.string(),
  }),
  tuesday: z.object({
    enabled: z.boolean(),
    openTime: z.string(),
    closeTime: z.string(),
  }),
  wednesday: z.object({
    enabled: z.boolean(),
    openTime: z.string(),
    closeTime: z.string(),
  }),
  thursday: z.object({
    enabled: z.boolean(),
    openTime: z.string(),
    closeTime: z.string(),
  }),
  friday: z.object({
    enabled: z.boolean(),
    openTime: z.string(),
    closeTime: z.string(),
  }),
  saturday: z.object({
    enabled: z.boolean(),
    openTime: z.string(),
    closeTime: z.string(),
  }),
  sunday: z.object({
    enabled: z.boolean(),
    openTime: z.string(),
    closeTime: z.string(),
  }),
})

// Special hours schema
const specialHoursSchema = z.object({
  date: z.date(),
  type: z.enum(["closed", "custom"]),
  openTime: z.string().optional(),
  closeTime: z.string().optional(),
  reason: z.string().optional(),
})

type RegularHoursData = z.infer<typeof regularHoursSchema>
type SpecialHoursData = z.infer<typeof specialHoursSchema>

const DAYS_OF_WEEK = [
  "monday",
  "tuesday", 
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
] as const

export default function AvailabilitySettingsPage() {
  const router = useRouter()
  const supabase = createClient()
  const queryClient = useQueryClient()
  const [isAddingSpecialHours, setIsAddingSpecialHours] = useState(false)
  const [restaurantId, setRestaurantId] = useState<string>("")

  useEffect(() => {
    async function getRestaurantId() {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: staffData } = await supabase
          .from("restaurant_staff")
          .select("restaurant_id")
          .eq("user_id", user.id)
          .single()
        
        if (staffData) {
          setRestaurantId(staffData.restaurant_id)
        }
      }
    }
    getRestaurantId()
  }, [supabase])

  // Fetch restaurant data
  const { data: restaurant, isLoading } = useQuery({
    queryKey: ["restaurant-availability", restaurantId],
    queryFn: async () => {
      if (!restaurantId) return null
      
      const { data, error } = await supabase
        .from("restaurants")
        .select("*, restaurant_hours!inner(*)")
        .eq("id", restaurantId)
        .single()

      if (error) throw error
      return data as Restaurant & { restaurant_hours: any[] }
    },
    enabled: !!restaurantId,
  })

  // Fetch special hours
  const { data: specialHours } = useQuery({
    queryKey: ["special-hours", restaurantId],
    queryFn: async () => {
      if (!restaurantId) return []
      
      const { data, error } = await supabase
        .from("restaurant_special_hours")
        .select("*")
        .eq("restaurant_id", restaurantId)
        .gte("date", new Date().toISOString().split("T")[0])
        .order("date", { ascending: true })

      if (error) throw error
      return data
    },
    enabled: !!restaurantId,
  })

  // Regular hours form
  const regularHoursForm = useForm<RegularHoursData>({
    resolver: zodResolver(regularHoursSchema),
    defaultValues: {
      monday: { enabled: true, openTime: "09:00", closeTime: "22:00" },
      tuesday: { enabled: true, openTime: "09:00", closeTime: "22:00" },
      wednesday: { enabled: true, openTime: "09:00", closeTime: "22:00" },
      thursday: { enabled: true, openTime: "09:00", closeTime: "22:00" },
      friday: { enabled: true, openTime: "09:00", closeTime: "23:00" },
      saturday: { enabled: true, openTime: "09:00", closeTime: "23:00" },
      sunday: { enabled: true, openTime: "09:00", closeTime: "22:00" },
    },
  })

  // Special hours form
  const specialHoursForm = useForm<SpecialHoursData>({
    resolver: zodResolver(specialHoursSchema),
    defaultValues: {
      date: addDays(new Date(), 1),
      type: "closed",
      reason: "",
    },
  })

  // Update form when data loads
  useEffect(() => {
    if (restaurant?.restaurant_hours) {
      const hoursData = restaurant.restaurant_hours.reduce((acc, hour) => {
        acc[hour.day_of_week] = {
          enabled: hour.is_open,
          openTime: hour.open_time || "09:00",
          closeTime: hour.close_time || "22:00",
        }
        return acc
      }, {} as RegularHoursData)
      
      regularHoursForm.reset(hoursData)
    }
  }, [restaurant, regularHoursForm])

  // Update regular hours mutation
  const updateRegularHoursMutation = useMutation({
    mutationFn: async (data: RegularHoursData) => {
      const updates = DAYS_OF_WEEK.map(day => ({
        restaurant_id: restaurantId,
        day_of_week: day,
        is_open: data[day].enabled,
        open_time: data[day].enabled ? data[day].openTime : null,
        close_time: data[day].enabled ? data[day].closeTime : null,
      }))

      for (const update of updates) {
        const { error } = await supabase
          .from("restaurant_hours")
          .upsert(update, {
            onConflict: "restaurant_id,day_of_week",
          })

        if (error) throw error
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["restaurant-availability"] })
      toast.success("Operating hours updated")
    },
    onError: () => {
      toast.error("Failed to update operating hours")
    },
  })

  // Add special hours mutation
  const addSpecialHoursMutation = useMutation({
    mutationFn: async (data: SpecialHoursData) => {
      const specialHour = {
        restaurant_id: restaurantId,
        date: format(data.date, "yyyy-MM-dd"),
        is_closed: data.type === "closed",
        open_time: data.type === "custom" ? data.openTime : null,
        close_time: data.type === "custom" ? data.closeTime : null,
        reason: data.reason,
      }

      const { error } = await supabase
        .from("restaurant_special_hours")
        .insert(specialHour)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["special-hours"] })
      toast.success("Special hours added")
      setIsAddingSpecialHours(false)
      specialHoursForm.reset()
    },
    onError: () => {
      toast.error("Failed to add special hours")
    },
  })

  // Delete special hours mutation
  const deleteSpecialHoursMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("restaurant_special_hours")
        .delete()
        .eq("id", id)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["special-hours"] })
      toast.success("Special hours removed")
    },
    onError: () => {
      toast.error("Failed to remove special hours")
    },
  })

  const watchedType = specialHoursForm.watch("type")

  if (isLoading) {
    return <div className="flex items-center justify-center h-screen">Loading...</div>
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <Button
          variant="ghost"
          className="mb-4"
          onClick={() => router.push("/settings")}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Settings
        </Button>
        <h1 className="text-3xl font-bold tracking-tight">Availability Settings</h1>
        <p className="text-muted-foreground">
          Manage your restaurant's operating hours and special schedules
        </p>
      </div>

      <Tabs defaultValue="regular" className="space-y-4">
        <TabsList>
          <TabsTrigger value="regular">Regular Hours</TabsTrigger>
          <TabsTrigger value="special">Special Hours</TabsTrigger>
        </TabsList>

        {/* Regular Hours */}
        <TabsContent value="regular" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Regular Operating Hours</CardTitle>
              <CardDescription>
                Set your standard operating hours for each day of the week
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...regularHoursForm}>
                <form onSubmit={regularHoursForm.handleSubmit((data) => updateRegularHoursMutation.mutate(data))} className="space-y-6">
                  {DAYS_OF_WEEK.map((day) => (
                    <FormField
                      key={day}
                      control={regularHoursForm.control}
                      name={day}
                      render={({ field }) => (
                        <div className="grid grid-cols-12 gap-4 items-center">
                          <div className="col-span-3">
                            <label className="text-sm font-medium capitalize">
                              {day}
                            </label>
                          </div>
                          <div className="col-span-2">
                            <FormField
                              control={regularHoursForm.control}
                              name={`${day}.enabled`}
                              render={({ field: enabledField }) => (
                                <FormItem className="flex items-center space-x-2">
                                  <FormControl>
                                    <Switch
                                      checked={enabledField.value}
                                      onCheckedChange={enabledField.onChange}
                                      disabled={updateRegularHoursMutation.isPending}
                                    />
                                  </FormControl>
                                  <FormLabel className="text-sm font-normal">
                                    {enabledField.value ? "Open" : "Closed"}
                                  </FormLabel>
                                </FormItem>
                              )}
                            />
                          </div>
                          <div className="col-span-3">
                            <FormField
                              control={regularHoursForm.control}
                              name={`${day}.openTime`}
                              render={({ field: openField }) => (
                                <FormItem>
                                  <FormControl>
                                    <Input
                                      type="time"
                                      {...openField}
                                      disabled={!field.value.enabled || updateRegularHoursMutation.isPending}
                                    />
                                  </FormControl>
                                </FormItem>
                              )}
                            />
                          </div>
                          <div className="col-span-1 text-center">
                            <span className="text-sm text-muted-foreground">to</span>
                          </div>
                          <div className="col-span-3">
                            <FormField
                              control={regularHoursForm.control}
                              name={`${day}.closeTime`}
                              render={({ field: closeField }) => (
                                <FormItem>
                                  <FormControl>
                                    <Input
                                      type="time"
                                      {...closeField}
                                      disabled={!field.value.enabled || updateRegularHoursMutation.isPending}
                                    />
                                  </FormControl>
                                </FormItem>
                              )}
                            />
                          </div>
                        </div>
                      )}
                    />
                  ))}
                  
                  <div className="flex justify-end">
                    <Button type="submit" disabled={updateRegularHoursMutation.isPending}>
                      <Save className="mr-2 h-4 w-4" />
                      {updateRegularHoursMutation.isPending ? "Saving..." : "Save Changes"}
                    </Button>
                  </div>
                </form>
              </Form>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Special Hours */}
        <TabsContent value="special" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Special Hours & Holidays</CardTitle>
                  <CardDescription>
                    Set custom hours or closures for specific dates
                  </CardDescription>
                </div>
                <Dialog open={isAddingSpecialHours} onOpenChange={setIsAddingSpecialHours}>
                  <DialogTrigger asChild>
                    <Button>
                      <Plus className="mr-2 h-4 w-4" />
                      Add Special Hours
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Add Special Hours</DialogTitle>
                      <DialogDescription>
                        Set custom hours or mark as closed for a specific date
                      </DialogDescription>
                    </DialogHeader>
                    <Form {...specialHoursForm}>
                      <form onSubmit={specialHoursForm.handleSubmit((data) => addSpecialHoursMutation.mutate(data))} className="space-y-4">
                        <FormField
                          control={specialHoursForm.control}
                          name="date"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Date</FormLabel>
                              <FormControl>
                                <Calendar
                                  mode="single"
                                  selected={field.value}
                                  onSelect={field.onChange}
                                  disabled={(date) => date < new Date()}
                                  className="rounded-md border"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        
                        <FormField
                          control={specialHoursForm.control}
                          name="type"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Type</FormLabel>
                              <Select
                                value={field.value}
                                onValueChange={field.onChange}
                                disabled={addSpecialHoursMutation.isPending}
                              >
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="closed">Closed</SelectItem>
                                  <SelectItem value="custom">Custom Hours</SelectItem>
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        
                        {watchedType === "custom" && (
                          <div className="grid grid-cols-2 gap-4">
                            <FormField
                              control={specialHoursForm.control}
                              name="openTime"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Open Time</FormLabel>
                                  <FormControl>
                                    <Input
                                      type="time"
                                      {...field}
                                      disabled={addSpecialHoursMutation.isPending}
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            
                            <FormField
                              control={specialHoursForm.control}
                              name="closeTime"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Close Time</FormLabel>
                                  <FormControl>
                                    <Input
                                      type="time"
                                      {...field}
                                      disabled={addSpecialHoursMutation.isPending}
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>
                        )}
                        
                        <FormField
                          control={specialHoursForm.control}
                          name="reason"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Reason (Optional)</FormLabel>
                              <FormControl>
                                <Input
                                  placeholder="e.g., Holiday, Private Event"
                                  {...field}
                                  disabled={addSpecialHoursMutation.isPending}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        
                        <div className="flex justify-end gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => setIsAddingSpecialHours(false)}
                            disabled={addSpecialHoursMutation.isPending}
                          >
                            Cancel
                          </Button>
                          <Button type="submit" disabled={addSpecialHoursMutation.isPending}>
                            {addSpecialHoursMutation.isPending ? "Adding..." : "Add Special Hours"}
                          </Button>
                        </div>
                      </form>
                    </Form>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent>
              {specialHours && specialHours.length > 0 ? (
                <div className="space-y-2">
                  {specialHours.map((special) => (
                    <div
                      key={special.id}
                      className="flex items-center justify-between rounded-lg border p-4"
                    >
                      <div className="flex items-center gap-4">
                        <CalendarIcon className="h-5 w-5 text-muted-foreground" />
                        <div>
                          <div className="font-medium">
                            {format(new Date(special.date), "EEEE, MMMM d, yyyy")}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {special.is_closed ? (
                              <span className="text-red-600">Closed</span>
                            ) : (
                              <span>
                                {special.open_time} - {special.close_time}
                              </span>
                            )}
                            {special.reason && ` • ${special.reason}`}
                          </div>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => deleteSpecialHoursMutation.mutate(special.id)}
                        disabled={deleteSpecialHoursMutation.isPending}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  No special hours or holidays scheduled
                </div>
              )}
            </CardContent>
          </Card>

          {/* Info Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Info className="h-5 w-5" />
                How Special Hours Work
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
              <p>
                • Special hours override your regular operating hours for specific dates
              </p>
              <p>
                • Mark days as "Closed" for holidays or special events
              </p>
              <p>
                • Set "Custom Hours" for days with different operating times
              </p>
              <p>
                • Customers will see these special hours when making bookings
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}