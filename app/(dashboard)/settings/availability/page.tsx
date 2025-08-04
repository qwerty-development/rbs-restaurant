// app/(dashboard)/settings/availability/page.tsx
"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
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
import { Textarea } from "@/components/ui/textarea"
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
  DialogTrigger,
} from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { toast } from "react-hot-toast"
import { 
  Save,
  ArrowLeft,
  Plus,
  X,
  Calendar as CalendarIcon,
  Clock,
  AlertTriangle,
} from "lucide-react"

// Types
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
}

// Regular hours schema
const regularHoursSchema = z.object({
  monday: z.object({
    is_open: z.boolean(),
    open_time: z.string().optional(),
    close_time: z.string().optional(),
  }),
  tuesday: z.object({
    is_open: z.boolean(),
    open_time: z.string().optional(),
    close_time: z.string().optional(),
  }),
  wednesday: z.object({
    is_open: z.boolean(),
    open_time: z.string().optional(),
    close_time: z.string().optional(),
  }),
  thursday: z.object({
    is_open: z.boolean(),
    open_time: z.string().optional(),
    close_time: z.string().optional(),
  }),
  friday: z.object({
    is_open: z.boolean(),
    open_time: z.string().optional(),
    close_time: z.string().optional(),
  }),
  saturday: z.object({
    is_open: z.boolean(),
    open_time: z.string().optional(),
    close_time: z.string().optional(),
  }),
  sunday: z.object({
    is_open: z.boolean(),
    open_time: z.string().optional(),
    close_time: z.string().optional(),
  }),
})

// Special hours schema
const specialHoursSchema = z.object({
  date: z.date(),
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
})

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

