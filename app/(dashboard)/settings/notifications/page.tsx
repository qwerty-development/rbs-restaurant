// app/(dashboard)/settings/notifications/page.tsx
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
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
} from "@/components/ui/form"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { toast } from "react-hot-toast"
import { 
  Bell,
  Mail,
  MessageSquare,
  Calendar,
  UserPlus,
  Star,
  AlertCircle,
  TrendingUp,
  Clock,
  Save,
  ArrowLeft,
  Smartphone,
  Volume2
} from "lucide-react"

const notificationSettingsSchema = z.object({
  // Email notifications
  email_new_booking: z.boolean(),
  email_booking_cancelled: z.boolean(),
  email_booking_modified: z.boolean(),
  email_new_review: z.boolean(),
  email_new_vip: z.boolean(),
  email_daily_summary: z.boolean(),
  email_weekly_report: z.boolean(),
  
  // SMS notifications
  sms_new_booking: z.boolean(),
  sms_booking_cancelled: z.boolean(),
  sms_no_show_alert: z.boolean(),
  
  // Push notifications
  push_new_booking: z.boolean(),
  push_booking_reminder: z.boolean(),
  push_table_ready: z.boolean(),
  
  // In-app notifications
  app_all_activities: z.boolean(),
  app_mention_only: z.boolean(),
  
  // Notification timing
  quiet_hours_enabled: z.boolean(),
  quiet_hours_start: z.string(),
  quiet_hours_end: z.string(),
  
  // Summary preferences
  summary_frequency: z.enum(["daily", "weekly", "monthly", "never"]),
  summary_time: z.string(),
})

type NotificationSettingsData = z.infer<typeof notificationSettingsSchema>

const NOTIFICATION_CATEGORIES = [
  {
    id: "bookings",
    title: "Bookings",
    icon: Calendar,
    notifications: [
      {
        id: "email_new_booking",
        label: "New booking received",
        description: "Get notified when customers make new reservations",
        channels: ["email", "sms", "push"],
      },
      {
        id: "email_booking_cancelled",
        label: "Booking cancelled",
        description: "Alert when customers cancel their reservations",
        channels: ["email", "sms"],
      },
      {
        id: "email_booking_modified",
        label: "Booking modified",
        description: "Notification when booking details are changed",
        channels: ["email"],
      },
      {
        id: "sms_no_show_alert",
        label: "No-show alert",
        description: "Alert when customers don't show up for reservations",
        channels: ["sms"],
      },
    ],
  },
  {
    id: "customers",
    title: "Customers",
    icon: UserPlus,
    notifications: [
      {
        id: "email_new_review",
        label: "New review posted",
        description: "Get notified when customers leave reviews",
        channels: ["email"],
      },
      {
        id: "email_new_vip",
        label: "New VIP customer",
        description: "Alert when a customer reaches VIP status",
        channels: ["email"],
      },
    ],
  },
  {
    id: "reminders",
    title: "Reminders",
    icon: Clock,
    notifications: [
      {
        id: "push_booking_reminder",
        label: "Upcoming booking reminder",
        description: "Remind about bookings 1 hour before",
        channels: ["push"],
      },
      {
        id: "push_table_ready",
        label: "Table ready notification",
        description: "Notify when a table becomes available",
        channels: ["push"],
      },
    ],
  },
  {
    id: "reports",
    title: "Reports & Summaries",
    icon: TrendingUp,
    notifications: [
      {
        id: "email_daily_summary",
        label: "Daily summary",
        description: "Daily overview of bookings and performance",
        channels: ["email"],
      },
      {
        id: "email_weekly_report",
        label: "Weekly report",
        description: "Comprehensive weekly analytics report",
        channels: ["email"],
      },
    ],
  },
]

