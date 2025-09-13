// app/(dashboard)/vip/[userId]/page.tsx
"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useParams, useRouter } from "next/navigation"
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle 
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { 
  Form, 
  FormControl, 
  FormDescription, 
  FormField, 
  FormItem, 
  FormLabel, 
  FormMessage 
} from "@/components/ui/form"
import { toast } from "react-hot-toast"
import { ArrowLeft, Edit, Trash2, Crown, Star, TrendingUp, Calendar as CalendarIcon, Mail, Phone } from "lucide-react"
import { format, addDays } from "date-fns"
import { cn, titleCase } from "@/lib/utils"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import * as z from "zod"

// Type definitions
type Profile = {
  id: string
  full_name: string
  email?: string
  phone_number?: string
  avatar_url?: string
  loyalty_points: number
  total_bookings: number
  completed_bookings: number
}

type RestaurantVIPUser = {
  id: string
  restaurant_id: string
  user_id: string
  extended_booking_days: number
  priority_booking: boolean
  valid_until: string
  created_at: string
  user?: Profile
}

type Booking = {
  id: string
  user_id: string
  restaurant_id: string
  booking_time: string
  party_size: number
  status: string
  table_ids?: string[]
}

const vipFormSchema = z.object({
  extendedBookingDays: z.number().min(30).max(365),
  validUntil: z.date(),
  priorityBooking: z.boolean(),
})

type VIPFormData = z.infer<typeof vipFormSchema>

