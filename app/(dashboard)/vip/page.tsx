// app/(dashboard)/vip/page.tsx
"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { toast } from "react-hot-toast"
import { Plus, Search, Crown, Calendar as CalendarIcon, UserPlus, Star, TrendingUp, X } from "lucide-react"
import { format, addDays } from "date-fns"
import { cn } from "@/lib/utils"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import * as z from "zod"
import { useRouter } from "next/navigation"

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

const vipFormSchema = z.object({
  userEmail: z.string().email("Invalid email address"),
  extendedBookingDays: z.number().min(30).max(365),
  validUntil: z.date(),
  priorityBooking: z.boolean(),
})

type VIPFormData = z.infer<typeof vipFormSchema>

export default function VIPPage() {
  const [searchQuery, setSearchQuery] = useState("")
  const [isAddingVIP, setIsAddingVIP] = useState(false)
  const router = useRouter()
  
  const supabase = createClient()
  const queryClient = useQueryClient()

  // Get restaurant ID
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

  // Fetch VIP users with proper user data
  const { data: vipUsers, isLoading } = useQuery({
    queryKey: ["vip-users", restaurantId],
    queryFn: async () => {
      if (!restaurantId) return []
      
      const { data, error } = await supabase
        .from("restaurant_vip_users")
        .select(`
          *,
          user:profiles(
            id,
            full_name,
            phone_number,
            avatar_url,
            loyalty_points,
            total_bookings,
            completed_bookings
          )
        `)
        .eq("restaurant_id", restaurantId)
        .gte("valid_until", new Date().toISOString())
        .order("created_at", { ascending: false })

      if (error) {
        console.error("Error fetching VIP users:", error)
        throw error
      }
      
      return (data || []) as RestaurantVIPUser[]
    },
    enabled: !!restaurantId,
  })

  // Add VIP form
  const form = useForm<VIPFormData>({
    resolver: zodResolver(vipFormSchema),
    defaultValues: {
      userEmail: "",
      extendedBookingDays: 60,
      validUntil: addDays(new Date(), 365),
      priorityBooking: true,
    },
  })

  // Add VIP user mutation
  const addVIPMutation = useMutation({
    mutationFn: async (data: VIPFormData) => {
      // First, find the user by email in profiles table
      // Note: We can't directly access auth.users from client side
      // We need to search by a field that exists in profiles
      // For now, let's search by the provided email in guest bookings or use a different approach
      
      // Check if user exists by searching bookings with guest_email
      const { data: existingBookings } = await supabase
        .from("bookings")
        .select("user_id, profiles!bookings_user_id_fkey(id, full_name)")
        .eq("guest_email", data.userEmail)
        .not("user_id", "is", null)
        .limit(1)

      let userId = null
      if (existingBookings && existingBookings.length > 0) {
        userId = existingBookings[0].user_id
      } else {
        throw new Error("User not found. Please ensure the user has made at least one booking with this email.")
      }

      // Check if already VIP
      const { data: existingVIP } = await supabase
        .from("restaurant_vip_users")
        .select("id")
        .eq("restaurant_id", restaurantId)
        .eq("user_id", userId)
        .gte("valid_until", new Date().toISOString())
        .single()

      if (existingVIP) {
        throw new Error("User is already a VIP")
      }

      // Add VIP status
      const { error } = await supabase
        .from("restaurant_vip_users")
        .insert({
          restaurant_id: restaurantId,
          user_id: userId,
          extended_booking_days: data.extendedBookingDays,
          priority_booking: data.priorityBooking,
          valid_until: data.validUntil.toISOString(),
        })

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vip-users"] })
      toast.success("VIP user added successfully")
      setIsAddingVIP(false)
      form.reset()
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to add VIP user")
    },
  })

  // Remove VIP status
  const removeVIPMutation = useMutation({
    mutationFn: async (vipId: string) => {
      const { error } = await supabase
        .from("restaurant_vip_users")
        .update({ valid_until: new Date().toISOString() })
        .eq("id", vipId)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vip-users"] })
      toast.success("VIP status removed")
    },
    onError: () => {
      toast.error("Failed to remove VIP status")
    },
  })

  // Filter VIP users based on search
  const filteredVIPUsers = vipUsers?.filter((vip) => {
    if (!searchQuery) return true
    
    const searchLower = searchQuery.toLowerCase()
    const userName = vip.user?.full_name?.toLowerCase() || ""
    const userEmail = vip.user?.email?.toLowerCase() || ""
    const userPhone = vip.user?.phone_number?.toLowerCase() || ""
    
    return (
      userName.includes(searchLower) ||
      userEmail.includes(searchLower) ||
      userPhone.includes(searchLower)
    )
  })

  // Get VIP statistics
  const getVIPStats = () => {
    if (!vipUsers) return { total: 0, active: 0, expiringSoon: 0, avgBookings: 0 }
    
    const now = new Date()
    const thirtyDaysFromNow = addDays(now, 30)
    
    const active = vipUsers.filter(vip => new Date(vip.valid_until) > now)
    const expiringSoon = active.filter(vip => 
      new Date(vip.valid_until) <= thirtyDaysFromNow
    )
    
    const totalBookings = vipUsers.reduce((sum, vip) => 
      sum + (vip.user?.completed_bookings || 0), 0
    )
    const avgBookings = vipUsers.length > 0 ? totalBookings / vipUsers.length : 0
    
    return {
      total: vipUsers.length,
      active: active.length,
      expiringSoon: expiringSoon.length,
      avgBookings: Math.round(avgBookings),
    }
  }

  const stats = getVIPStats()

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">VIP Customers</h1>
          <p className="text-muted-foreground">
            Manage your restaurant's VIP customers and their benefits
          </p>
        </div>
        <Dialog open={isAddingVIP} onOpenChange={setIsAddingVIP}>
          <DialogTrigger asChild>
            <Button>
              <UserPlus className="mr-2 h-4 w-4" />
              Add VIP
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add VIP Customer</DialogTitle>
              <DialogDescription>
                Grant VIP status to a customer with extended booking privileges
              </DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit((data) => addVIPMutation.mutate(data))} className="space-y-4">
                <FormField
                  control={form.control}
                  name="userEmail"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Customer Email</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="customer@email.com"
                          {...field}
                          disabled={addVIPMutation.isPending}
                        />
                      </FormControl>
                      <FormDescription>
                        The email address of the registered customer
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
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
                          disabled={addVIPMutation.isPending}
                        />
                      </FormControl>
                      <FormDescription>
                        How many days in advance can they book (30-365)
                      </FormDescription>
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
                              className={cn(
                                "w-full pl-3 text-left font-normal",
                                !field.value && "text-muted-foreground"
                              )}
                              disabled={addVIPMutation.isPending}
                            >
                              {field.value ? (
                                format(field.value, "PPP")
                              ) : (
                                <span>Pick a date</span>
                              )}
                              <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={field.value}
                            onSelect={field.onChange}
                            disabled={(date) =>
                              date < new Date()
                            }
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                      <FormDescription>
                        When the VIP status expires
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <div className="flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsAddingVIP(false)}
                    disabled={addVIPMutation.isPending}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={addVIPMutation.isPending}>
                    {addVIPMutation.isPending ? "Adding..." : "Add VIP"}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Statistics */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total VIPs</CardTitle>
            <Crown className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active VIPs</CardTitle>
            <Star className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.active}</div>
            <p className="text-xs text-muted-foreground">
              Currently active
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Expiring Soon</CardTitle>
            <CalendarIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.expiringSoon}</div>
            <p className="text-xs text-muted-foreground">
              Within 30 days
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg. Bookings</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.avgBookings}</div>
            <p className="text-xs text-muted-foreground">
              Per VIP customer
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Search and Table */}
      <Card>
        <CardHeader>
          <CardTitle>VIP Customers</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by name, email, or phone..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          {/* VIP Users Table */}
          {isLoading ? (
            <div className="text-center py-8">Loading VIP users...</div>
          ) : filteredVIPUsers?.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {searchQuery ? "No VIP users found matching your search" : "No VIP users yet"}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Customer</TableHead>
                  <TableHead>Benefits</TableHead>
                  <TableHead>Stats</TableHead>
                  <TableHead>Valid Until</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredVIPUsers?.map((vip) => (
                  <TableRow 
                    key={vip.id}
                    className="cursor-pointer"
                    onClick={() => router.push(`/vip/${vip.user_id}`)}
                  >
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-10 w-10">
                          <AvatarImage src={vip.user?.avatar_url} />
                          <AvatarFallback>
                            {vip.user?.full_name?.split(" ").map(n => n[0]).join("") || "?"}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="font-medium">{vip.user?.full_name || "Unknown"}</div>
                          <div className="text-sm text-muted-foreground">
                            {vip.user?.email || "No email"}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <Badge variant="secondary" className="text-xs">
                          {vip.extended_booking_days} days advance booking
                        </Badge>
                        {vip.priority_booking && (
                          <Badge variant="secondary" className="text-xs">
                            Priority access
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        <div>{vip.user?.completed_bookings || 0} bookings</div>
                        <div className="text-muted-foreground">
                          {vip.user?.loyalty_points || 0} points
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        {format(new Date(vip.valid_until), "PPP")}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation()
                          removeVIPMutation.mutate(vip.id)
                        }}
                        disabled={removeVIPMutation.isPending}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}