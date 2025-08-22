'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { 
  Clock, 
  Users, 
  Calendar,
  Phone,
  Mail,
  Search,
  CheckCircle,
  XCircle,
  AlertCircle,
  RefreshCw,
  Plus
} from 'lucide-react'
import { toast } from 'react-hot-toast'
import { format, parseISO, isToday, isTomorrow } from 'date-fns'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

// Types
interface WaitlistEntry {
  id: string
  user_id: string | null
  restaurant_id: string
  desired_date: string
  desired_time_range: string
  party_size: number
  table_type: string
  status: 'active' | 'notified' | 'booked' | 'expired' | 'cancelled'
  guest_name?: string
  guest_email?: string
  guest_phone?: string
  special_requests?: string
  notified_at?: string
  notification_expires_at?: string
  expires_at?: string
  created_at: string
  user?: {
    id: string
    full_name: string
    phone_number?: string
    avatar_url?: string
  }
}

export default function WaitlistPage() {
  const router = useRouter()
  const supabase = createClient()
  
  // State
  const [waitlistEntries, setWaitlistEntries] = useState<WaitlistEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [restaurantId, setRestaurantId] = useState<string>('')
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [activeTab, setActiveTab] = useState('active')
  const [showAddDialog, setShowAddDialog] = useState(false)
  
  // Form state for manual entry
  const [manualEntry, setManualEntry] = useState({
    guest_name: '',
    guest_phone: '',
    guest_email: '',
    desired_date: '',
    desired_time_range: '',
    party_size: 2,
    table_type: 'any',
    special_requests: ''
  })

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
  }, [])

  // Load waitlist entries
  const loadWaitlistEntries = useCallback(async () => {
    if (!restaurantId) return
    
    try {
      setLoading(true)
      
      // First, run automation to expire old entries
      await supabase.rpc('process_waitlist_automation')
      
      // Then fetch current entries
      const { data, error } = await supabase
        .from('waitlist')
        .select(`
          *,
          user:profiles(
            id,
            full_name,
            phone_number,
            avatar_url
          )
        `)
        .eq('restaurant_id', restaurantId)
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Error loading waitlist:', error)
        toast.error('Failed to load waitlist')
        return
      }

      setWaitlistEntries(data || [])
    } catch (error) {
      console.error('Error:', error)
      toast.error('Failed to load waitlist')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [restaurantId])

  // Load entries when restaurant ID is available
  useEffect(() => {
    if (restaurantId) {
      loadWaitlistEntries()
    }
  }, [restaurantId, loadWaitlistEntries])

  // Auto-refresh every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      if (restaurantId && !refreshing) {
        loadWaitlistEntries()
      }
    }, 30000)
    
    return () => clearInterval(interval)
  }, [restaurantId, refreshing, loadWaitlistEntries])

  // Update waitlist status
  const updateStatus = async (entryId: string, newStatus: string) => {
    try {
      const updateData: any = { status: newStatus }
      
      // Add notification expiration if marking as notified
      if (newStatus === 'notified') {
        updateData.notified_at = new Date().toISOString()
        updateData.notification_expires_at = new Date(Date.now() + 15 * 60 * 1000).toISOString()
      }

      const { error } = await supabase
        .from('waitlist')
        .update(updateData)
        .eq('id', entryId)

      if (error) throw error

      toast.success(`Status updated to ${newStatus}`)
      loadWaitlistEntries()
    } catch (error) {
      console.error('Error updating status:', error)
      toast.error('Failed to update status')
    }
  }

  // Convert to booking
  const convertToBooking = async (entryId: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        toast.error('You must be logged in')
        return
      }

      const { data, error } = await supabase
        .rpc('convert_waitlist_to_booking', {
          p_waitlist_id: entryId,
          p_staff_user_id: user.id
        })

      if (error) throw error

      toast.success('Successfully converted to booking!')
      loadWaitlistEntries()
    } catch (error) {
      console.error('Error converting to booking:', error)
      toast.error('Failed to convert to booking')
    }
  }

  // Add manual waitlist entry
  const addManualEntry = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      
      const { error } = await supabase
        .from('waitlist')
        .insert({
          restaurant_id: restaurantId,
          user_id: null, // Manual entry, no user account
          ...manualEntry,
          status: 'active'
        })

      if (error) throw error

      toast.success('Waitlist entry added successfully')
      setShowAddDialog(false)
      setManualEntry({
        guest_name: '',
        guest_phone: '',
        guest_email: '',
        desired_date: '',
        desired_time_range: '',
        party_size: 2,
        table_type: 'any',
        special_requests: ''
      })
      loadWaitlistEntries()
    } catch (error) {
      console.error('Error adding entry:', error)
      toast.error('Failed to add waitlist entry')
    }
  }

  // Filter entries
  const filteredEntries = waitlistEntries.filter(entry => {
    // Search filter
    if (searchTerm) {
      const search = searchTerm.toLowerCase()
      const name = (entry.user?.full_name || entry.guest_name || '').toLowerCase()
      const phone = (entry.user?.phone_number || entry.guest_phone || '').toLowerCase()
      if (!name.includes(search) && !phone.includes(search)) return false
    }

    // Status filter
    if (statusFilter !== 'all' && entry.status !== statusFilter) return false

    // Tab filter
    if (activeTab === 'active' && !['active', 'notified'].includes(entry.status)) return false
    if (activeTab === 'completed' && !['booked', 'expired', 'cancelled'].includes(entry.status)) return false

    return true
  })

  // Get status color
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-blue-100 text-blue-800'
      case 'notified': return 'bg-yellow-100 text-yellow-800'
      case 'booked': return 'bg-green-100 text-green-800'
      case 'expired': return 'bg-gray-100 text-gray-800'
      case 'cancelled': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  // Format date
  const formatDate = (date: string) => {
    const d = parseISO(date)
    if (isToday(d)) return 'Today'
    if (isTomorrow(d)) return 'Tomorrow'
    return format(d, 'MMM d')
  }

  // Stats
  const stats = {
    total: waitlistEntries.length,
    active: waitlistEntries.filter(e => e.status === 'active').length,
    notified: waitlistEntries.filter(e => e.status === 'notified').length,
    completed: waitlistEntries.filter(e => ['booked', 'expired'].includes(e.status)).length
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Clock className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Waiting List</h1>
          <p className="text-muted-foreground">Manage your restaurant's waitlist</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => {
              setRefreshing(true)
              loadWaitlistEntries()
            }}
            disabled={refreshing}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button onClick={() => setShowAddDialog(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Entry
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Active</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{stats.active}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Notified</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{stats.notified}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Completed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.completed}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex gap-4">
        <div className="flex-1">
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name or phone..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="notified">Notified</SelectItem>
            <SelectItem value="booked">Booked</SelectItem>
            <SelectItem value="expired">Expired</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="active">Active</TabsTrigger>
          <TabsTrigger value="completed">Completed</TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="space-y-4">
          {filteredEntries.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No waitlist entries found</p>
              </CardContent>
            </Card>
          ) : (
            filteredEntries.map((entry) => (
              <Card key={entry.id}>
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-4">
                      <Avatar>
                        <AvatarImage src={entry.user?.avatar_url} />
                        <AvatarFallback>
                          {(entry.user?.full_name || entry.guest_name || 'G')[0]}
                        </AvatarFallback>
                      </Avatar>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold">
                            {entry.user?.full_name || entry.guest_name || 'Guest'}
                          </h3>
                          <Badge className={getStatusColor(entry.status)}>
                            {entry.status}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {formatDate(entry.desired_date)}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {entry.desired_time_range}
                          </span>
                          <span className="flex items-center gap-1">
                            <Users className="h-3 w-3" />
                            {entry.party_size} people
                          </span>
                        </div>
                        {(entry.user?.phone_number || entry.guest_phone) && (
                          <div className="flex items-center gap-2 text-sm">
                            <Phone className="h-3 w-3" />
                            {entry.user?.phone_number || entry.guest_phone}
                          </div>
                        )}
                        {entry.notification_expires_at && entry.status === 'notified' && (
                          <p className="text-sm text-yellow-600">
                            Expires: {format(parseISO(entry.notification_expires_at), 'h:mm a')}
                          </p>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex gap-2">
                      {entry.status === 'active' && (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => updateStatus(entry.id, 'notified')}
                          >
                            <AlertCircle className="h-4 w-4 mr-1" />
                            Notify
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => convertToBooking(entry.id)}
                          >
                            <CheckCircle className="h-4 w-4 mr-1" />
                            Book
                          </Button>
                        </>
                      )}
                      {entry.status === 'notified' && (
                        <Button
                          size="sm"
                          onClick={() => convertToBooking(entry.id)}
                        >
                          <CheckCircle className="h-4 w-4 mr-1" />
                          Convert to Booking
                        </Button>
                      )}
                      {['active', 'notified'].includes(entry.status) && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-red-600"
                          onClick={() => updateStatus(entry.id, 'expired')}
                        >
                          <XCircle className="h-4 w-4 mr-1" />
                          Expire
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>

      {/* Add Entry Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Waitlist Entry</DialogTitle>
            <DialogDescription>
              Manually add a customer to the waitlist
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Guest Name</label>
              <Input
                value={manualEntry.guest_name}
                onChange={(e) => setManualEntry({ ...manualEntry, guest_name: e.target.value })}
                placeholder="John Doe"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Phone Number</label>
              <Input
                value={manualEntry.guest_phone}
                onChange={(e) => setManualEntry({ ...manualEntry, guest_phone: e.target.value })}
                placeholder="+1234567890"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Date</label>
                <Input
                  type="date"
                  value={manualEntry.desired_date}
                  onChange={(e) => setManualEntry({ ...manualEntry, desired_date: e.target.value })}
                  min={new Date().toISOString().split('T')[0]}
                />
              </div>
              <div>
                <label className="text-sm font-medium">Time Range</label>
                <Input
                  value={manualEntry.desired_time_range}
                  onChange={(e) => setManualEntry({ ...manualEntry, desired_time_range: e.target.value })}
                  placeholder="19:00-21:00"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Party Size</label>
                <Input
                  type="number"
                  value={manualEntry.party_size}
                  onChange={(e) => setManualEntry({ ...manualEntry, party_size: parseInt(e.target.value) || 1 })}
                  min="1"
                  max="20"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Table Type</label>
                <Select 
                  value={manualEntry.table_type} 
                  onValueChange={(value) => setManualEntry({ ...manualEntry, table_type: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="any">Any</SelectItem>
                    <SelectItem value="indoor">Indoor</SelectItem>
                    <SelectItem value="outdoor">Outdoor</SelectItem>
                    <SelectItem value="bar">Bar</SelectItem>
                    <SelectItem value="private">Private</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowAddDialog(false)}>
                Cancel
              </Button>
              <Button onClick={addManualEntry}>
                Add Entry
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}