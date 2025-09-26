'use client'

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import * as z from "zod"
import { format } from "date-fns"
import { Calendar } from "@/components/ui/calendar"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { TimeInput12H } from "@/components/ui/time-input-12h"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Form,
  FormControl,
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
} from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { toast } from "react-hot-toast"
import {
  Save,
  Plus,
  X,
  Calendar as CalendarIcon,
  Clock,
  AlertTriangle,
  Building,
  Search,
  RefreshCw,
  Settings,
  ChefHat,
  Eye,
} from "lucide-react"
import { OpenHoursForm } from "@/components/settings/open-hours-form"
import { formatTimeRange12Hour } from "@/lib/utils/time-utils"

// Types
interface Restaurant {
  id: string
  name: string
  address: string
  status: string
  cuisine_type: string
}

interface SpecialHours {
  id?: string
  date: Date
  is_closed: boolean
  open_time?: string
  close_time?: string
  reason?: string
}

interface Closure {
  id?: string
  start_date: Date
  end_date: Date
  reason: string
  is_all_day: boolean
  start_time?: string
  end_time?: string
}

// Schema for a single shift
const shiftSchema = z.object({
  id: z.string().optional(),
  name: z.string().optional(),
  is_open: z.boolean(),
  open_time: z.string().optional(),
  close_time: z.string().optional(),
})

// Regular hours schema - supports multiple shifts per day
const regularHoursSchema = z.object({
  monday: z.array(shiftSchema),
  tuesday: z.array(shiftSchema),
  wednesday: z.array(shiftSchema),
  thursday: z.array(shiftSchema),
  friday: z.array(shiftSchema),
  saturday: z.array(shiftSchema),
  sunday: z.array(shiftSchema),
})

// Special hours schema
const specialHoursSchema = z.object({
  dates: z.array(z.date()).min(1, "Select at least one date"),
  is_closed: z.boolean(),
  open_time: z.string().optional(),
  close_time: z.string().optional(),
  reason: z.string().optional(),
})

// Closure schema
const closureSchema = z.object({
  start_date: z.date(),
  end_date: z.date(),
  reason: z.string().min(1, "Reason is required"),
  is_all_day: z.boolean().default(true),
  start_time: z.string().optional(),
  end_time: z.string().optional(),
}).refine(
  (data) => {
    if (!data.is_all_day) {
      return data.start_time && data.end_time
    }
    return true
  },
  {
    message: "Start time and end time are required for partial-day closures",
    path: ["start_time"],
  }
)

type RegularHoursFormData = z.infer<typeof regularHoursSchema>
type SpecialHoursFormData = z.infer<typeof specialHoursSchema>
type ClosureFormData = z.infer<typeof closureSchema>

const DAYS_OF_WEEK = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
] as const

const CLOSURE_REASONS = [
  "Sold Out",
  "Maintenance",
  "Renovation",
  "Vacation",
  "Temporarily Closed",
] as const

