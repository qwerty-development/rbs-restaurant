// components/bookings/booking-customer-details.tsx
"use client"

import { useState, useEffect, memo } from "react"
import { createClient } from "@/lib/supabase/client"
import { format } from "date-fns"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { ScrollArea } from "@/components/ui/scroll-area"
import { 
  User, 
  Mail, 
  Phone, 
  Calendar,
  Star,
  AlertCircle,
  StickyNote,
  Users,
  Clock,
  DollarSign,
  Link2,
  MessageSquare,
  ExternalLink,
  TrendingUp,
  Ban
} from "lucide-react"
import { toast } from "sonner"
import type { Booking } from "@/types"
import type { RestaurantCustomer, CustomerNote, CustomerRelationship, CustomerTag } from "@/types/customer"

// Function to determine if a color is light and needs dark text
const isLightColor = (hexColor: string): boolean => {
  // Convert hex to RGB
  const hex = hexColor.replace('#', '')
  const r = parseInt(hex.substr(0, 2), 16)
  const g = parseInt(hex.substr(2, 2), 16)
  const b = parseInt(hex.substr(4, 2), 16)
  
  // Calculate relative luminance
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  
  // Return true if light (needs dark text)
  return luminance > 0.6
}
import { QuickCustomerNote } from "./quick-customer-note"
import { CustomerBookingHistory } from "./customer-booking-history"
import { LowRatingFlag, CustomerRatingDisplay } from "@/components/ui/low-rating-flag"
import { titleCase } from "@/lib/utils"
import { customerUtils } from "@/lib/customer-utils"

interface BookingCustomerDetailsProps {
  booking: Booking
  restaurantId: string
  currentUserId?: string
}