export default function VIPUserDetailPage() {
  const { userId } = useParams()
  const router = useRouter()
  const supabase = createClient()
  const queryClient = useQueryClient()

  const [isEditing, setIsEditing] = useState(false)
  const [restaurantId, setRestaurantId] = useState<string>("")

  // Get restaurant ID
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

  // Fetch VIP user details
  const { data: vipUser, isLoading: vipLoading } = useQuery({
    queryKey: ["vip-user", userId, restaurantId],
    queryFn: async () => {
      if (!restaurantId) return null

      const { data, error } = await supabase
        .from("restaurant_vip_users")
        .select(`
          *,
          user:profiles(*)
        `)
        .eq("user_id", userId)
        .eq("restaurant_id", restaurantId)
        .single()

      if (error) throw error
      
      // Get email from auth.users
      const { data: authUser } = await supabase.auth.admin.getUserById(userId as string)
      
      return {
        ...data,
        user: {
          ...data.user,
          email: authUser?.user?.email
        }
      } as RestaurantVIPUser
    },
    enabled: !!userId && !!restaurantId,
  })

  // Fetch user's bookings at this restaurant
  const { data: bookings, isLoading: bookingsLoading } = useQuery({
    queryKey: ["user-bookings", userId, restaurantId],
    queryFn: async () => {
      if (!restaurantId) return []

      const { data, error } = await supabase
        .from("bookings")
        .select(`
          *,
          booking_tables(
            table_id,
            table:restaurant_tables(table_number)
          )
        `)
        .eq("user_id", userId)
        .eq("restaurant_id", restaurantId)
        .order("booking_time", { ascending: false })
        .limit(5)
      
      if (error) throw error
      return data as any[]
    },
    enabled: !!userId && !!restaurantId,
  })

  const form = useForm<VIPFormData>({
    resolver: zodResolver(vipFormSchema),
    defaultValues: {
      extendedBookingDays: 60,
      validUntil: addDays(new Date(), 365),
      priorityBooking: true,
    },
  })

  useEffect(() => {
    if (vipUser) {
      form.reset({
        extendedBookingDays: vipUser.extended_booking_days,
        validUntil: new Date(vipUser.valid_until),
        priorityBooking: vipUser.priority_booking,
      })
    }
  }, [vipUser, form])

  const vipMutation = useMutation({
    mutationFn: async (data: VIPFormData) => {
      const { error } = await supabase
        .from("restaurant_vip_users")
        .update({
          extended_booking_days: data.extendedBookingDays,
          priority_booking: data.priorityBooking,
          valid_until: data.validUntil.toISOString(),
        })
        .eq("id", vipUser!.id)
      
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vip-user", userId] })
      queryClient.invalidateQueries({ queryKey: ["vip-users"] })
      toast.success("VIP benefits updated")
      setIsEditing(false)
    },
    onError: () => {
      toast.error("Failed to update VIP benefits")
    },
  })

  const removeVIPMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("restaurant_vip_users")
        .update({ valid_until: new Date().toISOString() })
        .eq("id", vipUser!.id)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vip-users"] })
      toast.success("VIP status removed")
      router.push("/vip")
    },
    onError: () => {
      toast.error("Failed to remove VIP status")
    },
  })

  if (vipLoading) {
    return <div className="flex justify-center items-center h-64">Loading VIP details...</div>
  }

  if (!vipUser) {
    return <div className="flex justify-center items-center h-64">VIP user not found.</div>
  }

  const user = vipUser.user

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <Button variant="outline" onClick={() => router.back()}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to VIP List
        </Button>
        <div className="flex gap-2">
          <Button onClick={() => setIsEditing(true)}>
            <Edit className="mr-2 h-4 w-4" />
            Edit Benefits
          </Button>
          <Button 
            variant="destructive"
            onClick={() => {
              if (confirm("Are you sure you want to remove VIP status from this user?")) {
                removeVIPMutation.mutate()
              }
            }}
            disabled={removeVIPMutation.isPending}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Remove VIP
          </Button>
        </div>
      </div>

      <Dialog open={isEditing} onOpenChange={setIsEditing}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit VIP Benefits</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit((data) => vipMutation.mutate(data))} className="space-y-4">
              <FormField
                control={form.control}
                name="extendedBookingDays"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Extended Booking Days</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        {...field}
                        onChange={(e) => field.onChange(parseInt(e.target.value))}
                        disabled={vipMutation.isPending}
                      />
                    </FormControl>
                    <FormDescription>How many days in advance can they book (30-365)</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="validUntil"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Valid Until</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant="outline"
                            className={cn("w-full pl-3 text-left font-normal", !field.value && "text-muted-foreground")}
                            disabled={vipMutation.isPending}
                          >
                            {field.value ? format(field.value, "PPP") : <span>Pick a date</span>}
                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={field.value}
                          onSelect={field.onChange}
                          disabled={(date) => date < new Date()}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                    <FormDescription>When the VIP status expires</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setIsEditing(false)} disabled={vipMutation.isPending}>
                  Cancel
                </Button>
                <Button type="submit" disabled={vipMutation.isPending}>
                  {vipMutation.isPending ? "Saving..." : "Save Changes"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <div className="grid lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1 space-y-8">
          <Card>
            <CardHeader className="flex flex-col items-center text-center">
              <Avatar className="h-24 w-24 mb-4">
                <AvatarImage src={user?.avatar_url} />
                <AvatarFallback className="text-3xl">
                  {user?.full_name?.split(" ").map((n: string) => n[0]).join("") || "?"}
                </AvatarFallback>
              </Avatar>
              <CardTitle className="text-2xl">{user?.full_name || "Unknown"}</CardTitle>
              <Badge>VIP Customer</Badge>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-2">
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4" />
                <span>{user?.email || "No email"}</span>
              </div>
              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4" />
                <span>{user?.phone_number || "Not provided"}</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>VIP Benefits</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="font-medium">Status</span>
                <Badge variant={new Date(vipUser.valid_until) > new Date() ? "default" : "secondary"}>
                  {new Date(vipUser.valid_until) > new Date() ? "Active" : "Expired"}
                </Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="font-medium">Expires On</span>
                <span>{format(new Date(vipUser.valid_until), "PPP")}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="font-medium">Adv. Booking</span>
                <span>{vipUser.extended_booking_days} days</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="font-medium">Priority Access</span>
                <span>{vipUser.priority_booking ? "Yes" : "No"}</span>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-2 space-y-8">
          <Card>
            <CardHeader>
              <CardTitle>Customer Stats</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-2xl font-bold">{user?.total_bookings || 0}</p>
                <p className="text-sm text-muted-foreground">Total Bookings</p>
              </div>
              <div>
                <p className="text-2xl font-bold">{user?.completed_bookings || 0}</p>
                <p className="text-sm text-muted-foreground">Completed</p>
              </div>
              <div>
                <p className="text-2xl font-bold">{user?.loyalty_points || 0}</p>
                <p className="text-sm text-muted-foreground">Loyalty Points</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Recent Bookings</CardTitle>
              <CardDescription>Last 5 bookings at your restaurant</CardDescription>
            </CardHeader>
            <CardContent>
              {bookingsLoading ? (
                <p>Loading bookings...</p>
              ) : bookings && bookings.length > 0 ? (
                <ul className="space-y-4">
                  {bookings.map((booking: any) => (
                    <li key={booking.id} className="flex justify-between items-center p-3 bg-muted rounded-lg">
                      <div>
                        <p className="font-medium">
                          Table {booking.booking_tables?.[0]?.table?.table_number || "N/A"}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {format(new Date(booking.booking_time), "PPP, p")}
                        </p>
                      </div>
                      <Badge variant={booking.status === 'confirmed' ? 'default' : 'secondary'}>
                        {titleCase(booking.status)}
                      </Badge>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-center text-muted-foreground py-4">No recent bookings found.</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}