export default function AdminAvailabilityManagementPage() {
  const supabase = createClient()
  const queryClient = useQueryClient()
  const [selectedRestaurant, setSelectedRestaurant] = useState<Restaurant | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [showSpecialHoursDialog, setShowSpecialHoursDialog] = useState(false)
  const [showClosureDialog, setShowClosureDialog] = useState(false)

  // Fetch restaurants for selection
  const { data: restaurants, isLoading: restaurantsLoading } = useQuery({
    queryKey: ["admin-restaurants"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("restaurants")
        .select("id, name, address, status, cuisine_type")
        .eq("status", "active")
        .order("name")

      if (error) throw error
      return data || []
    },
  })

  // Fetch availability data for selected restaurant
  const { data: availabilityData, isLoading: availabilityLoading } = useQuery({
    queryKey: ["admin-restaurant-availability", selectedRestaurant?.id],
    queryFn: async () => {
      if (!selectedRestaurant?.id) return null

      const [regularHours, specialHours, closures] = await Promise.all([
        supabase
          .from("restaurant_hours")
          .select("*")
          .eq("restaurant_id", selectedRestaurant.id),
        supabase
          .from("restaurant_special_hours")
          .select("*")
          .eq("restaurant_id", selectedRestaurant.id)
          .gte("date", new Date().toISOString().split('T')[0]),
        supabase
          .from("restaurant_closures")
          .select("*")
          .eq("restaurant_id", selectedRestaurant.id)
          .gte("end_date", new Date().toISOString().split('T')[0])
      ])

      return {
        regularHours: regularHours.data || [],
        specialHours: specialHours.data || [],
        closures: closures.data || []
      }
    },
    enabled: !!selectedRestaurant?.id,
  })

  // Regular hours form
  const regularHoursForm = useForm<RegularHoursFormData>({
    resolver: zodResolver(regularHoursSchema),
    defaultValues: {
      monday: [{ name: "", is_open: true, open_time: "09:00", close_time: "21:00" }],
      tuesday: [{ name: "", is_open: true, open_time: "09:00", close_time: "21:00" }],
      wednesday: [{ name: "", is_open: true, open_time: "09:00", close_time: "21:00" }],
      thursday: [{ name: "", is_open: true, open_time: "09:00", close_time: "21:00" }],
      friday: [{ name: "", is_open: true, open_time: "09:00", close_time: "21:00" }],
      saturday: [{ name: "", is_open: true, open_time: "09:00", close_time: "21:00" }],
      sunday: [{ name: "", is_open: true, open_time: "09:00", close_time: "21:00" }],
    },
  })

  // Special hours form
  const specialHoursForm = useForm<SpecialHoursFormData>({
    resolver: zodResolver(specialHoursSchema),
    defaultValues: {
      dates: [],
      is_closed: false,
      open_time: "09:00",
      close_time: "21:00",
    },
  })

  // Closure form
  const closureForm = useForm<ClosureFormData>({
    resolver: zodResolver(closureSchema),
    defaultValues: {
      is_all_day: true,
      start_time: "09:00",
      end_time: "17:00",
    },
  })

  // Update forms when data loads
  useEffect(() => {
    if (availabilityData?.regularHours) {
      const formData: any = {}

      DAYS_OF_WEEK.forEach(day => {
        const dayShifts = availabilityData.regularHours.filter(h => h.day_of_week === day)
        if (dayShifts.length > 0) {
          formData[day] = dayShifts.map(shift => ({
            id: shift.id,
            name: shift.name || "",
            is_open: shift.is_open,
            open_time: shift.open_time || "09:00",
            close_time: shift.close_time || "22:00",
          }))
        } else {
          formData[day] = [{ name: "", is_open: false, open_time: "09:00", close_time: "22:00" }]
        }
      })

      regularHoursForm.reset(formData)
    }
  }, [availabilityData, regularHoursForm])

  // Update regular hours mutation
  const updateRegularHoursMutation = useMutation({
    mutationFn: async (data: RegularHoursFormData) => {
      if (!selectedRestaurant?.id) throw new Error("No restaurant selected")

      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error("Not authenticated")

      // Delete existing hours
      const { error: deleteError } = await supabase
        .from("restaurant_hours")
        .delete()
        .eq("restaurant_id", selectedRestaurant.id)

      if (deleteError) throw deleteError

      // Insert new shifts
      const allShifts: any[] = []

      DAYS_OF_WEEK.forEach(day => {
        data[day].forEach(shift => {
          allShifts.push({
            restaurant_id: selectedRestaurant.id,
            day_of_week: day,
            name: shift.name || null,
            is_open: shift.is_open,
            open_time: shift.is_open ? shift.open_time : null,
            close_time: shift.is_open ? shift.close_time : null,
          })
        })
      })

      if (allShifts.length > 0) {
        const { error: insertError } = await supabase
          .from("restaurant_hours")
          .insert(allShifts)

        if (insertError) throw insertError
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-restaurant-availability", selectedRestaurant?.id] })
      toast.success("Regular hours updated successfully")
    },
    onError: (error: any) => {
      toast.error(`Failed to update hours: ${error.message}`)
    },
  })

  // Add special hours mutation
  const addSpecialHoursMutation = useMutation({
    mutationFn: async (data: SpecialHoursFormData) => {
      if (!selectedRestaurant?.id) throw new Error("No restaurant selected")

      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error("Not authenticated")

      const rows = (data.dates || []).map((d) => ({
        restaurant_id: selectedRestaurant.id,
        date: format(d, 'yyyy-MM-dd'),
        is_closed: data.is_closed,
        open_time: !data.is_closed ? data.open_time : null,
        close_time: !data.is_closed ? data.close_time : null,
        reason: data.reason,
        created_by: user.id,
      }))

      if (rows.length === 0) {
        throw new Error("Please select at least one date")
      }

      const { error } = await supabase
        .from("restaurant_special_hours")
        .upsert(rows, {
          onConflict: "restaurant_id,date",
        })

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-restaurant-availability", selectedRestaurant?.id] })
      toast.success("Special hours added successfully")
      setShowSpecialHoursDialog(false)
      specialHoursForm.reset()
    },
    onError: (error: any) => {
      toast.error(`Failed to add special hours: ${error.message}`)
    },
  })

  // Add closure mutation
  const addClosureMutation = useMutation({
    mutationFn: async (data: ClosureFormData) => {
      if (!selectedRestaurant?.id) throw new Error("No restaurant selected")

      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error("Not authenticated")

      const { error } = await supabase
        .from("restaurant_closures")
        .insert({
          restaurant_id: selectedRestaurant.id,
          start_date: format(data.start_date, 'yyyy-MM-dd'),
          end_date: format(data.end_date, 'yyyy-MM-dd'),
          reason: data.reason,
          start_time: data.is_all_day ? null : data.start_time,
          end_time: data.is_all_day ? null : data.end_time,
          created_by: user.id,
        })

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-restaurant-availability", selectedRestaurant?.id] })
      toast.success("Closure added successfully")
      setShowClosureDialog(false)
      closureForm.reset()
    },
    onError: (error: any) => {
      toast.error(`Failed to add closure: ${error.message}`)
    },
  })

  // Delete special hours
  const deleteSpecialHours = async (id: string) => {
    const { error } = await supabase
      .from("restaurant_special_hours")
      .delete()
      .eq("id", id)

    if (error) {
      toast.error("Failed to delete special hours")
    } else {
      queryClient.invalidateQueries({ queryKey: ["admin-restaurant-availability", selectedRestaurant?.id] })
      toast.success("Special hours deleted")
    }
  }

  // Delete closure
  const deleteClosure = async (id: string) => {
    const { error } = await supabase
      .from("restaurant_closures")
      .delete()
      .eq("id", id)

    if (error) {
      toast.error("Failed to delete closure")
    } else {
      queryClient.invalidateQueries({ queryKey: ["admin-restaurant-availability", selectedRestaurant?.id] })
      toast.success("Closure deleted")
    }
  }

  const filteredRestaurants = restaurants?.filter(restaurant =>
    restaurant.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    restaurant.cuisine_type.toLowerCase().includes(searchTerm.toLowerCase())
  ) || []

  if (restaurantsLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading restaurants...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Restaurant Availability Management</h1>
          <p className="mt-2 text-gray-600">
            Manage operating hours, special hours, and closures for all restaurants
          </p>
        </div>
        <div className="mt-4 lg:mt-0 flex items-center gap-3">
          <Button
            variant="outline"
            onClick={() => queryClient.invalidateQueries({ queryKey: ["admin-restaurant-availability"] })}
            disabled={availabilityLoading}
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${availabilityLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Restaurant Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building className="h-5 w-5" />
            Select Restaurant
          </CardTitle>
          <CardDescription>
            Choose a restaurant to manage its availability settings
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search restaurants..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                  style={{ minHeight: '44px' }}
                />
              </div>
            </div>
            <Select
              value={selectedRestaurant?.id || ""}
              onValueChange={(value) => {
                const restaurant = restaurants?.find(r => r.id === value)
                setSelectedRestaurant(restaurant || null)
              }}
            >
              <SelectTrigger className="w-full lg:w-80" style={{ minHeight: '44px' }}>
                <SelectValue placeholder="Select a restaurant" />
              </SelectTrigger>
              <SelectContent>
                {filteredRestaurants.map((restaurant) => (
                  <SelectItem key={restaurant.id} value={restaurant.id}>
                    <div className="flex items-center justify-between w-full">
                      <div>
                        <div className="font-medium">{restaurant.name}</div>
                        <div className="text-sm text-gray-500">{restaurant.cuisine_type}</div>
                      </div>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedRestaurant && (
            <div className="mt-4 p-4 bg-blue-50 rounded-lg">
              <div className="flex items-center gap-2">
                <ChefHat className="h-5 w-5 text-blue-600" />
                <div>
                  <div className="font-medium text-blue-900">{selectedRestaurant.name}</div>
                  <div className="text-sm text-blue-600">{selectedRestaurant.address}</div>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {selectedRestaurant && (
        <Tabs defaultValue="regular" className="space-y-6">
          <TabsList>
            <TabsTrigger value="regular">Booking</TabsTrigger>
            <TabsTrigger value="open">Open</TabsTrigger>
            <TabsTrigger value="special">Special</TabsTrigger>
            <TabsTrigger value="closures">Closures</TabsTrigger>
          </TabsList>

          {/* Regular Hours Tab */}
          <TabsContent value="regular">
            <Card>
              <CardHeader>
                <CardTitle>Booking Hours</CardTitle>
                <CardDescription>
                  Set when this restaurant accepts online bookings and reservations. You can add multiple shifts per day.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {availabilityLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Clock className="h-6 w-6 animate-spin mr-2" />
                    Loading availability data...
                  </div>
                ) : (
                  <Form {...regularHoursForm}>
                    <form onSubmit={regularHoursForm.handleSubmit((data) => updateRegularHoursMutation.mutate(data))} className="space-y-8">
                      {DAYS_OF_WEEK.map((day) => {
                        const shifts = regularHoursForm.watch(day) || []
                        return (
                          <div key={day} className="space-y-4">
                            <div className="flex items-center justify-between">
                              <h3 className="text-lg font-medium capitalize">{day}</h3>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  const currentShifts = regularHoursForm.getValues(day)
                                  regularHoursForm.setValue(day, [
                                    ...currentShifts,
                                    { name: "", is_open: true, open_time: "17:00", close_time: "21:00" }
                                  ])
                                }}
                              >
                                <Plus className="mr-2 h-4 w-4" />
                                Add Shift
                              </Button>
                            </div>

                            <div className="space-y-3">
                              {shifts.map((_, shiftIndex) => (
                                <div key={shiftIndex} className="flex items-center gap-4 p-4 border rounded-lg">
                                  <div className="flex items-center space-x-2">
                                    <FormField
                                      control={regularHoursForm.control}
                                      name={`${day}.${shiftIndex}.is_open`}
                                      render={({ field }) => (
                                        <FormItem className="flex items-center space-x-2">
                                          <FormControl>
                                            <Switch
                                              checked={field.value}
                                              onCheckedChange={field.onChange}
                                            />
                                          </FormControl>
                                          <FormLabel className="!mt-0">
                                            {field.value ? "Open" : "Closed"}
                                          </FormLabel>
                                        </FormItem>
                                      )}
                                    />
                                  </div>

                                  <FormField
                                    control={regularHoursForm.control}
                                    name={`${day}.${shiftIndex}.name`}
                                    render={({ field }) => (
                                      <FormItem>
                                        <FormControl>
                                          <Input
                                            placeholder="Shift name (e.g., Lunch, Dinner)"
                                            {...field}
                                            className="w-44"
                                          />
                                        </FormControl>
                                        <FormMessage />
                                      </FormItem>
                                    )}
                                  />

                                  {shifts[shiftIndex]?.is_open && (
                                    <>
                                      <FormField
                                        control={regularHoursForm.control}
                                        name={`${day}.${shiftIndex}.open_time`}
                                        render={({ field }) => (
                                          <FormItem>
                                            <FormControl>
                                              <TimeInput12H
                                                value={field.value || ""}
                                                onChange={field.onChange}
                                                className="w-auto"
                                                name={field.name}
                                                placeholder="9:00 AM"
                                              />
                                            </FormControl>
                                            <FormMessage />
                                          </FormItem>
                                        )}
                                      />

                                      <span className="text-muted-foreground">to</span>

                                      <FormField
                                        control={regularHoursForm.control}
                                        name={`${day}.${shiftIndex}.close_time`}
                                        render={({ field }) => (
                                          <FormItem>
                                            <FormControl>
                                              <TimeInput12H
                                                value={field.value || ""}
                                                onChange={field.onChange}
                                                className="w-auto"
                                                name={field.name}
                                                placeholder="5:00 PM"
                                              />
                                            </FormControl>
                                            <FormMessage />
                                          </FormItem>
                                        )}
                                      />
                                    </>
                                  )}

                                  {shifts.length > 1 && (
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => {
                                        const currentShifts = regularHoursForm.getValues(day)
                                        const newShifts = currentShifts.filter((_, i) => i !== shiftIndex)
                                        regularHoursForm.setValue(day, newShifts)
                                      }}
                                    >
                                      <X className="h-4 w-4" />
                                    </Button>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )
                      })}

                      <Button
                        type="submit"
                        className="w-full"
                        disabled={updateRegularHoursMutation.isPending}
                      >
                        <Save className="mr-2 h-4 w-4" />
                        Save Regular Hours
                      </Button>
                    </form>
                  </Form>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Open Hours Tab */}
          <TabsContent value="open">
            {selectedRestaurant && (
              <OpenHoursForm
                restaurantId={selectedRestaurant.id}
                onSuccess={() => {
                  queryClient.invalidateQueries({ queryKey: ["admin-restaurant-availability", selectedRestaurant.id] })
                  toast.success("Open hours updated successfully")
                }}
              />
            )}
          </TabsContent>

          {/* Special Hours Tab */}
          <TabsContent value="special">
            <Card>
              <CardHeader>
                <CardTitle>Special Hours</CardTitle>
                <CardDescription>
                  Set different hours for specific dates (holidays, special events, etc.)
                </CardDescription>
                <Button
                  onClick={() => setShowSpecialHoursDialog(true)}
                  size="sm"
                  className="w-fit"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add Special Hours
                </Button>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {(!availabilityData?.specialHours || availabilityData.specialHours.length === 0) ? (
                    <p className="text-muted-foreground text-center py-8">
                      No special hours set. Add special hours for holidays or events.
                    </p>
                  ) : (
                    availabilityData.specialHours.map((special: any) => (
                      <div key={special.id} className="flex items-center justify-between p-4 border rounded-lg">
                        <div>
                          <p className="font-medium">
                            {format(new Date(special.date), 'EEEE, MMMM d, yyyy')}
                          </p>
                          {special.is_closed ? (
                            <p className="text-sm text-red-600">Closed</p>
                          ) : (
                            <p className="text-sm text-muted-foreground">
                              {formatTimeRange12Hour(special.open_time, special.close_time)}
                            </p>
                          )}
                          {special.reason && (
                            <p className="text-sm text-muted-foreground">
                              Reason: {special.reason}
                            </p>
                          )}
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteSpecialHours(special.id)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Closures Tab */}
          <TabsContent value="closures">
            <Card>
              <CardHeader>
                <CardTitle>Temporary Closures</CardTitle>
                <CardDescription>
                  Manage temporary closures for renovations, vacations, etc.
                </CardDescription>
                <Button
                  onClick={() => setShowClosureDialog(true)}
                  size="sm"
                  className="w-fit"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add Closure
                </Button>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {(!availabilityData?.closures || availabilityData.closures.length === 0) ? (
                    <p className="text-muted-foreground text-center py-8">
                      No closures scheduled.
                    </p>
                  ) : (
                    availabilityData.closures.map((closure: any) => (
                      <div key={closure.id} className="flex items-center justify-between p-4 border rounded-lg bg-red-50 dark:bg-red-950/20">
                        <div>
                          <p className="font-medium flex items-center gap-2">
                            <AlertTriangle className="h-4 w-4 text-red-600" />
                            Closed: {format(new Date(closure.start_date), 'MMM d, yyyy')} - {format(new Date(closure.end_date), 'MMM d, yyyy')}
                            {closure.start_time && closure.end_time && (
                              <span className="text-sm font-normal">
                                ({formatTimeRange12Hour(closure.start_time, closure.end_time)})
                              </span>
                            )}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            Reason: {closure.reason}
                          </p>
                          {closure.start_time && closure.end_time && (
                            <p className="text-xs text-muted-foreground">
                              Partial closure: {formatTimeRange12Hour(closure.start_time, closure.end_time)} daily
                            </p>
                          )}
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteClosure(closure.id)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}

      {/* Special Hours Dialog */}
      <Dialog open={showSpecialHoursDialog} onOpenChange={setShowSpecialHoursDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Special Hours</DialogTitle>
            <DialogDescription>
              Set different operating hours for specific date(s).
            </DialogDescription>
          </DialogHeader>
          <Form {...specialHoursForm}>
            <form onSubmit={specialHoursForm.handleSubmit((data) => addSpecialHoursMutation.mutate(data))} className="space-y-4">
              <FormField
                control={specialHoursForm.control}
                name="dates"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Dates</FormLabel>
                    <Calendar
                      mode="multiple"
                      selected={field.value}
                      onSelect={field.onChange}
                      disabled={(date) =>
                        date < new Date(new Date().setHours(0, 0, 0, 0))
                      }
                      className="rounded-md border"
                    />
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={specialHoursForm.control}
                name="is_closed"
                render={({ field }) => (
                  <FormItem className="flex items-center space-x-2">
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                    <FormLabel className="!mt-0">
                      Closed all day
                    </FormLabel>
                  </FormItem>
                )}
              />

              {!specialHoursForm.watch("is_closed") && (
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={specialHoursForm.control}
                    name="open_time"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Opening Time</FormLabel>
                        <FormControl>
                          <TimeInput12H
                            value={field.value || ""}
                            onChange={field.onChange}
                            name={field.name}
                            placeholder="9:00 AM"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={specialHoursForm.control}
                    name="close_time"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Closing Time</FormLabel>
                        <FormControl>
                          <TimeInput12H
                            value={field.value || ""}
                            onChange={field.onChange}
                            name={field.name}
                            placeholder="5:00 PM"
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
                    <FormLabel>Reason (optional)</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="e.g., Christmas Day, Private Event"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button
                type="submit"
                className="w-full"
                disabled={addSpecialHoursMutation.isPending}
              >
                Add Special Hours
              </Button>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Closure Dialog */}
      <Dialog open={showClosureDialog} onOpenChange={setShowClosureDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Temporary Closure</DialogTitle>
            <DialogDescription>
              Mark the restaurant as closed for a period of time.
            </DialogDescription>
          </DialogHeader>
          <Form {...closureForm}>
            <form onSubmit={closureForm.handleSubmit((data) => addClosureMutation.mutate(data))} className="space-y-4">
              <FormField
                control={closureForm.control}
                name="start_date"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Start Date</FormLabel>
                    <Calendar
                      mode="single"
                      selected={field.value}
                      onSelect={field.onChange}
                      disabled={(date) =>
                        date < new Date(new Date().setHours(0, 0, 0, 0))
                      }
                      className="rounded-md border"
                    />
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={closureForm.control}
                name="end_date"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>End Date</FormLabel>
                    <Calendar
                      mode="single"
                      selected={field.value}
                      onSelect={field.onChange}
                      disabled={(date) =>
                        date < closureForm.watch("start_date")
                      }
                      className="rounded-md border"
                    />
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={closureForm.control}
                name="reason"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Reason</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select a reason for closure" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {CLOSURE_REASONS.map((reason) => (
                          <SelectItem key={reason} value={reason}>
                            {reason}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={closureForm.control}
                name="is_all_day"
                render={({ field }) => (
                  <FormItem className="flex items-center space-x-2">
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                    <FormLabel className="!mt-0">
                      All day closure
                    </FormLabel>
                  </FormItem>
                )}
              />

              {!closureForm.watch("is_all_day") && (
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={closureForm.control}
                    name="start_time"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Start Time</FormLabel>
                        <FormControl>
                          <TimeInput12H
                            value={field.value || ""}
                            onChange={field.onChange}
                            name={field.name}
                            placeholder="9:00 AM"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={closureForm.control}
                    name="end_time"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>End Time</FormLabel>
                        <FormControl>
                          <TimeInput12H
                            value={field.value || ""}
                            onChange={field.onChange}
                            name={field.name}
                            placeholder="5:00 PM"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              )}

              <Button
                type="submit"
                className="w-full"
                disabled={addClosureMutation.isPending}
              >
                Add Closure
              </Button>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  )
}