export default function NotificationSettingsPage() {
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
          .select("restaurant_id, user_id")
          .eq("user_id", user.id)
          .single()
        
        if (staffData) {
          setRestaurantId(staffData.restaurant_id)
        }
      }
    }
    getRestaurantId()
  }, [supabase])

  // Fetch notification settings
  const { data: notificationSettings, isLoading } = useQuery({
    queryKey: ["notification-settings", restaurantId],
    queryFn: async () => {
      if (!restaurantId) return null
      
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return null

      const { data, error } = await supabase
        .from("notification_preferences")
        .select("*")
        .eq("restaurant_id", restaurantId)
        .eq("user_id", user.id)
        .single()

      if (error && error.code !== "PGRST116") throw error
      
      // Return default settings if none exist
      return data || {
        email_new_booking: true,
        email_booking_cancelled: true,
        email_booking_modified: true,
        email_new_review: true,
        email_new_vip: true,
        email_daily_summary: false,
        email_weekly_report: true,
        sms_new_booking: false,
        sms_booking_cancelled: false,
        sms_no_show_alert: false,
        push_new_booking: true,
        push_booking_reminder: true,
        push_table_ready: true,
        app_all_activities: true,
        app_mention_only: false,
        quiet_hours_enabled: false,
        quiet_hours_start: "22:00",
        quiet_hours_end: "08:00",
        summary_frequency: "weekly",
        summary_time: "09:00",
      }
    },
    enabled: !!restaurantId,
  })

  // Form
  const form = useForm<NotificationSettingsData>({
    resolver: zodResolver(notificationSettingsSchema),
    defaultValues: {
      email_new_booking: true,
      email_booking_cancelled: true,
      email_booking_modified: true,
      email_new_review: true,
      email_new_vip: true,
      email_daily_summary: false,
      email_weekly_report: true,
      sms_new_booking: false,
      sms_booking_cancelled: false,
      sms_no_show_alert: false,
      push_new_booking: true,
      push_booking_reminder: true,
      push_table_ready: true,
      app_all_activities: true,
      app_mention_only: false,
      quiet_hours_enabled: false,
      quiet_hours_start: "22:00",
      quiet_hours_end: "08:00",
      summary_frequency: "weekly",
      summary_time: "09:00",
    },
  })

  // Update form when settings load
  useEffect(() => {
    if (notificationSettings) {
      form.reset(notificationSettings)
    }
  }, [notificationSettings, form])

  // Update settings mutation
  const updateSettingsMutation = useMutation({
    mutationFn: async (data: NotificationSettingsData) => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error("Not authenticated")

      const { error } = await supabase
        .from("notification_preferences")
        .upsert({
          restaurant_id: restaurantId,
          user_id: user.id,
          ...data,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: "restaurant_id,user_id",
        })

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notification-settings"] })
      toast.success("Notification settings updated")
    },
    onError: () => {
      toast.error("Failed to update settings")
    },
  })

  const watchQuietHours = form.watch("quiet_hours_enabled")

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
        <h1 className="text-3xl font-bold tracking-tight">Notification Settings</h1>
        <p className="text-muted-foreground">
          Manage how and when you receive notifications
        </p>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit((data) => updateSettingsMutation.mutate(data))} className="space-y-6">
          {/* Notification Categories */}
          {NOTIFICATION_CATEGORIES.map((category) => (
            <Card key={category.id}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <category.icon className="h-5 w-5" />
                  {category.title}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {category.notifications.map((notification) => (
                  <div key={notification.id} className="space-y-3">
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <label className="text-sm font-medium leading-none">
                          {notification.label}
                        </label>
                        <p className="text-sm text-muted-foreground">
                          {notification.description}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-4">
                      {notification.channels.includes("email") && (
                        <FormField
                          control={form.control}
                          name={notification.id as keyof NotificationSettingsData}
                          render={({ field }) => (
                            <FormItem className="flex items-center space-x-2">
                              <FormControl>
                                <Switch
                                  checked={field.value as boolean}
                                  onCheckedChange={field.onChange}
                                  disabled={updateSettingsMutation.isPending}
                                />
                              </FormControl>
                              <FormLabel className="text-sm font-normal flex items-center gap-1">
                                <Mail className="h-3 w-3" />
                                Email
                              </FormLabel>
                            </FormItem>
                          )}
                        />
                      )}
                      {notification.channels.includes("sms") && (
                        <FormField
                          control={form.control}
                          name={`sms_${notification.id.split("_").slice(1).join("_")}` as keyof NotificationSettingsData}
                          render={({ field }) => (
                            <FormItem className="flex items-center space-x-2">
                              <FormControl>
                                <Switch
                                  checked={field.value as boolean}
                                  onCheckedChange={field.onChange}
                                  disabled={updateSettingsMutation.isPending}
                                />
                              </FormControl>
                              <FormLabel className="text-sm font-normal flex items-center gap-1">
                                <MessageSquare className="h-3 w-3" />
                                SMS
                              </FormLabel>
                            </FormItem>
                          )}
                        />
                      )}
                      {notification.channels.includes("push") && (
                        <FormField
                          control={form.control}
                          name={`push_${notification.id.split("_").slice(1).join("_")}` as keyof NotificationSettingsData}
                          render={({ field }) => (
                            <FormItem className="flex items-center space-x-2">
                              <FormControl>
                                <Switch
                                  checked={field.value as boolean}
                                  onCheckedChange={field.onChange}
                                  disabled={updateSettingsMutation.isPending}
                                />
                              </FormControl>
                              <FormLabel className="text-sm font-normal flex items-center gap-1">
                                <Smartphone className="h-3 w-3" />
                                Push
                              </FormLabel>
                            </FormItem>
                          )}
                        />
                      )}
                    </div>
                    <Separator />
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}

          {/* Quiet Hours */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Volume2 className="h-5 w-5" />
                Quiet Hours
              </CardTitle>
              <CardDescription>
                Pause non-urgent notifications during specified hours
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="quiet_hours_enabled"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">Enable Quiet Hours</FormLabel>
                      <FormDescription>
                        Only critical notifications will be sent during quiet hours
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        disabled={updateSettingsMutation.isPending}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
              
              {watchQuietHours && (
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="quiet_hours_start"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Start Time</FormLabel>
                        <FormControl>
                          <input
                            type="time"
                            {...field}
                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                            disabled={updateSettingsMutation.isPending}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="quiet_hours_end"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>End Time</FormLabel>
                        <FormControl>
                          <input
                            type="time"
                            {...field}
                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                            disabled={updateSettingsMutation.isPending}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>
              )}
            </CardContent>
          </Card>

          {/* Summary Settings */}
          <Card>
            <CardHeader>
              <CardTitle>Summary & Reports</CardTitle>
              <CardDescription>
                Configure how often you receive summary reports
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="summary_frequency"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Summary Frequency</FormLabel>
                      <Select
                        value={field.value}
                        onValueChange={field.onChange}
                        disabled={updateSettingsMutation.isPending}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="daily">Daily</SelectItem>
                          <SelectItem value="weekly">Weekly</SelectItem>
                          <SelectItem value="monthly">Monthly</SelectItem>
                          <SelectItem value="never">Never</SelectItem>
                        </SelectContent>
                      </Select>
                    </FormItem>
                  )}
                />
                
                {form.watch("summary_frequency") !== "never" && (
                  <FormField
                    control={form.control}
                    name="summary_time"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Delivery Time</FormLabel>
                        <FormControl>
                          <input
                            type="time"
                            {...field}
                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                            disabled={updateSettingsMutation.isPending}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                )}
              </div>
            </CardContent>
          </Card>

          {/* In-App Notifications */}
          <Card>
            <CardHeader>
              <CardTitle>In-App Notifications</CardTitle>
              <CardDescription>
                Control what appears in your notification center
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="app_all_activities"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">All Activities</FormLabel>
                      <FormDescription>
                        Show all restaurant activities in notification center
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        disabled={updateSettingsMutation.isPending}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="app_mention_only"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">Mentions Only</FormLabel>
                      <FormDescription>
                        Only notify when you're directly mentioned or assigned
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        disabled={updateSettingsMutation.isPending || form.watch("app_all_activities")}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* Save Button */}
          <div className="flex justify-end">
            <Button type="submit" disabled={updateSettingsMutation.isPending}>
              <Save className="mr-2 h-4 w-4" />
              {updateSettingsMutation.isPending ? "Saving..." : "Save Settings"}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  )
}