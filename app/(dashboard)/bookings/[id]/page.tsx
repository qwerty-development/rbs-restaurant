// app/(dashboard)/bookings/[id]/page.tsx
"use client"

import { useState, useEffect } from "react"
import { useRouter, useParams } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { format } from "date-fns"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert"
import { Label } from "@/components/ui/label"
import { toast } from "react-hot-toast"
import { 
  ArrowLeft,
  Calendar,
  Clock,
  Users,
  Phone,
  Mail,
  MessageSquare,
  CheckCircle,
  XCircle,
  AlertCircle,
  Edit,
  MoreVertical,
  Printer,
  Copy,
  Ban,
  UserX,
  CreditCard,
  Utensils,
  Star,
  Hash,
  Plus,
  Gift,
  Crown,
  Award
} from "lucide-react"
import { cn } from "@/lib/utils"

const STATUS_OPTIONS = [
  { value: "pending", label: "Pending", icon: AlertCircle, color: "text-yellow-600" },
  { value: "confirmed", label: "Confirmed", icon: CheckCircle, color: "text-green-600" },
  { value: "completed", label: "Completed", icon: CheckCircle, color: "text-blue-600" },
  { value: "cancelled_by_user", label: "Cancelled by Customer", icon: XCircle, color: "text-red-600" },
  { value: "declined_by_restaurant", label: "Declined by Restaurant", icon: Ban, color: "text-red-600" },
  { value: "no_show", label: "No Show", icon: UserX, color: "text-gray-600" },
]

type BookingUser = {
  id: string
  full_name: string
  phone_number: string | null
  avatar_url: string | null
  loyalty_points: number
  membership_tier: string
  total_bookings: number
  completed_bookings: number
  user_rating: number
}

type BookingTable = {
  table: {
    id: string
    table_number: string
    capacity: number
    table_type: string
  }
}

type BookingOffer = {
  title: string
  discount_percentage: number
}

type Booking = {
  id: string
  user_id: string
  restaurant_id: string
  booking_time: string
  party_size: number
  status: string
  special_requests: string | null
  occasion: string | null
  dietary_notes: string[] | null
  confirmation_code: string
  table_preferences: string[] | null
  reminder_sent: boolean
  checked_in_at: string | null
  loyalty_points_earned: number
  created_at: string
  updated_at: string
  applied_offer_id: string | null
  expected_loyalty_points: number
  guest_name: string | null
  guest_email: string | null
  guest_phone: string | null
  is_group_booking: boolean
  organizer_id: string | null
  attendees: number
  turn_time_minutes: number
  user: BookingUser | null
  restaurant: {
    id: string
    name: string
    phone_number: string | null
  }
  tables: BookingTable[]
  offer: BookingOffer | null
}

type BookingStatusHistory = {
  id: string
  booking_id: string
  old_status: string | null
  new_status: string
  changed_by: string | null
  changed_at: string
  reason: string | null
  metadata: any
  changed_by_profile: {
    full_name: string
  } | null
}

