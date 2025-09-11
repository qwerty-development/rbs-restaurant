// components/customers/customer-details-dialog.tsx

'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { format } from 'date-fns'
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle,
  DialogDescription 
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { 
  User, 
  Mail, 
  Phone, 
  Calendar,
  DollarSign,
  Users,
  Star,
  AlertCircle,
  Plus,
  Trash2,
  Edit2,
  Save,
  X,
  Link2,
  StickyNote,
  Clock,
  Ban,
  Shield,
  ShieldCheck
} from 'lucide-react'
import { toast } from 'sonner'
import type { RestaurantCustomer, CustomerNote, CustomerRelationship, CustomerTag } from '@/types/customer'

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

type CustomerForSelection = {
  id: string
  guest_name?: string | null
  guest_email?: string | null
  profile?: {
    id: string
    full_name: string
    avatar_url?: string | null
  } | null
}

interface CustomerDetailsDialogProps {
  customer: RestaurantCustomer
  open: boolean
  onOpenChange: (open: boolean) => void
  onUpdate: () => void
  restaurantId: string
  currentUserId: string
  canManage: boolean
}

export function CustomerDetailsDialog({
  customer,
  open,
  onOpenChange,
  onUpdate,
  restaurantId,
  currentUserId,
  canManage
}: CustomerDetailsDialogProps) {
  const supabase = createClient()
  
  // State
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState('overview')
  const [notes, setNotes] = useState<CustomerNote[]>(customer.notes || [])
  const [relationships, setRelationships] = useState<CustomerRelationship[]>([])
  const [bookingHistory, setBookingHistory] = useState<any[]>([])
  const [totalBookingCount, setTotalBookingCount] = useState<number>(customer.total_bookings)
  const [availableTags, setAvailableTags] = useState<CustomerTag[]>([])
  const [customerTags, setCustomerTags] = useState<CustomerTag[]>(customer.tags || [])
  const [availableCustomers, setAvailableCustomers] = useState<CustomerForSelection[]>([])
  const [customerWithEmail, setCustomerWithEmail] = useState<RestaurantCustomer>(customer)
  
  // Forms
  const [newNote, setNewNote] = useState({ note: '', category: 'general', is_important: false })
  const [newRelationship, setNewRelationship] = useState({
    related_customer_id: '',
    relationship_type: 'friend' as const,
    relationship_details: ''
  })

  // Reset customer data when customer changes
  useEffect(() => {
    setCustomerTags(customer.tags || [])
    setCustomerWithEmail(customer)
    setNotes(customer.notes || [])
    // Reset active tab to overview when customer changes
    setActiveTab('overview')
  }, [customer])

  // Load additional data when dialog opens
  useEffect(() => {
    if (open) {
      loadAdditionalData()
    }
  }, [open, customer.id])

  const loadAdditionalData = async () => {
    try {
      setLoading(true)

      // Email is already included in the customer data from profiles
      setCustomerWithEmail(customer)

      // Load notes
      const { data: notesData } = await supabase
        .from('customer_notes')
        .select(`
          *,
          created_by_profile:profiles!customer_notes_created_by_fkey(
            full_name,
            avatar_url
          )
        `)
        .eq('customer_id', customer.id)
        .order('created_at', { ascending: false })

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
        .or(`customer_id.eq.${customer.id},related_customer_id.eq.${customer.id}`)

      // Load booking history - comprehensive approach for all customer types
      let allBookings: any[] = []
      
      // For registered users with profiles, prioritize user_id matching
      if (customer.user_id && customer.profile) {
        const { data: userBookings, error: userBookingsError } = await supabase
          .from('bookings')
          .select('*')
          .eq('user_id', customer.user_id)
          .eq('restaurant_id', restaurantId)

        if (userBookingsError) {
          console.error('Error loading user bookings:', userBookingsError)
        } else {
          allBookings = [...allBookings, ...(userBookings || [])]
        }
      }

      // For guest customers or when user_id matching fails, try multiple approaches
      if (!customer.profile || allBookings.length === 0) {
        // Method 1: Query by guest_email (most reliable for guest customers)
        if (customer.guest_email) {
          const { data: emailBookings, error: emailBookingsError } = await supabase
            .from('bookings')
            .select('*')
            .eq('guest_email', customer.guest_email)
            .eq('restaurant_id', restaurantId)

          if (emailBookingsError) {
            console.error('Error loading email bookings:', emailBookingsError)
          } else {
            // Add bookings that aren't already in the list (by ID)
            const existingIds = new Set(allBookings.map(b => b.id))
            const newBookings = (emailBookings || []).filter(b => !existingIds.has(b.id))
            allBookings = [...allBookings, ...newBookings]
          }
        }

        // Method 2: Query by guest_name and guest_email combination (high confidence match)
        if (customer.guest_name && customer.guest_email) {
          const { data: nameEmailBookings, error: nameEmailError } = await supabase
            .from('bookings')
            .select('*')
            .eq('guest_name', customer.guest_name)
            .eq('guest_email', customer.guest_email)
            .eq('restaurant_id', restaurantId)

          if (nameEmailError) {
            console.error('Error loading name+email bookings:', nameEmailError)
          } else {
            // Add bookings that aren't already in the list (by ID)
            const existingIds = new Set(allBookings.map(b => b.id))
            const newBookings = (nameEmailBookings || []).filter(b => !existingIds.has(b.id))
            allBookings = [...allBookings, ...newBookings]
          }
        }

        // Method 3: Query by guest_name only (lower confidence, use carefully)
        if (customer.guest_name && allBookings.length === 0) {
          const { data: nameBookings, error: nameBookingsError } = await supabase
            .from('bookings')
            .select('*')
            .eq('guest_name', customer.guest_name)
            .eq('restaurant_id', restaurantId)

          if (nameBookingsError) {
            console.error('Error loading name bookings:', nameBookingsError)
          } else {
            // For name-only matches, be more selective to avoid false positives
            // Only include if guest_email matches or is null in both records
            const filteredBookings = (nameBookings || []).filter(booking => {
              if (!customer.guest_email && !booking.guest_email) return true
              if (customer.guest_email && booking.guest_email === customer.guest_email) return true
              return false
            })

            const existingIds = new Set(allBookings.map(b => b.id))
            const newBookings = filteredBookings.filter(b => !existingIds.has(b.id))
            allBookings = [...allBookings, ...newBookings]
          }
        }
      }

      // Sort and limit bookings
      const bookingsData = allBookings
        .sort((a, b) => new Date(b.booking_time).getTime() - new Date(a.booking_time).getTime())
        .slice(0, 10)

      console.log('Customer booking history loaded:', {
        customerId: customer.id,
        totalFound: allBookings.length,
        displayCount: bookingsData.length
      })

      // Use the deduplicated count from allBookings.length instead of double-counting
      // This ensures accuracy by avoiding double-counting bookings that exist under both user_id and email
      const actualTotalBookings = allBookings.length

      // Load available tags
      const { data: tagsData } = await supabase
        .from('customer_tags')
        .select('*')
        .eq('restaurant_id', restaurantId)

      // Load available customers (excluding current customer)
      const { data: customersData } = await supabase
        .from('restaurant_customers')
        .select(`
          id,
          guest_name,
          guest_email,
          profile:profiles(
            id,
            full_name,
            avatar_url
          )
        `)
        .eq('restaurant_id', restaurantId)
        .neq('id', customer.id)
        .order('guest_name')

      setNotes(notesData || [])
      setRelationships(relationshipsData || [])
      setBookingHistory(bookingsData || [])
      setTotalBookingCount(actualTotalBookings)
      setAvailableTags(tagsData || [])
      // Transform customers data to fix profile array issue
      const transformedCustomers = (customersData || []).map((c: any) => ({
        id: c.id,
        guest_name: c.guest_name,
        guest_email: c.guest_email,
        profile: Array.isArray(c.profile) ? c.profile[0] : c.profile
      }))
      
      setAvailableCustomers(transformedCustomers)

    } catch (error) {
      console.error('Error loading additional data:', error)
    } finally {
      setLoading(false)
    }
  }

  // Add note
  const handleAddNote = async () => {
    if (!newNote.note.trim()) return
    
    if (!currentUserId) {
      toast.error('Unable to add note: User not authenticated')
      return
    }

    try {
      const { data, error } = await supabase
        .from('customer_notes')
        .insert({
          customer_id: customer.id,
          note: newNote.note,
          category: newNote.category,
          is_important: newNote.is_important,
          created_by: currentUserId
        })
        .select(`
          *,
          created_by_profile:profiles!customer_notes_created_by_fkey(
            full_name,
            avatar_url
          )
        `)
        .single()

      if (error) throw error

      setNotes([data, ...notes])
      setNewNote({ note: '', category: 'general', is_important: false })
      toast.success('Note added successfully')
    } catch (error) {
      console.error('Error adding note:', error)
      toast.error('Failed to add note')
    }
  }

  // Delete note
  const handleDeleteNote = async (noteId: string) => {
    try {
      const { error } = await supabase
        .from('customer_notes')
        .delete()
        .eq('id', noteId)

      if (error) throw error

      setNotes(notes.filter(n => n.id !== noteId))
      toast.success('Note deleted successfully')
    } catch (error) {
      console.error('Error deleting note:', error)
      toast.error('Failed to delete note')
    }
  }

  // Add relationship
  const handleAddRelationship = async () => {
    if (!newRelationship.related_customer_id) return
    
    if (!currentUserId) {
      toast.error('Unable to add relationship: User not authenticated')
      return
    }

    try {
      const { data, error } = await supabase
        .from('customer_relationships')
        .insert({
          customer_id: customer.id,
          related_customer_id: newRelationship.related_customer_id,
          relationship_type: newRelationship.relationship_type,
          relationship_details: newRelationship.relationship_details,
          created_by: currentUserId
        })
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
        .single()

      if (error) throw error

      setRelationships([...relationships, data])
      setNewRelationship({
        related_customer_id: '',
        relationship_type: 'friend',
        relationship_details: ''
      })
      toast.success('Relationship added successfully')
    } catch (error) {
      console.error('Error adding relationship:', error)
      toast.error('Failed to add relationship')
    }
  }

  // Toggle tag
  const handleToggleTag = async (tag: CustomerTag) => {
    if (!currentUserId) {
      toast.error('Unable to update tags: User not authenticated')
      return
    }

    try {
      const hasTag = customerTags.some(t => t.id === tag.id)

      if (hasTag) {
        // Remove tag
        const { error } = await supabase
          .from('customer_tag_assignments')
          .delete()
          .eq('customer_id', customer.id)
          .eq('tag_id', tag.id)

        if (error) throw error

        setCustomerTags(customerTags.filter(t => t.id !== tag.id))
      } else {
        // Add tag
        const { error } = await supabase
          .from('customer_tag_assignments')
          .insert({
            customer_id: customer.id,
            tag_id: tag.id,
            assigned_by: currentUserId
          })

        if (error) throw error

        setCustomerTags([...customerTags, tag])
      }

      onUpdate()
      toast.success(`Tag ${hasTag ? 'removed' : 'added'} successfully`)
    } catch (error) {
      console.error('Error toggling tag:', error)
      toast.error('Failed to update tag')
    }
  }

  const getInitials = () => {
    const name = customerWithEmail.profile?.full_name || customerWithEmail.guest_name || 'G'
    return name.split(' ').map(n => n[0]).join('').toUpperCase()
  }

  const getNoteIcon = (category: string) => {
    switch (category) {
      case 'dietary': return '🍽️'
      case 'preference': return '⭐'
      case 'behavior': return '👤'
      case 'special_occasion': return '🎉'
      default: return '📝'
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Customer Details</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Customer Header */}
          <div className="flex items-start gap-4">
            <Avatar className="h-16 w-16">
              <AvatarImage src={customerWithEmail.profile?.avatar_url} />
              <AvatarFallback>{getInitials()}</AvatarFallback>
            </Avatar>
            
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h2 className="text-2xl font-semibold">
                  {customerWithEmail.profile?.full_name || customerWithEmail.guest_name || 'Guest Customer'}
                </h2>
                {customerWithEmail.vip_status && (
                  <Badge variant="secondary">
                    <Star className="h-3 w-3 mr-1" />
                    VIP
                  </Badge>
                )}
                {customerWithEmail.blacklisted && (
                  <Badge variant="destructive">
                    <Ban className="h-3 w-3 mr-1" />
                    Blacklisted
                  </Badge>
                )}
              </div>
              
              <div className="flex flex-wrap gap-4 mt-2 text-sm text-gray-600">
                {(customerWithEmail.profile?.email || customerWithEmail.guest_email) && (
                  <span className="flex items-center gap-1">
                    <Mail className="h-3 w-3" />
                    <span>{customerWithEmail.profile?.email || customerWithEmail.guest_email}</span>
                  </span>
                )}
                {(customerWithEmail.profile?.phone_number || customerWithEmail.guest_phone) && (
                  <span className="flex items-center gap-1">
                    <Phone className="h-3 w-3" />
                    {customerWithEmail.profile?.phone_number || customerWithEmail.guest_phone}
                  </span>
                )}
                {customerWithEmail.first_visit && (
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    Customer since {format(new Date(customerWithEmail.first_visit), 'MMM yyyy')}
                  </span>
                )}
                {customerWithEmail.profile?.membership_tier && (
                  <span className="flex items-center gap-1">
                    <Star className="h-3 w-3" />
                    {customerWithEmail.profile.membership_tier.charAt(0).toUpperCase() + customerWithEmail.profile.membership_tier.slice(1)} Member
                  </span>
                )}
              </div>

              {/* Tags */}
              <div className="flex flex-wrap gap-2 mt-3">
                {customerTags.map(tag => (
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
                {canManage && availableTags.some(tag => !customerTags.some(ct => ct.id === tag.id)) && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6"
                    onClick={() => setActiveTab('tags')}
                  >
                    <Plus className="h-3 w-3" />
                  </Button>
                )}
              </div>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="p-4">
                <CardTitle className="text-sm font-medium">Total Bookings</CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0">
                <div className="text-2xl font-bold">{totalBookingCount}</div>
                {customer.profile?.completed_bookings !== undefined && (
                  <p className="text-xs text-green-600 mt-1">
                    {customer.profile.completed_bookings} completed
                  </p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="p-4">
                <CardTitle className="text-sm font-medium">Loyalty Points</CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0">
                <div className="text-2xl font-bold">
                  {customer.profile?.loyalty_points || 0}
                </div>
                <p className="text-xs text-muted-foreground mt-1">points earned</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="p-4">
                <CardTitle className="text-sm font-medium">Reliability</CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0">
                <div className="text-2xl font-bold">
                  {customer.profile?.user_rating?.toFixed(1) || '5.0'}
                </div>
                <p className="text-xs text-muted-foreground mt-1">out of 5.0</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="p-4">
                <CardTitle className="text-sm font-medium">Issues</CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0">
                <div className="text-2xl font-bold text-red-600">
                  {customer.no_show_count + customer.cancelled_count}
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  {customer.no_show_count} no-shows, {customer.cancelled_count} cancellations
                </div>
              </CardContent>
            </Card>
          </div>
          
          {/* Additional Profile Info Cards */}
          {customer.profile && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {customer.profile.preferred_party_size && customer.profile.preferred_party_size !== 2 && (
                <Card>
                  <CardHeader className="p-4">
                    <CardTitle className="text-sm font-medium">Preferred Party Size</CardTitle>
                  </CardHeader>
                  <CardContent className="p-4 pt-0">
                    <div className="text-xl font-bold">{customer.profile.preferred_party_size}</div>
                    <p className="text-xs text-muted-foreground mt-1">typical group size</p>
                  </CardContent>
                </Card>
              )}
              
              {customer.total_spent > 0 && (
                <Card>
                  <CardHeader className="p-4">
                    <CardTitle className="text-sm font-medium">Est. Total Spent</CardTitle>
                  </CardHeader>
                  <CardContent className="p-4 pt-0">
                    <div className="text-xl font-bold">${customer.total_spent.toFixed(0)}</div>
                    <p className="text-xs text-muted-foreground mt-1">lifetime value</p>
                  </CardContent>
                </Card>
              )}
              
              {customer.average_party_size > 0 && (
                <Card>
                  <CardHeader className="p-4">
                    <CardTitle className="text-sm font-medium">Avg Party Size</CardTitle>
                  </CardHeader>
                  <CardContent className="p-4 pt-0">
                    <div className="text-xl font-bold">{customer.average_party_size.toFixed(1)}</div>
                    <p className="text-xs text-muted-foreground mt-1">actual average</p>
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="tags">Tags</TabsTrigger>
              <TabsTrigger value="notes">Notes</TabsTrigger>
              <TabsTrigger value="relationships">Relations</TabsTrigger>
              <TabsTrigger value="bookings">Bookings</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-4">
              {/* Customer Profile Information */}
              {customer.profile && (
                <div className="grid gap-4 md:grid-cols-2">
                  {/* Dietary Information */}
                  <Card>
                    <CardHeader>
                      <CardTitle>Dietary Information</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {customer.profile.dietary_restrictions && customer.profile.dietary_restrictions.length > 0 && (
                          <div>
                            <Label className="text-sm font-medium">Dietary Restrictions</Label>
                            <div className="flex flex-wrap gap-2 mt-1">
                              {customer.profile.dietary_restrictions.map((restriction, idx) => (
                                <Badge key={idx} variant="outline" className="text-orange-600 border-orange-600">
                                  {restriction}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}
                        
                        {customer.profile.allergies && customer.profile.allergies.length > 0 && (
                          <div>
                            <Label className="text-sm font-medium">Allergies</Label>
                            <div className="flex flex-wrap gap-2 mt-1">
                              {customer.profile.allergies.map((allergy, idx) => (
                                <Badge key={idx} variant="destructive">
                                  {allergy}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}
                        
                        {customer.profile.favorite_cuisines && customer.profile.favorite_cuisines.length > 0 && (
                          <div>
                            <Label className="text-sm font-medium">Favorite Cuisines</Label>
                            <div className="flex flex-wrap gap-2 mt-1">
                              {customer.profile.favorite_cuisines.map((cuisine, idx) => (
                                <Badge key={idx} variant="secondary" className="bg-blue-50 text-blue-700">
                                  {cuisine}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}
                        
                        {(!customer.profile.dietary_restrictions || customer.profile.dietary_restrictions.length === 0) &&
                         (!customer.profile.allergies || customer.profile.allergies.length === 0) &&
                         (!customer.profile.favorite_cuisines || customer.profile.favorite_cuisines.length === 0) && (
                          <p className="text-sm text-muted-foreground">No dietary information available</p>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                  
                  {/* Communication Preferences */}
                  <Card>
                    <CardHeader>
                      <CardTitle>Communication Preferences</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {customer.profile.notification_preferences && (
                          <div>
                            <Label className="text-sm font-medium">Notifications</Label>
                            <div className="flex flex-wrap gap-2 mt-1">
                              {customer.profile.notification_preferences.email && (
                                <Badge variant="outline" className="text-blue-600 border-blue-600">
                                  <Mail className="h-3 w-3 mr-1" />
                                  Email
                                </Badge>
                              )}
                              {customer.profile.notification_preferences.sms && (
                                <Badge variant="outline" className="text-green-600 border-green-600">
                                  <Phone className="h-3 w-3 mr-1" />
                                  SMS
                                </Badge>
                              )}
                              {customer.profile.notification_preferences.push && (
                                <Badge variant="outline" className="text-purple-600 border-purple-600">
                                  Push
                                </Badge>
                              )}
                            </div>
                          </div>
                        )}
                        
                        {customer.profile?.email && (
                          <div>
                            <Label className="text-sm font-medium">Email Status</Label>
                            <div className="flex items-center gap-2 mt-1">
                              <Badge variant="outline" className="text-green-600 border-green-600">
                                ✓ Registered User
                              </Badge>
                            </div>
                          </div>
                        )}
                        
                        {!customer.profile.notification_preferences && !customer.profile?.email && (
                          <p className="text-sm text-muted-foreground">No communication preferences available</p>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}

              {/* Customer Insights */}
              <Card>
                <CardHeader>
                  <CardTitle>Customer Insights</CardTitle>
                  <CardDescription>
                    Key information and behavioral patterns
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-6 md:grid-cols-2">
                    {/* Visit Information */}
                    <div className="space-y-4">
                      <h4 className="font-medium text-sm text-gray-900">Visit History</h4>
                      <div className="space-y-3 text-sm">
                        {customer.last_visit && (
                          <div className="space-y-1">
                            <span className="text-gray-600 font-medium">Last Visit</span>
                            <div className="text-gray-900 font-semibold">
                              {format(new Date(customer.last_visit), 'MMM d, yyyy')}
                            </div>
                          </div>
                        )}
                        {customer.first_visit && (
                          <div className="space-y-1">
                            <span className="text-gray-600 font-medium">First Visit</span>
                            <div className="text-gray-900 font-semibold">
                              {format(new Date(customer.first_visit), 'MMM d, yyyy')}
                            </div>
                          </div>
                        )}
                        {totalBookingCount > 0 && (
                          <div className="space-y-1">
                            <span className="text-gray-600 font-medium">Success Rate</span>
                            <div className="text-gray-900 font-semibold">
                              {totalBookingCount > 0 ? 
                                ((((customer.profile?.completed_bookings || 0) / totalBookingCount) * 100).toFixed(1) + '%') : 
                                'N/A'
                              }
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                    
                    {/* Preferences */}
                    <div className="space-y-4">
                      <h4 className="font-medium text-sm text-gray-900">Preferences</h4>
                      <div className="space-y-3 text-sm">
                        {customer.preferred_table_types && customer.preferred_table_types.length > 0 && (
                          <div className="space-y-1">
                            <span className="text-gray-600 font-medium">Preferred Tables</span>
                            <div className="text-gray-900 font-semibold">
                              {customer.preferred_table_types.map(type => type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())).join(', ')}
                            </div>
                          </div>
                        )}
                        {customer.preferred_time_slots && customer.preferred_time_slots.length > 0 && (
                          <div className="space-y-1">
                            <span className="text-gray-600 font-medium">Preferred Times</span>
                            <div className="text-gray-900 font-semibold">
                              {customer.preferred_time_slots.map(slot => slot.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())).join(', ')}
                            </div>
                          </div>
                        )}
                        {customer.profile?.preferred_party_size && (
                          <div className="space-y-1">
                            <span className="text-gray-600 font-medium">Preferred Party Size</span>
                            <div className="text-gray-900 font-semibold">
                              {customer.profile.preferred_party_size} people
                            </div>
                          </div>
                        )}
                        {customer.average_party_size > 0 && customer.profile?.preferred_party_size && 
                         customer.average_party_size !== customer.profile.preferred_party_size && (
                          <div className="space-y-1">
                            <span className="text-gray-600 font-medium">Actual Average Party Size</span>
                            <div className="text-gray-900 font-semibold">
                              {customer.average_party_size.toFixed(1)} people
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  {/* Special Notes */}
                  {customer.blacklisted && (
                    <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                      <div className="flex items-center gap-2 text-red-800">
                        <AlertCircle className="h-4 w-4" />
                        <span className="font-medium">Blacklisted Customer</span>
                      </div>
                      {customer.blacklist_reason && (
                        <p className="text-sm text-red-700 mt-1">
                          Reason: {customer.blacklist_reason}
                        </p>
                      )}
                    </div>
                  )}
                  
                  {customer.vip_status && (
                    <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                      <div className="flex items-center gap-2 text-yellow-800">
                        <Star className="h-4 w-4" />
                        <span className="font-medium">VIP Customer</span>
                      </div>
                      <p className="text-sm text-yellow-700 mt-1">
                        This customer receives priority booking and special treatment.
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="tags" className="space-y-4">
              {/* Tags Management */}
              <Card>
                <CardHeader>
                  <CardTitle>Customer Tags</CardTitle>
                  <CardDescription>
                    Assign tags to categorize and organize customers
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {/* Current Tags */}
                  <div className="space-y-4">
                    <div>
                      <Label className="text-sm font-medium">Current Tags</Label>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {customerTags.length > 0 ? (
                          customerTags.map(tag => (
                            <Badge
                              key={tag.id}
                              variant="default"
                              className="cursor-pointer hover:opacity-80"
                              style={{ backgroundColor: tag.color }}
                              onClick={() => canManage && handleToggleTag(tag)}
                            >
                              {tag.name}
                              {canManage && (
                                <X className="h-3 w-3 ml-1" />
                              )}
                            </Badge>
                          ))
                        ) : (
                          <p className="text-sm text-muted-foreground">No tags assigned</p>
                        )}
                      </div>
                    </div>

                    {/* Available Tags */}
                    {canManage && (
                      <div>
                        <Label className="text-sm font-medium">Available Tags</Label>
                        <div className="flex flex-wrap gap-2 mt-2">
                          {availableTags
                            .filter(tag => !customerTags.some(ct => ct.id === tag.id))
                            .map(tag => (
                              <Badge
                                key={tag.id}
                                variant="outline"
                                className="cursor-pointer hover:bg-muted"
                                style={{ 
                      borderColor: tag.color, 
                      color: isLightColor(tag.color) ? '#000000' : tag.color 
                    }}
                                onClick={() => handleToggleTag(tag)}
                              >
                                <Plus className="h-3 w-3 mr-1" />
                                {tag.name}
                              </Badge>
                            ))}
                          {availableTags.filter(tag => !customerTags.some(ct => ct.id === tag.id)).length === 0 && (
                            <p className="text-sm text-muted-foreground">All available tags have been assigned</p>
                          )}
                        </div>
                      </div>
                    )}

                    {!canManage && (
                      <p className="text-sm text-muted-foreground">
                        You don't have permission to manage customer tags
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="notes" className="space-y-4">
              {/* Add Note Form */}
              {canManage && (
                <Card>
                  <CardHeader>
                    <CardTitle>Add Note</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <Textarea
                        placeholder="Add a note about this customer..."
                        value={newNote.note}
                        onChange={(e) => setNewNote({ ...newNote, note: e.target.value })}
                        rows={3}
                      />
                      
                      <div className="flex justify-between items-center">
                        <div className="flex gap-2">
                          <Select
                            value={newNote.category}
                            onValueChange={(value: any) => setNewNote({ ...newNote, category: value })}
                          >
                            <SelectTrigger className="w-[180px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="general">General</SelectItem>
                              <SelectItem value="dietary">Dietary</SelectItem>
                              <SelectItem value="preference">Preference</SelectItem>
                              <SelectItem value="behavior">Behavior</SelectItem>
                              <SelectItem value="special_occasion">Special Occasion</SelectItem>
                            </SelectContent>
                          </Select>
                          
                          <label className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={newNote.is_important}
                              onChange={(e) => setNewNote({ ...newNote, is_important: e.target.checked })}
                              className="rounded"
                            />
                            <span className="text-sm">Important</span>
                          </label>
                        </div>
                        
                        <Button onClick={handleAddNote} disabled={!newNote.note.trim()}>
                          <Plus className="h-4 w-4 mr-2" />
                          Add Note
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Notes List */}
              <div className="space-y-2">
                {notes.map((note) => (
                  <Card key={note.id} className={note.is_important ? 'border-orange-300' : ''}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-lg">{getNoteIcon(note.category)}</span>
                            <Badge variant="outline" className="text-xs">
                              {note.category.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                            </Badge>
                            {note.is_important && (
                              <Badge variant="destructive" className="text-xs">
                                Important
                              </Badge>
                            )}
                          </div>
                          
                          <p className="text-sm">{note.note}</p>
                          
                          <div className="flex items-center gap-2 mt-2 text-xs text-gray-500">
                            <span>{note.created_by_profile?.full_name}</span>
                            <span>•</span>
                            <span>{format(new Date(note.created_at), 'MMM d, yyyy')}</span>
                          </div>
                        </div>
                        
                        {canManage && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDeleteNote(note.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
                
                {notes.length === 0 && (
                  <Card>
                    <CardContent className="p-8 text-center text-gray-500">
                      No notes yet. Add a note to keep track of important information about this customer.
                    </CardContent>
                  </Card>
                )}
              </div>
            </TabsContent>

            <TabsContent value="relationships" className="space-y-4">
              {/* Add Relationship Form */}
              {canManage && (
                <Card>
                  <CardHeader>
                    <CardTitle>Add Relationship</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {/* Select Customer */}
                      <div>
                        <Label className="text-sm font-medium">Select Customer</Label>
                        <Select
                          value={newRelationship.related_customer_id}
                          onValueChange={(value) => 
                            setNewRelationship({ ...newRelationship, related_customer_id: value })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Choose a customer..." />
                          </SelectTrigger>
                          <SelectContent className="max-h-60">
                            {availableCustomers.length === 0 ? (
                              <div className="px-2 py-1.5 text-sm text-muted-foreground">
                                No other customers found
                              </div>
                            ) : (
                              availableCustomers.map((customer) => (
                                <SelectItem key={customer.id} value={customer.id}>
                                  <div className="flex items-center gap-2">
                                    <Avatar className="h-6 w-6">
                                      <AvatarImage src={customer.profile?.avatar_url || undefined} />
                                      <AvatarFallback className="text-xs">
                                        {(customer.profile?.full_name || customer.guest_name || 'G')
                                          .split(' ')
                                          .map(n => n[0])
                                          .join('')
                                          .toUpperCase()}
                                      </AvatarFallback>
                                    </Avatar>
                                    <div className="text-left">
                                      <div className="font-medium">
                                        {customer.profile?.full_name || customer.guest_name || 'Guest'}
                                      </div>
                                      {customer.guest_email && (
                                        <div className="text-xs text-muted-foreground">
                                          {customer.guest_email}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </SelectItem>
                              ))
                            )}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Relationship Type */}
                      <div>
                        <Label className="text-sm font-medium">Relationship Type</Label>
                        <Select
                          value={newRelationship.relationship_type}
                          onValueChange={(value: any) => 
                            setNewRelationship({ ...newRelationship, relationship_type: value })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="spouse">Spouse</SelectItem>
                            <SelectItem value="parent">Parent</SelectItem>
                            <SelectItem value="child">Child</SelectItem>
                            <SelectItem value="sibling">Sibling</SelectItem>
                            <SelectItem value="friend">Friend</SelectItem>
                            <SelectItem value="colleague">Colleague</SelectItem>
                            <SelectItem value="partner">Partner</SelectItem>
                            <SelectItem value="other">Other</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Relationship Details */}
                      <div>
                        <Label className="text-sm font-medium">Details (Optional)</Label>
                        <Input
                          placeholder="Add additional details about the relationship..."
                          value={newRelationship.relationship_details}
                          onChange={(e) => 
                            setNewRelationship({ ...newRelationship, relationship_details: e.target.value })
                          }
                        />
                      </div>

                      <Button 
                        onClick={handleAddRelationship}
                        disabled={!newRelationship.related_customer_id}
                      >
                        <Link2 className="h-4 w-4 mr-2" />
                        Add Relationship
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Relationships List */}
              <div className="space-y-2">
                {relationships.map((rel) => {
                  // Logic to determine which customer to show (the OTHER person in the relationship)
                  const isCurrentCustomerTheCreator = rel.customer_id === customer.id
                  const relatedCustomer = isCurrentCustomerTheCreator ? rel.related_customer : rel.customer
                  
                  return (
                    <Card key={rel.id}>
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <Avatar>
                              <AvatarImage src={relatedCustomer?.profile?.avatar_url} />
                              <AvatarFallback>
                                {(relatedCustomer?.profile?.full_name || relatedCustomer?.guest_name || 'G')[0]}
                              </AvatarFallback>
                            </Avatar>
                            
                            <div>
                              <p className="font-medium">
                                {relatedCustomer?.profile?.full_name || relatedCustomer?.guest_name}
                              </p>
                              <p className="text-sm text-gray-600">
                                {rel.relationship_type.charAt(0).toUpperCase() + rel.relationship_type.slice(1)}
                                {rel.relationship_details && ` - ${rel.relationship_details}`}
                              </p>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )
                })}
                
                {relationships.length === 0 && (
                  <Card>
                    <CardContent className="p-8 text-center text-gray-500">
                      No relationships defined yet.
                    </CardContent>
                  </Card>
                )}
              </div>
            </TabsContent>

            <TabsContent value="bookings" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Recent Bookings</CardTitle>
                  <CardDescription>
                    Showing last 10 of {totalBookingCount} total bookings for this restaurant
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {bookingHistory.map((booking) => (
                      <div
                        key={booking.id}
                        className="flex items-start justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                      >
                        <div className="space-y-1">
                          <p className="font-medium">
                            {format(new Date(booking.booking_time), 'MMM d, yyyy - h:mm a')}
                          </p>
                          <div className="flex items-center gap-4 text-sm text-gray-600">
                            <span className="flex items-center gap-1">
                              <Users className="h-3 w-3" />
                              Party of {booking.party_size}
                            </span>
                            {booking.occasion && (
                              <span className="flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                {booking.occasion}
                              </span>
                            )}
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {format(new Date(booking.created_at), 'MMM d')}
                            </span>
                          </div>
                          {booking.special_requests && (
                            <p className="text-sm text-muted-foreground mt-1">
                              Special requests: {booking.special_requests}
                            </p>
                          )}
                          {booking.dietary_notes && booking.dietary_notes.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {booking.dietary_notes.map((note: string, idx: number) => (
                                <Badge key={idx} variant="outline" className="text-xs">
                                  {note}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </div>
                        
                        <div className="flex flex-col items-end gap-2">
                          <Badge
                            variant={
                              booking.status === 'completed' ? 'default' :
                              booking.status === 'confirmed' ? 'secondary' :
                              booking.status === 'cancelled_by_user' || booking.status === 'cancelled_by_restaurant' ? 'destructive' :
                              booking.status === 'no_show' ? 'destructive' :
                              'outline'
                            }
                          >
                            {booking.status.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())}
                          </Badge>
                          {booking.confirmation_code && (
                            <span className="text-xs text-muted-foreground">
                              #{booking.confirmation_code}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                    
                    {bookingHistory.length === 0 && (
                      <div className="text-center py-8">
                        <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                        <p className="text-muted-foreground">
                          No booking history found.
                        </p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  )
}