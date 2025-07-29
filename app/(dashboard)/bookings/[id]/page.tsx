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
  Plus
} from "lucide-react"
import type { Booking } from "@/types"
import { cn } from "@/lib/utils"

const STATUS_OPTIONS = [
  { value: "pending", label: "Pending", icon: AlertCircle, color: "text-yellow-600" },
  { value: "confirmed", label: "Confirmed", icon: CheckCircle, color: "text-green-600" },
  { value: "completed", label: "Completed", icon: CheckCircle, color: "text-blue-600" },
  { value: "cancelled_by_user", label: "Cancelled by Customer", icon: XCircle, color: "text-red-600" },
  { value: "cancelled_by_restaurant", label: "Cancelled by Restaurant", icon: Ban, color: "text-red-600" },
  { value: "no_show", label: "No Show", icon: UserX, color: "text-gray-600" },
]

export default function BookingDetailsPage() {
  const router = useRouter()
  const params = useParams()
  const bookingId = params.id as string
  const supabase = createClient()
  const queryClient = useQueryClient()
  
  const [isEditingStatus, setIsEditingStatus] = useState(false)
  const [isAddingNote, setIsAddingNote] = useState(false)
  const [newStatus, setNewStatus] = useState("")
  const [cancellationReason, setCancellationReason] = useState("")
  const [internalNote, setInternalNote] = useState("")

  // Fetch booking details
  const { data: booking, isLoading }:any = useQuery({
    queryKey: ["booking", bookingId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bookings")
        .select(`
          *,
          user:profiles(
            id,
            full_name,
            email,
            phone_number,
            avatar_url,
            loyalty_points,
            membership_tier,
            total_bookings
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
              table_type,
              section:restaurant_sections(
                name,
                color
              )
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

  // Fetch booking history
  const { data: bookingHistory } = useQuery({
    queryKey: ["booking-history", bookingId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("booking_history")
        .select(`
          *,
          changed_by:profiles(full_name)
        `)
        .eq("booking_id", bookingId)
        .order("created_at", { ascending: false })

      if (error) throw error
      return data
    },
    enabled: !!booking,
  })

  // Update booking status mutation
  const updateStatusMutation = useMutation({
    mutationFn: async ({ status, reason }: { status: string; reason?: string }) => {
      const updates: any = {
        status,
        updated_at: new Date().toISOString(),
      }

      if (status.includes("cancelled") && reason) {
        updates.cancellation_reason = reason
        updates.cancelled_at = new Date().toISOString()
      }

      const { error } = await supabase
        .from("bookings")
        .update(updates)
        .eq("id", bookingId)

      if (error) throw error

      // Add to history
      const { data: { user } } = await supabase.auth.getUser()
      await supabase
        .from("booking_history")
        .insert({
          booking_id: bookingId,
          action: `Status changed to ${status}`,
          changed_by: user?.id,
          details: reason ? { reason } : null,
        })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["booking", "booking-history"] })
      toast.success("Booking status updated")
      setIsEditingStatus(false)
      setCancellationReason("")
    },
    onError: () => {
      toast.error("Failed to update booking status")
    },
  })

  // Add internal note mutation
  const addNoteMutation = useMutation({
    mutationFn: async (note: string) => {
      const currentNotes = booking?.internal_notes || []
      const { data: { user } } = await supabase.auth.getUser()
      
      const newNote = {
        id: crypto.randomUUID(),
        text: note,
        created_by: user?.id,
        created_at: new Date().toISOString(),
      }

      const { error } = await supabase
        .from("bookings")
        .update({
          internal_notes: [...currentNotes, newNote],
          updated_at: new Date().toISOString(),
        })
        .eq("id", bookingId)

      if (error) throw error

      // Add to history
      await supabase
        .from("booking_history")
        .insert({
          booking_id: bookingId,
          action: "Internal note added",
          changed_by: user?.id,
        })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["booking", "booking-history"] })
      toast.success("Note added")
      setIsAddingNote(false)
      setInternalNote("")
    },
    onError: () => {
      toast.error("Failed to add note")
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
    return <div className="flex items-center justify-center h-screen">Loading...</div>
  }

  if (!booking) {
    return <div>Booking not found</div>
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
          onClick={() => router.push("/bookings")}
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
            This booking is pending confirmation. Please review and confirm or reject.
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
                        
                        {newStatus.includes("cancelled") && (
                          <div>
                            <Label>Cancellation Reason</Label>
                            <Textarea
                              placeholder="Provide a reason for cancellation..."
                              value={cancellationReason}
                              onChange={(e) => setCancellationReason(e.target.value)}
                              rows={3}
                            />
                          </div>
                        )}
                      </div>
                      <DialogFooter>
                        <Button
                          variant="outline"
                          onClick={() => setIsEditingStatus(false)}
                        >
                          Cancel
                        </Button>
                        <Button
                          onClick={() => updateStatusMutation.mutate({
                            status: newStatus,
                            reason: cancellationReason,
                          })}
                          disabled={!newStatus || updateStatusMutation.isPending}
                        >
                          Update Status
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
                  <code className="font-mono text-sm font-semibold">
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
                    <p className="text-sm text-muted-foreground">Table</p>
                    <p className="font-medium">
                      {booking.tables?.map((t: { table: { table_number: any } }) => `Table ${t.table.table_number}`).join(", ") || "Not assigned"}
                    </p>
                  </div>
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
                    <p className="text-sm">{booking.special_requests}</p>
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
                    <Badge variant="secondary">
                      {booking.offer.title} - {booking.offer.discount_percentage}% off
                    </Badge>
                  </div>
                </>
              )}

              {/* Cancellation Details */}
              {booking.status.includes("cancelled") && booking.cancellation_reason && (
                <>
                  <Separator />
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Cancellation Reason</AlertTitle>
                    <AlertDescription>
                      {booking.cancellation_reason}
                    </AlertDescription>
                  </Alert>
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
                      <AvatarImage src={booking.user.avatar_url} />
                      <AvatarFallback>
                        {booking.user.full_name?.split(" ").map((n: any[]) => n[0]).join("")}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <h4 className="font-semibold">{booking.user.full_name}</h4>
                      <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Mail className="h-3 w-3" />
                          {booking.user.email}
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
                      <Badge variant={booking.user.membership_tier === "vip" ? "default" : "secondary"}>
                        {booking.user.membership_tier || "Regular"}
                      </Badge>
                    </div>
                  </div>

                  <Separator />

                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div>
                      <p className="text-2xl font-bold">{booking.user.total_bookings || 0}</p>
                      <p className="text-xs text-muted-foreground">Total Bookings</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{booking.user.loyalty_points || 0}</p>
                      <p className="text-xs text-muted-foreground">Loyalty Points</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold">
                        <Star className="h-5 w-5 inline text-yellow-500" />
                        4.5
                      </p>
                      <p className="text-xs text-muted-foreground">Avg Rating</p>
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

          {/* Internal Notes */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Internal Notes</CardTitle>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsAddingNote(true)}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add Note
                </Button>
              </div>
              <CardDescription>
                Notes visible only to staff members
              </CardDescription>
            </CardHeader>
            <CardContent>
              {booking.internal_notes && booking.internal_notes.length > 0 ? (
                <div className="space-y-3">
                  {booking.internal_notes.map((note: any) => (
                    <div key={note.id} className="border-l-2 border-muted pl-4">
                      <p className="text-sm">{note.text}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {format(new Date(note.created_at), "MMM d, yyyy h:mm a")}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No internal notes</p>
              )}

              <Dialog open={isAddingNote} onOpenChange={setIsAddingNote}>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add Internal Note</DialogTitle>
                    <DialogDescription>
                      This note will only be visible to staff members
                    </DialogDescription>
                  </DialogHeader>
                  <Textarea
                    placeholder="Enter your note..."
                    value={internalNote}
                    onChange={(e) => setInternalNote(e.target.value)}
                    rows={4}
                  />
                  <DialogFooter>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setIsAddingNote(false)
                        setInternalNote("")
                      }}
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={() => addNoteMutation.mutate(internalNote)}
                      disabled={!internalNote.trim() || addNoteMutation.isPending}
                    >
                      Add Note
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
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
                      {bookingAge} days ago
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
                      <p className="text-sm font-medium">{event.action}</p>
                      {event.changed_by && (
                        <p className="text-xs text-muted-foreground">
                          by {event.changed_by.full_name}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(event.created_at), "MMM d, yyyy h:mm a")}
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
                  >
                    <CheckCircle className="mr-2 h-4 w-4" />
                    Confirm Booking
                  </Button>
                  <Button
                    variant="destructive"
                    className="w-full"
                    onClick={() => {
                      setNewStatus("cancelled_by_restaurant")
                      setIsEditingStatus(true)
                    }}
                  >
                    <XCircle className="mr-2 h-4 w-4" />
                    Reject Booking
                  </Button>
                </>
              )}
              
              {booking.status === "confirmed" && (
                <>
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => updateStatusMutation.mutate({ status: "completed" })}
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