export default function EnhancedAvailabilitySettingsPage() {
  const router = useRouter()
  const supabase = createClient()
  const queryClient = useQueryClient()
  const [restaurantId, setRestaurantId] = useState<string>("")
  const [selectedDate, setSelectedDate] = useState<Date | undefined>()
  const [showSpecialHoursDialog, setShowSpecialHoursDialog] = useState(false)
  const [showClosureDialog, setShowClosureDialog] = useState(false)

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

  // Fetch all availability data
  const { data: availabilityData, isLoading } = useQuery({
    queryKey: ["restaurant-availability-all", restaurantId],
    queryFn: async () => {
      if (!restaurantId) return null
      
      const [regularHours, specialHours, closures] = await Promise.all([
        supabase
          .from("restaurant_hours")
          .select("*")
          .eq("restaurant_id", restaurantId),
        supabase
          .from("restaurant_special_hours")
          .select("*")
          .eq("restaurant_id", restaurantId)
          .gte("date", new Date().toISOString().split('T')[0]),
        supabase
          .from("restaurant_closures")
          .select("*")
          .eq("restaurant_id", restaurantId)
          .gte("end_date", new Date().toISOString().split('T')[0])
      ])

      return {
        regularHours: regularHours.data || [],
        specialHours: specialHours.data || [],
        closures: closures.data || []
      }
    },
    enabled: !!restaurantId,
  })

  // Regular hours form
  const regularHoursForm = useForm<RegularHoursFormData>({
    resolver: zodResolver(regularHoursSchema),
    defaultValues: {
      monday: { is_open: true, open_time: "09:00", close_time: "22:00" },
      tuesday: { is_open: true, open_time: "09:00", close_time: "22:00" },
      wednesday: { is_open: true, open_time: "09:00", close_time: "22:00" },
      thursday: { is_open: true, open_time: "09:00", close_time: "22:00" },
      friday: { is_open: true, open_time: "09:00", close_time: "22:00" },
      saturday: { is_open: true, open_time: "09:00", close_time: "22:00" },
      sunday: { is_open: true, open_time: "09:00", close_time: "22:00" },
    },
  })

  // Special hours form
  const specialHoursForm = useForm<SpecialHoursFormData>({
    resolver: zodResolver(specialHoursSchema),
    defaultValues: {
      is_closed: false,
      open_time: "09:00",
      close_time: "22:00",
    },
  })

  // Closure form
  const closureForm = useForm<ClosureFormData>({
    resolver: zodResolver(closureSchema),
  })

  // Update forms when data loads
  useEffect(() => {
    if (availabilityData?.regularHours) {
      const formData: any = {}
      
      DAYS_OF_WEEK.forEach(day => {
        const dayHours = availabilityData.regularHours.find(h => h.day_of_week === day)
        formData[day] = {
          is_open: dayHours?.is_open ?? true,
          open_time: dayHours?.open_time || "09:00",
          close_time: dayHours?.close_time || "22:00",
        }
      })
      
      regularHoursForm.reset(formData)
    }
  }, [availabilityData, regularHoursForm])

  // Update regular hours mutation
  const updateRegularHoursMutation = useMutation({
    mutationFn: async (data: RegularHoursFormData) => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error("Not authenticated")

      const updates = DAYS_OF_WEEK.map(day => ({
        restaurant_id: restaurantId,
        day_of_week: day,
        is_open: data[day].is_open,
        open_time: data[day].is_open ? data[day].open_time : null,
        close_time: data[day].is_open ? data[day].close_time : null,
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
      queryClient.invalidateQueries({ queryKey: ["restaurant-availability-all", restaurantId] })
      toast.success("Regular hours updated successfully")
    },
    onError: (error: any) => {
      toast.error(`Failed to update hours: ${error.message}`)
    },
  })

  // Add special hours mutation
  const addSpecialHoursMutation = useMutation({
    mutationFn: async (data: SpecialHoursFormData) => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error("Not authenticated")

      const { error } = await supabase
        .from("restaurant_special_hours")
        .upsert({
          restaurant_id: restaurantId,
          date: format(data.date, 'yyyy-MM-dd'),
          is_closed: data.is_closed,
          open_time: !data.is_closed ? data.open_time : null,
          close_time: !data.is_closed ? data.close_time : null,
          reason: data.reason,
          created_by: user.id,
        }, {
          onConflict: "restaurant_id,date",
        })

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["restaurant-availability-all", restaurantId] })
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
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error("Not authenticated")

      const { error } = await supabase
        .from("restaurant_closures")
        .insert({
          restaurant_id: restaurantId,
          start_date: format(data.start_date, 'yyyy-MM-dd'),
          end_date: format(data.end_date, 'yyyy-MM-dd'),
          reason: data.reason,
          created_by: user.id,
        })

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["restaurant-availability-all", restaurantId] })
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
      queryClient.invalidateQueries({ queryKey: ["restaurant-availability-all", restaurantId] })
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
      queryClient.invalidateQueries({ queryKey: ["restaurant-availability-all", restaurantId] })
      toast.success("Closure deleted")
    }
  }

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
          Manage your restaurant's operating hours, special occasions, and closures.
        </p>
      </div>

      <Tabs defaultValue="regular" className="space-y-6">
        <TabsList>
          <TabsTrigger value="regular">Regular Hours</TabsTrigger>
          <TabsTrigger value="special">Special Hours</TabsTrigger>
          <TabsTrigger value="closures">Closures</TabsTrigger>
        </TabsList>

        {/* Regular Hours Tab */}
        <TabsContent value="regular">
          <Card>
            <CardHeader>
              <CardTitle>Regular Operating Hours</CardTitle>
              <CardDescription>
                Set your standard weekly operating hours.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...regularHoursForm}>
                <form onSubmit={regularHoursForm.handleSubmit((data) => updateRegularHoursMutation.mutate(data))} className="space-y-6">
                  {DAYS_OF_WEEK.map((day) => (
                    <div key={day} className="grid grid-cols-12 gap-4 items-center">
                      <div className="col-span-3">
                        <FormLabel className="capitalize">{day}</FormLabel>
                      </div>
                      
                      <div className="col-span-2">
                        <FormField
                          control={regularHoursForm.control}
                          name={`${day}.is_open`}
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

                      {regularHoursForm.watch(`${day}.is_open`) && (
                        <>
                          <div className="col-span-3">
                            <FormField
                              control={regularHoursForm.control}
                              name={`${day}.open_time`}
                              render={({ field }) => (
                                <FormItem>
                                  <FormControl>
                                    <Input
                                      type="time"
                                      {...field}
                                      className="w-full"
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>

                          <div className="col-span-1 text-center">to</div>

                          <div className="col-span-3">
                            <FormField
                              control={regularHoursForm.control}
                              name={`${day}.close_time`}
                              render={({ field }) => (
                                <FormItem>
                                  <FormControl>
                                    <Input
                                      type="time"
                                      {...field}
                                      className="w-full"
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>
                        </>
                      )}
                    </div>
                  ))}

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
            </CardContent>
          </Card>
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
                {availabilityData?.specialHours?.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">
                    No special hours set. Add special hours for holidays or events.
                  </p>
                ) : (
                  availabilityData?.specialHours?.map((special: any) => (
                    <div key={special.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div>
                        <p className="font-medium">
                          {format(new Date(special.date), 'EEEE, MMMM d, yyyy')}
                        </p>
                        {special.is_closed ? (
                          <p className="text-sm text-red-600">Closed</p>
                        ) : (
                          <p className="text-sm text-muted-foreground">
                            {special.open_time} - {special.close_time}
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
                {availabilityData?.closures?.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">
                    No closures scheduled.
                  </p>
                ) : (
                  availabilityData?.closures?.map((closure: any) => (
                    <div key={closure.id} className="flex items-center justify-between p-4 border rounded-lg bg-red-50 dark:bg-red-950/20">
                      <div>
                        <p className="font-medium flex items-center gap-2">
                          <AlertTriangle className="h-4 w-4 text-red-600" />
                          Closed: {format(new Date(closure.start_date), 'MMM d, yyyy')} - {format(new Date(closure.end_date), 'MMM d, yyyy')}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Reason: {closure.reason}
                        </p>
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

      {/* Special Hours Dialog */}
      <Dialog open={showSpecialHoursDialog} onOpenChange={setShowSpecialHoursDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Special Hours</DialogTitle>
            <DialogDescription>
              Set different operating hours for a specific date.
            </DialogDescription>
          </DialogHeader>
          <Form {...specialHoursForm}>
            <form onSubmit={specialHoursForm.handleSubmit((data) => addSpecialHoursMutation.mutate(data))} className="space-y-4">
              <FormField
                control={specialHoursForm.control}
                name="date"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Date</FormLabel>
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
                          <Input type="time" {...field} />
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
                          <Input type="time" {...field} />
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
              Mark your restaurant as closed for a period of time.
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
                    <FormControl>
                      <Textarea
                        placeholder="e.g., Renovations, Staff vacation"
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