export default function BookingDetailsPage() {
  const router = useRouter()
  const params = useParams()
  const bookingId = params.id as string
  const supabase = createClient()
  const queryClient = useQueryClient()
  
  const [isEditingStatus, setIsEditingStatus] = useState(false)
  const [newStatus, setNewStatus] = useState("")
  const [statusReason, setStatusReason] = useState("")

  // Fetch booking details
  const { data: booking, isLoading } = useQuery({
    queryKey: ["booking", bookingId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bookings")
        .select(`
          *,
          user:profiles(
            id,
            full_name,
            phone_number,
            avatar_url,
            loyalty_points,
            membership_tier,
            total_bookings,
            completed_bookings,
            user_rating
          ),
          restaurant:restaurants(
            id,
            name,
            phone_number
          ),
          tables:booking_tables(
            table:restaurant_tables(
              id,
              table_number,
              capacity,
              table_type
            )
          ),
          offer:special_offers(
            title,
            discount_percentage
          )
        `)
        .eq("id", bookingId)
        .single()

      if (error) throw error
      return data as Booking
    },
  })

  // Fetch booking status history
  const { data: bookingHistory } = useQuery({
    queryKey: ["booking-status-history", bookingId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("booking_status_history")
        .select(`
          *,
          changed_by_profile:profiles!booking_status_history_changed_by_fkey(full_name)
        `)
        .eq("booking_id", bookingId)
        .order("changed_at", { ascending: false })

      if (error) throw error
      return data as BookingStatusHistory[]
    },
    enabled: !!booking,
  })

  // Update booking status mutation
  const updateStatusMutation = useMutation({
    mutationFn: async ({ status, reason }: { status: string; reason?: string }) => {
      const { data: { user } } = await supabase.auth.getUser()
      
      // Update booking status
      const { error: bookingError } = await supabase
        .from("bookings")
        .update({
          status,
          updated_at: new Date().toISOString(),
        })
        .eq("id", bookingId)

      if (bookingError) throw bookingError

      // Add to status history
      const { error: historyError } = await supabase
        .from("booking_status_history")
        .insert({
          booking_id: bookingId,
          old_status: booking?.status,
          new_status: status,
          changed_by: user?.id,
          reason: reason || null,
          metadata: reason ? { reason } : {},
        })

      if (historyError) throw historyError
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["booking", "booking-status-history"] })
      toast.success("Booking status updated")
      setIsEditingStatus(false)
      setStatusReason("")
      setNewStatus("")
    },
    onError: (error) => {
      console.error("Failed to update booking status:", error)
      toast.error("Failed to update booking status")
    },
  })

  // Mark as no-show mutation
  const markNoShowMutation = useMutation({
    mutationFn: async () => {
      await updateStatusMutation.mutateAsync({ 
        status: "no_show",
        reason: "Customer did not arrive" 
      })
    },
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p>Loading booking details...</p>
        </div>
      </div>
    )
  }

  if (!booking) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">Booking Not Found</h2>
          <p className="text-muted-foreground mb-4">
            The booking you're looking for doesn't exist or you don't have permission to view it.
          </p>
          <Button onClick={() => router.push("/dashboard/bookings")}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Bookings
          </Button>
        </div>
      </div>
    )
  }

  const statusConfig = STATUS_OPTIONS.find(s => s.value === booking.status)
  const StatusIcon = statusConfig?.icon || AlertCircle

  // Calculate booking age
  const bookingAge = Math.floor(
    (new Date().getTime() - new Date(booking.created_at).getTime()) / (1000 * 60 * 60 * 24)
  )

  // Copy confirmation code
  const copyConfirmationCode = () => {
    navigator.clipboard.writeText(booking.confirmation_code)
    toast.success("Confirmation code copied")
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <Button
          variant="ghost"
          className="mb-4"
          onClick={() => router.push("/dashboard/bookings")}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Bookings
        </Button>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Booking Details</h1>
            <p className="text-muted-foreground">
              View and manage booking information
            </p>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Actions</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem>
                <Printer className="mr-2 h-4 w-4" />
                Print Details
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Mail className="mr-2 h-4 w-4" />
                Send Confirmation
              </DropdownMenuItem>
              {booking.status === "confirmed" && (
                <DropdownMenuItem
                  className="text-destructive"
                  onClick={() => markNoShowMutation.mutate()}
                >
                  <UserX className="mr-2 h-4 w-4" />
                  Mark as No Show
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Status Alert */}
      {booking.status === "pending" && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Action Required</AlertTitle>
          <AlertDescription>
            This booking is pending confirmation. Please review and confirm or decline.
          </AlertDescription>
        </Alert>
      )}

      {/* Main Content Grid */}
      <div className="grid gap-6 md:grid-cols-[2fr_1fr]">
        <div className="space-y-6">
          {/* Booking Overview */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Booking Information</CardTitle>
                <div className="flex items-center gap-2">
                  <Badge
                    variant="outline"
                    className={cn("gap-1", statusConfig?.color)}
                  >
                    <StatusIcon className="h-3 w-3" />
                    {statusConfig?.label}
                  </Badge>
                  <Dialog open={isEditingStatus} onOpenChange={setIsEditingStatus}>
                    <DialogTrigger asChild>
                      <Button variant="ghost" size="sm">
                        <Edit className="h-4 w-4" />
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Update Booking Status</DialogTitle>
                        <DialogDescription>
                          Change the status of this booking
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div>
                          <Label>New Status</Label>
                          <Select value={newStatus} onValueChange={setNewStatus}>
                            <SelectTrigger>
                              <SelectValue placeholder="Select status" />
                            </SelectTrigger>
                            <SelectContent>
                              {STATUS_OPTIONS.map((option) => (
                                <SelectItem key={option.value} value={option.value}>
                                  <div className="flex items-center gap-2">
                                    <option.icon className={cn("h-4 w-4", option.color)} />
                                    {option.label}
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        
                        {(newStatus.includes("cancelled") || newStatus === "no_show") && (
                          <div>
                            <Label>Reason</Label>
                            <Textarea
                              placeholder="Provide a reason for this status change..."
                              value={statusReason}
                              onChange={(e) => setStatusReason(e.target.value)}
                              rows={3}
                            />
                          </div>
                        )}
                      </div>
                      <DialogFooter>
                        <Button
                          variant="outline"
                          onClick={() => {
                            setIsEditingStatus(false)
                            setNewStatus("")
                            setStatusReason("")
                          }}
                        >
                          Cancel
                        </Button>
                        <Button
                          onClick={() => updateStatusMutation.mutate({
                            status: newStatus,
                            reason: statusReason,
                          })}
                          disabled={!newStatus || updateStatusMutation.isPending}
                        >
                          {updateStatusMutation.isPending ? "Updating..." : "Update Status"}
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Confirmation Code */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Hash className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Confirmation Code</span>
                </div>
                <div className="flex items-center gap-2">
                  <code className="font-mono text-sm font-semibold bg-muted px-2 py-1 rounded">
                    {booking.confirmation_code}
                  </code>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={copyConfirmationCode}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <Separator />

              {/* Date & Time */}
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Date</p>
                    <p className="font-medium">
                      {format(new Date(booking.booking_time), "EEEE, MMMM d, yyyy")}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Time</p>
                    <p className="font-medium">
                      {format(new Date(booking.booking_time), "h:mm a")}
                    </p>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Party Details */}
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Party Size</p>
                    <p className="font-medium">{booking.party_size} guests</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Utensils className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Tables</p>
                    <p className="font-medium">
                      {booking.tables?.length > 0 
                        ? booking.tables.map(t => `Table ${t.table.table_number}`).join(", ")
                        : "Not assigned"
                      }
                    </p>
                  </div>
                </div>
              </div>

              {/* Turn Time */}
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Turn Time</p>
                  <p className="font-medium">{booking.turn_time_minutes} minutes</p>
                </div>
              </div>

              {/* Special Requests */}
              {booking.special_requests && (
                <>
                  <Separator />
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <MessageSquare className="h-4 w-4 text-muted-foreground" />
                      <p className="text-sm text-muted-foreground">Special Requests</p>
                    </div>
                    <p className="text-sm bg-muted p-3 rounded-lg">{booking.special_requests}</p>
                  </div>
                </>
              )}

              {/* Occasion */}
              {booking.occasion && (
                <>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Gift className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">Occasion</span>
                    </div>
                    <Badge variant="secondary" className="capitalize">
                      {booking.occasion}
                    </Badge>
                  </div>
                </>
              )}

              {/* Dietary Notes */}
              {booking.dietary_notes && booking.dietary_notes.length > 0 && (
                <>
                  <Separator />
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <AlertCircle className="h-4 w-4 text-muted-foreground" />
                      <p className="text-sm text-muted-foreground">Dietary Requirements</p>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {booking.dietary_notes.map((note, index) => (
                        <Badge key={index} variant="outline" className="text-xs">
                          {note}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {/* Offer Applied */}
              {booking.offer && (
                <>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CreditCard className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">Special Offer</span>
                    </div>
                    <Badge variant="secondary" className="bg-green-100 text-green-800">
                      {booking.offer.title} - {booking.offer.discount_percentage}% off
                    </Badge>
                  </div>
                </>
              )}

              {/* Loyalty Points */}
              {booking.loyalty_points_earned > 0 && (
                <>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Award className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">Loyalty Points Earned</span>
                    </div>
                    <Badge variant="secondary" className="bg-purple-100 text-purple-800">
                      +{booking.loyalty_points_earned} points
                    </Badge>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Customer Information */}
          <Card>
            <CardHeader>
              <CardTitle>Customer Information</CardTitle>
            </CardHeader>
            <CardContent>
              {booking.user ? (
                <div className="space-y-4">
                  <div className="flex items-start gap-4">
                    <Avatar className="h-12 w-12">
                      <AvatarImage src={booking.user.avatar_url || undefined} />
                      <AvatarFallback>
                        {booking.user.full_name?.split(" ").map(n => n[0]).join("").toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <h4 className="font-semibold">{booking.user.full_name}</h4>
                      <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Mail className="h-3 w-3" />
                          Contact via account
                        </div>
                        {booking.user.phone_number && (
                          <div className="flex items-center gap-1">
                            <Phone className="h-3 w-3" />
                            {booking.user.phone_number}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <Badge 
                        variant={booking.user.membership_tier === "platinum" ? "default" : "secondary"}
                        className={cn(
                          "capitalize",
                          booking.user.membership_tier === "gold" && "bg-yellow-100 text-yellow-800",
                          booking.user.membership_tier === "silver" && "bg-gray-100 text-gray-800",
                          booking.user.membership_tier === "platinum" && "bg-purple-100 text-purple-800"
                        )}
                      >
                        <Crown className="mr-1 h-3 w-3" />
                        {booking.user.membership_tier}
                      </Badge>
                    </div>
                  </div>

                  <Separator />

                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div>
                      <p className="text-2xl font-bold">{booking.user.total_bookings}</p>
                      <p className="text-xs text-muted-foreground">Total Bookings</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{booking.user.loyalty_points}</p>
                      <p className="text-xs text-muted-foreground">Loyalty Points</p>
                    </div>
                    <div>
                      <div className="flex items-center justify-center">
                        <Star className="h-5 w-5 text-yellow-500 mr-1" />
                        <p className="text-2xl font-bold">{booking.user.user_rating.toFixed(1)}</p>
                      </div>
                      <p className="text-xs text-muted-foreground">Customer Rating</p>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" className="flex-1">
                      View Profile
                    </Button>
                    <Button variant="outline" size="sm" className="flex-1">
                      Contact Customer
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Guest Booking</AlertTitle>
                    <AlertDescription>
                      This booking was made without an account
                    </AlertDescription>
                  </Alert>
                  <div className="space-y-2">
                    <div>
                      <p className="text-sm text-muted-foreground">Name</p>
                      <p className="font-medium">{booking.guest_name}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Phone</p>
                      <p className="font-medium">{booking.guest_phone}</p>
                    </div>
                    {booking.guest_email && (
                      <div>
                        <p className="text-sm text-muted-foreground">Email</p>
                        <p className="font-medium">{booking.guest_email}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Booking Timeline */}
          <Card>
            <CardHeader>
              <CardTitle>Booking Timeline</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <div className="h-2 w-2 rounded-full bg-primary" />
                    <div className="h-full w-px bg-muted" />
                  </div>
                  <div className="flex-1 pb-4">
                    <p className="text-sm font-medium">Booking Created</p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(booking.created_at), "MMM d, yyyy h:mm a")}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {bookingAge === 0 ? "Today" : `${bookingAge} day${bookingAge === 1 ? "" : "s"} ago`}
                    </p>
                  </div>
                </div>

                {bookingHistory?.map((event, index) => (
                  <div key={event.id} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <div className="h-2 w-2 rounded-full bg-muted-foreground" />
                      {index < bookingHistory.length - 1 && (
                        <div className="h-full w-px bg-muted" />
                      )}
                    </div>
                    <div className="flex-1 pb-4">
                      <p className="text-sm font-medium">
                        Status changed to {STATUS_OPTIONS.find(s => s.value === event.new_status)?.label}
                      </p>
                      {event.reason && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Reason: {event.reason}
                        </p>
                      )}
                      {event.changed_by_profile && (
                        <p className="text-xs text-muted-foreground">
                          by {event.changed_by_profile.full_name}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(event.changed_at), "MMM d, yyyy h:mm a")}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {booking.status === "pending" && (
                <>
                  <Button
                    className="w-full"
                    onClick={() => updateStatusMutation.mutate({ status: "confirmed" })}
                    disabled={updateStatusMutation.isPending}
                  >
                    <CheckCircle className="mr-2 h-4 w-4" />
                    Confirm Booking
                  </Button>
                  <Button
                    variant="destructive"
                    className="w-full"
                    onClick={() => {
                      setNewStatus("declined_by_restaurant")
                      setIsEditingStatus(true)
                    }}
                  >
                    <XCircle className="mr-2 h-4 w-4" />
                    Decline Booking
                  </Button>
                </>
              )}
              
              {booking.status === "confirmed" && (
                <>
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => updateStatusMutation.mutate({ status: "completed" })}
                    disabled={updateStatusMutation.isPending}
                  >
                    <CheckCircle className="mr-2 h-4 w-4" />
                    Mark as Completed
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full"
                  >
                    <Edit className="mr-2 h-4 w-4" />
                    Modify Booking
                  </Button>
                </>
              )}

              <Button
                variant="outline"
                className="w-full"
              >
                <MessageSquare className="mr-2 h-4 w-4" />
                Send Message
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}