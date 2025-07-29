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
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { toast } from "react-hot-toast"
import { 
  Save,
  ArrowLeft,
} from "lucide-react"
import type { Restaurant } from "@/types"

// Availability form schema
const availabilityFormSchema = z.object({
  opening_time: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, "Invalid time format"),
  closing_time: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, "Invalid time format"),
  monday: z.boolean(),
  tuesday: z.boolean(),
  wednesday: z.boolean(),
  thursday: z.boolean(),
  friday: z.boolean(),
  saturday: z.boolean(),
  sunday: z.boolean(),
});

type AvailabilityFormData = z.infer<typeof availabilityFormSchema>

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
        .select("*, opening_time, closing_time, restaurant_hours!inner(*)")
        .eq("id", restaurantId)
        .single()

      if (error) throw error
      return data as Restaurant & { opening_time: string; closing_time: string; restaurant_hours: any[] }
    },
    enabled: !!restaurantId,
  })

  // Availability form
  const availabilityForm = useForm<AvailabilityFormData>({
    resolver: zodResolver(availabilityFormSchema),
    defaultValues: {
      opening_time: "09:00",
      closing_time: "22:00",
      monday: true,
      tuesday: true,
      wednesday: true,
      thursday: true,
      friday: true,
      saturday: true,
      sunday: true,
    },
  })

  // Update form when data loads
  useEffect(() => {
    if (restaurant?.restaurant_hours) {
      const daysData = restaurant.restaurant_hours.reduce((acc, hour) => {
        acc[hour.day_of_week] = hour.is_open
        return acc
      }, {} as Record<string, boolean>)
      
      availabilityForm.reset({
        opening_time: restaurant.opening_time || "09:00",
        closing_time: restaurant.closing_time || "22:00",
        monday: daysData.monday ?? true,
        tuesday: daysData.tuesday ?? true,
        wednesday: daysData.wednesday ?? true,
        thursday: daysData.thursday ?? true,
        friday: daysData.friday ?? true,
        saturday: daysData.saturday ?? true,
        sunday: daysData.sunday ?? true,
      })
    }
  }, [restaurant, availabilityForm])

  // Update availability mutation
  const updateAvailabilityMutation = useMutation({
    mutationFn: async (data: AvailabilityFormData) => {
      // 1. Update restaurant opening and closing times
      const { error: restaurantUpdateError } = await supabase
        .from("restaurants")
        .update({
          opening_time: data.opening_time,
          closing_time: data.closing_time,
        })
        .eq("id", restaurantId)

      if (restaurantUpdateError) throw restaurantUpdateError

      // 2. Update daily hours
      const updates = DAYS_OF_WEEK.map(day => ({
        restaurant_id: restaurantId,
        day_of_week: day,
        is_open: data[day as keyof AvailabilityFormData],
        open_time: data.opening_time,
        close_time: data.closing_time,
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
      queryClient.invalidateQueries({ queryKey: ["restaurant-availability", restaurantId] })
      toast.success("Availability updated successfully")
    },
    onError: (error: any) => {
      toast.error(`Failed to update availability: ${error.message}`)
    },
  })

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
          Manage your restaurant's operating hours.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Operating Hours</CardTitle>
          <CardDescription>
            Set your standard operating hours and which days you are open.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...availabilityForm}>
            <form onSubmit={availabilityForm.handleSubmit((data) => updateAvailabilityMutation.mutate(data))} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={availabilityForm.control}
                  name="opening_time"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Opening Time</FormLabel>
                      <FormControl>
                        <Input type="time" {...field} disabled={updateAvailabilityMutation.isPending} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={availabilityForm.control}
                  name="closing_time"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Closing Time</FormLabel>
                      <FormControl>
                        <Input type="time" {...field} disabled={updateAvailabilityMutation.isPending} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="space-y-4 pt-4">
                <h3 className="text-lg font-medium">Open Days</h3>
                {DAYS_OF_WEEK.map((day) => (
                  <FormField
                    key={day}
                    control={availabilityForm.control}
                    name={day}
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                          <FormLabel className="text-base capitalize">
                            {day}
                          </FormLabel>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                            disabled={updateAvailabilityMutation.isPending}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                ))}
              </div>
              
              <div className="flex justify-end">
                <Button type="submit" disabled={updateAvailabilityMutation.isPending}>
                  <Save className="mr-2 h-4 w-4" />
                  {updateAvailabilityMutation.isPending ? "Saving..." : "Save Changes"}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  )
}