export function BookingCustomerDetails({ booking, restaurantId, currentUserId }: BookingCustomerDetailsProps) {
  const [customerData, setCustomerData]:any = useState<RestaurantCustomer | null>(null)
  const [totalBookingCount, setTotalBookingCount] = useState<number>(0)
  const [loading, setLoading] = useState(true)
  
  const supabase = createClient()
  
  // Create a unique instance ID to ensure component isolation
  const instanceId = `${booking.id}-${Date.now()}`

  useEffect(() => {
    // Clear previous customer data when booking changes to prevent showing wrong data
    setCustomerData(null)
    setLoading(true)

    // Only try to load restaurant_customer data if we have guest identifiers
    // (guest_email or guest_phone) - never query by user_id alone as it could be staff
    if (booking.guest_email || booking.guest_phone) {
      loadCustomerData()
    } else {
      setLoading(false)
    }
  }, [booking.id, booking.guest_email, booking.guest_phone, restaurantId])

  // Clean up function to ensure no state bleeding between instances
  useEffect(() => {
    return () => {
      setCustomerData(null)
      setLoading(false)
    }
  }, [])

  const loadCustomerData = async () => {
    try {
      setLoading(true)

      let query = supabase
        .from('restaurant_customers')
        .select(`
          *,
          profile:profiles!restaurant_customers_user_id_fkey(
            id,
            full_name,
            phone_number,
            avatar_url,
            allergies,
            dietary_restrictions,
            user_rating,
            date_of_birth
          ),
          tags:customer_tag_assignments(
            tag:customer_tags(*)
          )
        `)
        .eq('restaurant_id', restaurantId)

      // PRIORITY: Only query by guest_email or guest_phone
      // NEVER query by user_id alone as it could be the staff member who created the booking
      if (booking.guest_email) {
        query = query.eq('guest_email', booking.guest_email)
      } else if (booking.guest_phone) {
        query = query.eq('guest_phone', booking.guest_phone)
      } else {
        // No valid customer identifier - this shouldn't happen as we check in useEffect
        console.warn('No guest identifiers available for restaurant_customer query')
        setLoading(false)
        return
      }

      const { data: customerResult, error } = await query.single()

      if (error) {
        console.error('Error loading customer data:', error)
        return
      }

      // CRITICAL: Check if the loaded customer is actually a restaurant staff member
      // If so, DO NOT display their data in the customer details section
      if (customerResult && customerResult.user_id) {
        const { data: staffCheck } = await supabase
          .from('restaurant_staff')
          .select('id')
          .eq('user_id', customerResult.user_id)
          .eq('restaurant_id', restaurantId)
          .eq('is_active', true)
          .single()

        if (staffCheck) {
          // This is a staff member - do not show their data as customer data
          console.log('Customer data is actually a staff member - showing fallback instead')
          setLoading(false)
          return
        }
      }

      let customerNotes: any[] = []

      // Load customer notes separately to ensure proper filtering
      if (customerResult) {
        const { data: notesData, error: notesError } = await supabase
          .from('customer_notes')
          .select(`
            *,
            created_by_profile:profiles!customer_notes_created_by_fkey(
              full_name,
              avatar_url
            )
          `)
          .eq('customer_id', customerResult.id)
          .order('created_at', { ascending: false })

        if (notesError) {
          console.error('Error loading customer notes:', notesError)
        } else {
          customerNotes = notesData || []
        }
      }

      if (error) {
        console.error('Error loading customer data:', error)
        return
      }

      if (customerResult) {
        // Load relationships
        const { data: relationshipsData } = await supabase
          .from('customer_relationships')
          .select(`
            *,
            related_customer:restaurant_customers!customer_relationships_related_customer_id_fkey(
              *,
              profile:profiles(full_name, avatar_url)
            ),
            customer:restaurant_customers!customer_relationships_customer_id_fkey(
              *,
              profile:profiles(full_name, avatar_url)
            )
          `)
          .or(`customer_id.eq.${customerResult.id},related_customer_id.eq.${customerResult.id}`)

        // Load recent booking history - use guest_email or guest_phone to find related bookings
        let bookingQuery = supabase.from('bookings').select('*')
        if (booking.guest_email) {
          bookingQuery = bookingQuery.eq('guest_email', booking.guest_email)
        } else if (booking.guest_phone) {
          bookingQuery = bookingQuery.eq('guest_phone', booking.guest_phone)
        }

        const { data: bookingHistory } = await bookingQuery
          .eq('restaurant_id', restaurantId)
          .neq('id', booking.id) // Exclude current booking
          .order('booking_time', { ascending: false })
          .limit(5)

        // Get total booking count for this restaurant - use guest_email or guest_phone
        let totalBookingQuery = supabase.from('bookings').select('id', { count: 'exact' })
        if (booking.guest_email) {
          totalBookingQuery = totalBookingQuery.eq('guest_email', booking.guest_email)
        } else if (booking.guest_phone) {
          totalBookingQuery = totalBookingQuery.eq('guest_phone', booking.guest_phone)
        }

        const { count: restaurantBookingCount } = await totalBookingQuery
          .eq('restaurant_id', restaurantId)

        // Get all bookings for statistics calculation - use guest_email or guest_phone
        let allBookingsQuery = supabase.from('bookings').select('status')
        if (booking.guest_email) {
          allBookingsQuery = allBookingsQuery.eq('guest_email', booking.guest_email)
        } else if (booking.guest_phone) {
          allBookingsQuery = allBookingsQuery.eq('guest_phone', booking.guest_phone)
        }

        const { data: allBookings } = await allBookingsQuery
          .eq('restaurant_id', restaurantId)

        // Calculate statistics from all bookings
        const noShowCount = allBookings?.filter(b => b.status === 'no_show').length || 0
        const cancelledCount = allBookings?.filter(b => 
          b.status === 'cancelled_by_user' || b.status === 'cancelled_by_restaurant'
        ).length || 0

        // Calculate actual last visit from completed bookings
        const lastCompletedBooking = bookingHistory?.find(b => b.status === 'completed')
        const actualLastVisit = lastCompletedBooking?.booking_time

        // Transform data
        const transformedCustomer = {
          ...customerResult,
          tags: customerResult.tags?.map((t: any) => t.tag) || [],
          notes: customerNotes, // Use separately loaded notes
          relationships: relationshipsData || [],
          bookings: bookingHistory || [],
          last_visit: actualLastVisit || customerResult.last_visit, // Use calculated last visit or fallback to DB value
          no_show_count: noShowCount,
          cancelled_count: cancelledCount
        }

        setCustomerData(transformedCustomer)
        setTotalBookingCount(restaurantBookingCount || 0)
      }
    } catch (error) {
      console.error('Error loading customer data:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="animate-pulse space-y-3">
            <div className="h-4 bg-muted rounded w-3/4"></div>
            <div className="h-4 bg-muted rounded w-1/2"></div>
            <div className="h-4 bg-muted rounded w-2/3"></div>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!customerData) {
    // No restaurant_customer record found - display booking's direct guest information
    const hasGuestInfo = booking.guest_name || booking.guest_email || booking.guest_phone
    const isAnonymous = !hasGuestInfo || booking.guest_name?.toLowerCase().includes('anonymous')

    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <User className="h-5 w-5" />
            {isAnonymous ? 'Anonymous Guest / Walk-in' : 'Guest Booking'}
          </CardTitle>
          <CardDescription>
            {booking.guest_name && <div className="text-sm">{booking.guest_name}</div>}
            {booking.guest_email && (
              <div className="flex items-center gap-2 text-sm mt-1">
                <Mail className="h-3 w-3" />
                {booking.guest_email}
              </div>
            )}
            {booking.guest_phone && (
              <div className="flex items-center gap-2 text-sm mt-1">
                <Phone className="h-3 w-3" />
                {booking.guest_phone}
              </div>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="text-sm text-muted-foreground">
              {isAnonymous
                ? 'This is an anonymous booking or walk-in. No customer profile data is available.'
                : 'This guest has not been added to the restaurant\'s customer database yet.'
              }
            </div>

            {/* Show booking details */}
            <div className="border-t pt-3 mt-3">
              <h4 className="text-sm font-medium mb-2">Booking Information</h4>
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span>{format(new Date(booking.booking_time), 'MMM d, yyyy - h:mm a')}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <span>Party of {booking.party_size}</span>
                </div>
                {booking.special_requests && (
                  <div className="flex items-start gap-2 mt-2">
                    <AlertCircle className="h-4 w-4 text-muted-foreground mt-0.5" />
                    <div>
                      <div className="font-medium">Special Requests:</div>
                      <div className="text-muted-foreground">{booking.special_requests}</div>
                    </div>
                  </div>
                )}
                {booking.occasion && (
                  <div className="flex items-center gap-2">
                    <Star className="h-4 w-4 text-muted-foreground" />
                    <span>Occasion: {booking.occasion}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }


  return (
    <div className="space-y-4">
      {/* Customer Overview */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <Avatar className="h-12 w-12">
                <AvatarImage src={customerData.profile?.avatar_url} />
                <AvatarFallback>
                  {(customerData.profile?.full_name || customerData.guest_name || 'G')
                    .split(' ')
                    .map(n => n[0])
                    .join('')
                    .toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div>
                <CardTitle className="text-lg">
                  {customerData.profile?.full_name || customerData.guest_name}
                  {customerData.profile?.date_of_birth && (
                    <span className="text-sm font-normal text-muted-foreground ml-2">
                      ({customerUtils.formatAge(customerData.profile.date_of_birth)})
                    </span>
                  )}
                </CardTitle>
                <CardDescription>
                  Customer since {customerData.first_visit ? format(new Date(customerData.first_visit), 'MMM d, yyyy') : 'Unknown'}
                </CardDescription>
              </div>
            </div>
            <div className="flex flex-col items-end gap-2">
              {customerData.profile?.user_rating && (
                <CustomerRatingDisplay 
                  rating={customerData.profile.user_rating} 
                  size="md"
                  className="bg-white border border-gray-200 px-2 py-1 rounded"
                />
              )}
              {customerData.vip_status && (
                <Badge variant="default" className="bg-gold text-gold-foreground">
                  <Star className="h-3 w-3 mr-1" />
                  VIP
                </Badge>
              )}
              {customerData.blacklisted && (
                <Badge variant="destructive">
                  <Ban className="h-3 w-3 mr-1" />
                  Blacklisted
                </Badge>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Contact Information */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              {(customerData.profile?.phone_number || customerData.guest_phone) && (
                <div className="flex items-center gap-2 text-sm">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <span>{customerData.profile?.phone_number || customerData.guest_phone}</span>
                </div>
              )}
              {customerData.guest_email && (
                <div className="flex items-center gap-2 text-sm">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <span>{customerData.guest_email}</span>
                </div>
              )}
              {customerData.last_visit && (
                <div className="flex items-center gap-2 text-sm">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span>Last Visit: {format(new Date(customerData.last_visit), 'MMM d, yyyy')}</span>
                </div>
              )}
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
                <span>Total Bookings: {totalBookingCount}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <DollarSign className="h-4 w-4 text-muted-foreground" />
                <span>Total Spent: ${customerData.total_spent?.toFixed(2) || '0.00'}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Users className="h-4 w-4 text-muted-foreground" />
                <span>Avg Party Size: {customerData.average_party_size}</span>
              </div>
            </div>
          </div>

          {/* Customer Tags */}
          {customerData.tags && customerData.tags.length > 0 && (
            <>
              <Separator />
              <div>
                <h4 className="text-sm font-medium mb-2">Customer Tags</h4>
                <div className="flex flex-wrap gap-2">
                  {customerData.tags.map((tag) => (
                    <Badge
                      key={tag.id}
                      variant="outline"
                      style={{ 
                        borderColor: tag.color, 
                        color: isLightColor(tag.color) ? '#000000' : tag.color 
                      }}
                    >
                      {tag.name}
                    </Badge>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Dietary & Allergies */}
          {(customerData.profile?.allergies || customerData.profile?.dietary_restrictions) && (
            <>
              <Separator />
              <div>
                <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-orange-500" />
                  Dietary Information
                </h4>
                <div className="space-y-1 text-sm">
                  {customerData.profile?.allergies && customerData.profile.allergies.length > 0 && (
                    <div>
                      <span className="font-medium text-red-600">Allergies: </span>
                      <span>{customerData.profile.allergies.join(', ')}</span>
                    </div>
                  )}
                  {customerData.profile?.dietary_restrictions && customerData.profile.dietary_restrictions.length > 0 && (
                    <div>
                      <span className="font-medium text-orange-600">Dietary Restrictions: </span>
                      <span>{customerData.profile.dietary_restrictions.join(', ')}</span>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}

          {/* Blacklist Information */}
          {customerData.blacklisted && customerData.blacklist_reason && (
            <>
              <Separator />
              <div>
                <h4 className="text-sm font-medium mb-2 flex items-center gap-2 text-red-600">
                  <Ban className="h-4 w-4" />
                  Blacklist Reason
                </h4>
                <div className="text-sm text-red-700 bg-red-50 p-2 rounded border border-red-200">
                  {customerData.blacklist_reason}
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Low Rating Alert */}
      {customerData.profile?.user_rating && customerData.profile.user_rating <= 2 && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="flex-shrink-0">
                <LowRatingFlag 
                  rating={customerData.profile.user_rating} 
                  size="lg"
                  showValue={true}
                />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-red-800">
                  Customer has a low rating ({customerData.profile.user_rating.toFixed(1)}/5.0)
                </p>
                <p className="text-xs text-red-700 mt-1">
                  Please provide exceptional service and monitor this booking closely. 
                  Consider reviewing previous visit notes and any reported issues.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Customer Notes */}
      {customerData.notes && customerData.notes.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between gap-4">
              <CardTitle className="text-lg flex items-center gap-2 flex-shrink-0">
                <StickyNote className="h-5 w-5" />
                Customer Notes
              </CardTitle>
              {currentUserId && (
                <div className="flex-shrink-0">
                  <QuickCustomerNote 
                    key={`note-add-${customerData.id}-${instanceId}`}
                    customerId={customerData.id}
                    currentUserId={currentUserId}
                    onNoteAdded={() => {
                      // Force reload customer data after adding a note
                      loadCustomerData()
                    }}
                  />
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-32">
              <div className="space-y-3 pr-2">
                {customerData.notes
                  .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                  .map((note) => (
                    <div key={note.id} className="border-l-2 border-gray-200 pl-3">
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm break-words">{note.note}</p>
                          <div className="flex items-center gap-2 mt-1 flex-wrap">
                            <Badge 
                              variant="outline" 
                              className="text-xs"
                            >
                              {titleCase(note.category)}
                            </Badge>
                            {note.is_important && (
                              <Badge variant="destructive" className="text-xs">
                                Important
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {format(new Date(note.created_at), 'MMM d, yyyy h:mm a')}
                        {note.created_by_profile && (
                          <span> by {note.created_by_profile.full_name}</span>
                        )}
                      </div>
                    </div>
                  ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {/* Add Note Section for customers without notes */}
      {(!customerData.notes || customerData.notes.length === 0) && currentUserId && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <StickyNote className="h-5 w-5" />
              Customer Notes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center py-4">
              <p className="text-muted-foreground mb-4">No notes for this customer yet.</p>
              <QuickCustomerNote 
                key={`note-add-empty-${customerData.id}-${instanceId}`}
                customerId={customerData.id}
                currentUserId={currentUserId}
                onNoteAdded={() => {
                  // Force reload customer data after adding a note
                  loadCustomerData()
                }}
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Customer Relationships */}
      {customerData.relationships && customerData.relationships.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Link2 className="h-5 w-5" />
              Relationships
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {customerData.relationships.map((rel) => {
                // Logic to determine which customer to show (the OTHER person in the relationship)
                const isCurrentCustomerTheCreator = rel.customer_id === customerData.id
                const relatedCustomer = isCurrentCustomerTheCreator ? rel.related_customer : rel.customer
                
                return (
                  <div key={rel.id} className="flex items-center gap-3 p-2 border rounded">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={relatedCustomer?.profile?.avatar_url} />
                      <AvatarFallback>
                        {(relatedCustomer?.profile?.full_name || relatedCustomer?.guest_name || 'G')[0]}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <p className="text-sm font-medium">
                        {relatedCustomer?.profile?.full_name || relatedCustomer?.guest_name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {rel.relationship_type}
                        {rel.relationship_details && ` - ${rel.relationship_details}`}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent Booking History */}
      {customerData.bookings && customerData.bookings.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Recent Bookings
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {customerData.bookings.map((pastBooking) => (
                <div key={pastBooking.id} className="flex items-center justify-between p-2 border rounded">
                  <div>
                    <p className="text-sm font-medium">
                      {format(new Date(pastBooking.booking_time), 'MMM d, yyyy - h:mm a')}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Party of {pastBooking.party_size}
                    </p>
                  </div>
                  <Badge
                    variant={
                      pastBooking.status === 'completed' ? 'default' :
                      pastBooking.status === 'cancelled_by_user' ? 'destructive' :
                      pastBooking.status === 'no_show' ? 'destructive' :
                      'secondary'
                    }
                  >
                    {titleCase(pastBooking.status)}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Customer Booking History */}
      <CustomerBookingHistory 
        customerId={customerData.id}
        currentBookingId={booking.id}
        restaurantId={restaurantId}
      />

      {/* Customer Statistics */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Customer Statistics</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <div className="text-muted-foreground">No Shows</div>
              <div className="font-medium">{customerData.no_show_count}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Cancellations</div>
              <div className="font-medium">{customerData.cancelled_count}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Success Rate</div>
              <div className="font-medium">
                {totalBookingCount > 0 
                  ? `${(((totalBookingCount - customerData.no_show_count - customerData.cancelled_count) / totalBookingCount) * 100).toFixed(1)}%`
                  : 'N/A'
                }
              </div>
            </div>
            <div>
              <div className="text-muted-foreground">Avg Spend</div>
              <div className="font-medium">
                ${totalBookingCount > 0 
                  ? (customerData.total_spent / totalBookingCount).toFixed(2)
                  : '0.00'
                }
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// Memoize the component to prevent unnecessary re-renders
export default memo(BookingCustomerDetails)
