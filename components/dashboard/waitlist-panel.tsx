// components/dashboard/waitlist-panel.tsx
"use client"

import React, { useState, useCallback, useMemo } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { cn } from "@/lib/utils"
import { format, parseISO, differenceInMinutes, isToday, isTomorrow } from "date-fns"
import { createClient } from "@/lib/supabase/client"
import { toast } from "react-hot-toast"
import {
  Clock,
  Users,
  Calendar,
  Phone,
  AlertCircle,
  CheckCircle,
  XCircle,
  UserPlus,
  Bell,
  ArrowRight,
  Timer,
  Plus,
  Search,
  Filter,
  ChevronRight,
  Info,
  RefreshCw
} from "lucide-react"

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

interface WaitlistPanelProps {
  restaurantId: string
  currentTime: Date
  tables: any[]
  bookings: any[]
  onConvertToBooking: (entry: WaitlistEntry, tableIds?: string[]) => void
  onRefresh?: () => void
  className?: string
}

export function WaitlistPanel({
  restaurantId,
  currentTime,
  tables,
  bookings,
  onConvertToBooking,
  onRefresh,
  className
}: WaitlistPanelProps) {
  const [waitlistEntries, setWaitlistEntries] = useState<WaitlistEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("active")
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [selectedEntry, setSelectedEntry] = useState<WaitlistEntry | null>(null)
  const [showNotifyDialog, setShowNotifyDialog] = useState(false)
  const [notifyingEntry, setNotifyingEntry] = useState<WaitlistEntry | null>(null)
  
  const supabase = createClient()

  // Load waitlist entries
  const loadWaitlist = useCallback(async () => {
    if (!restaurantId) return
    
    try {
      setLoading(true)
      
      // Run automation first
      await supabase.rpc('process_waitlist_automation')
      
      // Fetch entries
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
        .eq('desired_date', format(currentTime, 'yyyy-MM-dd'))
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Error loading waitlist:', error)
        return
      }

      setWaitlistEntries(data || [])
    } finally {
      setLoading(false)
    }
  }, [restaurantId, currentTime])

  // Load on mount and when restaurant changes
  React.useEffect(() => {
    loadWaitlist()
  }, [loadWaitlist])

  // Auto-refresh every 30 seconds
  React.useEffect(() => {
    const interval = setInterval(loadWaitlist, 30000)
    return () => clearInterval(interval)
  }, [loadWaitlist])

  // Update status
  const updateStatus = async (entryId: string, newStatus: string) => {
    try {
      const updateData: any = { status: newStatus }
      
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
      loadWaitlist()
    } catch (error) {
      console.error('Error updating status:', error)
      toast.error('Failed to update status')
    }
  }

  // Check table availability for waitlist entry
  const checkAvailability = useCallback((entry: WaitlistEntry) => {
    // Find available tables for the party size
    const availableTables = tables.filter(table => {
      if (!table.is_active) return false
      
      // Check if table is occupied
      const isOccupied = bookings.some(booking => {
        const diningStatuses = ['arrived', 'seated', 'ordered', 'appetizers', 'main_course', 'dessert', 'payment']
        return diningStatuses.includes(booking.status) && 
               booking.tables?.some((t: any) => t.id === table.id)
      })
      
      return !isOccupied && table.max_capacity >= entry.party_size
    })
    
    return availableTables.length > 0
  }, [tables, bookings])

  // Notify customer
  const notifyCustomer = async (entry: WaitlistEntry) => {
    if (!checkAvailability(entry)) {
      toast.error("No tables available for this party size")
      return
    }
    
    setNotifyingEntry(entry)
    setShowNotifyDialog(true)
  }

  // Confirm notification
  const confirmNotification = async () => {
    if (!notifyingEntry) return
    
    await updateStatus(notifyingEntry.id, 'notified')
    
    // Send actual notification (SMS/Push/Email)
    // This would integrate with your notification service
    
    setShowNotifyDialog(false)
    setNotifyingEntry(null)
  }

  // Convert to booking
  const handleConvertToBooking = async (entry: WaitlistEntry) => {
    // Find suitable tables
    const availableTables = tables.filter(table => {
      if (!table.is_active) return false
      
      const isOccupied = bookings.some(booking => {
        const diningStatuses = ['arrived', 'seated', 'ordered', 'appetizers', 'main_course', 'dessert', 'payment']
        return diningStatuses.includes(booking.status) && 
               booking.tables?.some((t: any) => t.id === table.id)
      })
      
      return !isOccupied && table.max_capacity >= entry.party_size
    })
    
    if (availableTables.length === 0) {
      toast.error("No suitable tables available")
      return
    }
    
    // Auto-select best fitting table
    const bestTable = availableTables.sort((a, b) => {
      const aDiff = Math.abs(a.max_capacity - entry.party_size)
      const bDiff = Math.abs(b.max_capacity - entry.party_size)
      return aDiff - bDiff
    })[0]
    
    onConvertToBooking(entry, [bestTable.id])
    await updateStatus(entry.id, 'booked')
  }

  // Filter entries
  const filteredEntries = useMemo(() => {
    return waitlistEntries.filter(entry => {
      // Status filter
      if (statusFilter !== 'all' && entry.status !== statusFilter) return false
      
      // Search filter
      if (searchTerm) {
        const search = searchTerm.toLowerCase()
        const name = (entry.user?.full_name || entry.guest_name || '').toLowerCase()
        const phone = (entry.user?.phone_number || entry.guest_phone || '').toLowerCase()
        return name.includes(search) || phone.includes(search)
      }
      
      return true
    })
  }, [waitlistEntries, statusFilter, searchTerm])

  // Stats
  const stats = {
    active: waitlistEntries.filter(e => e.status === 'active').length,
    notified: waitlistEntries.filter(e => e.status === 'notified').length,
    total: waitlistEntries.length
  }

  // Get entry urgency
  const getEntryUrgency = (entry: WaitlistEntry) => {
    const [startTime] = entry.desired_time_range.split('-')
    const desiredTime = new Date(`${entry.desired_date}T${startTime}:00`)
    const minutesUntil = differenceInMinutes(desiredTime, currentTime)
    
    if (minutesUntil < 0) return 'overdue'
    if (minutesUntil <= 15) return 'urgent'
    if (minutesUntil <= 30) return 'soon'
    return 'normal'
  }

  // Render individual entry
  const renderEntry = (entry: WaitlistEntry) => {
    const urgency = getEntryUrgency(entry)
    const hasAvailability = checkAvailability(entry)
    const isNotified = entry.status === 'notified'
    const isExpired = entry.status === 'expired'
    
    return (
      <div
        key={entry.id}
        className={cn(
          "p-2 rounded-lg border transition-all",
          urgency === 'overdue' && "border-red-500 bg-red-50 dark:bg-red-900/20",
          urgency === 'urgent' && "border-orange-500 bg-orange-50 dark:bg-orange-900/20",
          urgency === 'soon' && "border-yellow-500 bg-yellow-50 dark:bg-yellow-900/20",
          urgency === 'normal' && "border-border bg-card",
          isNotified && "border-blue-500 bg-blue-50 dark:bg-blue-900/20",
          isExpired && "opacity-50"
        )}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            {/* Customer info */}
            <div className="flex items-center gap-1 mb-1">
              <p className="font-medium text-sm truncate">
                {entry.user?.full_name || entry.guest_name || 'Guest'}
              </p>
              <Badge 
                className={cn(
                  "text-xs px-1 py-0 h-4",
                  entry.status === 'active' && "bg-green-100 text-green-800",
                  entry.status === 'notified' && "bg-blue-100 text-blue-800",
                  entry.status === 'booked' && "bg-purple-100 text-purple-800",
                  entry.status === 'expired' && "bg-gray-100 text-gray-800"
                )}
              >
                {entry.status}
              </Badge>
            </div>
            
            {/* Details */}
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-0.5">
                <Clock className="h-3 w-3" />
                {entry.desired_time_range}
              </span>
              <span className="flex items-center gap-0.5">
                <Users className="h-3 w-3" />
                {entry.party_size}
              </span>
              {(entry.user?.phone_number || entry.guest_phone) && (
                <span className="flex items-center gap-0.5">
                  <Phone className="h-3 w-3" />
                  {entry.user?.phone_number || entry.guest_phone}
                </span>
              )}
            </div>
            
            {/* Notification expiry warning */}
            {isNotified && entry.notification_expires_at && (
              <div className="mt-1">
                <span className="text-xs text-blue-600 font-medium">
                  Expires: {format(parseISO(entry.notification_expires_at), 'h:mm a')}
                </span>
              </div>
            )}
          </div>
          
          {/* Actions */}
          <div className="flex flex-col gap-1">
            {entry.status === 'active' && (
              <>
                {hasAvailability ? (
                  <Button
                    size="sm"
                    onClick={() => notifyCustomer(entry)}
                    className="h-6 px-2 text-xs bg-blue-600 hover:bg-blue-700"
                  >
                    <Bell className="h-3 w-3 mr-1" />
                    Notify
                  </Button>
                ) : (
                  <Badge className="text-xs bg-gray-100 text-gray-600">
                    No tables
                  </Badge>
                )}
              </>
            )}
            
            {entry.status === 'notified' && (
              <Button
                size="sm"
                onClick={() => handleConvertToBooking(entry)}
                className="h-6 px-2 text-xs bg-green-600 hover:bg-green-700"
              >
                <CheckCircle className="h-3 w-3 mr-1" />
                Book
              </Button>
            )}
            
            {['active', 'notified'].includes(entry.status) && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => updateStatus(entry.id, 'expired')}
                className="h-6 px-2 text-xs text-red-600 hover:text-red-700"
              >
                <XCircle className="h-3 w-3" />
              </Button>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={cn("flex flex-col h-full", className)}>
      {/* Header */}
      <div className="px-2 py-1.5 border-b border-border flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Timer className="h-3.5 w-3.5 text-orange-500" />
            <h3 className="text-xs font-semibold">Waitlist</h3>
            <Badge className="text-xs px-1 py-0 bg-orange-100 text-orange-800">
              {stats.active}
            </Badge>
          </div>
          <Button
            size="sm"
            variant="ghost"
            onClick={loadWaitlist}
            className="h-5 w-5 p-0"
          >
            <RefreshCw className="h-3 w-3" />
          </Button>
        </div>
      </div>
      
      {/* Quick stats */}
      {stats.total > 0 && (
        <div className="px-2 py-1 flex items-center gap-2 text-xs border-b border-border">
          <span className="flex items-center gap-1">
            <div className="h-1.5 w-1.5 bg-green-500 rounded-full" />
            <span className="text-green-600">{stats.active} waiting</span>
          </span>
          {stats.notified > 0 && (
            <span className="flex items-center gap-1">
              <div className="h-1.5 w-1.5 bg-blue-500 rounded-full animate-pulse" />
              <span className="text-blue-600">{stats.notified} notified</span>
            </span>
          )}
        </div>
      )}
      
      {/* Filters */}
      <div className="px-2 py-1 flex items-center gap-1 border-b border-border">
        <div className="flex-1 relative">
          <Search className="absolute left-1.5 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
          <Input
            placeholder="Search..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="h-6 pl-6 text-xs"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="h-6 w-20 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="notified">Notified</SelectItem>
            <SelectItem value="expired">Expired</SelectItem>
          </SelectContent>
        </Select>
      </div>
      
      {/* Entries list */}
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1.5">
          {loading ? (
            <div className="text-center py-4">
              <Clock className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
            </div>
          ) : filteredEntries.length === 0 ? (
            <div className="text-center py-6">
              <Timer className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No waitlist entries</p>
              <p className="text-xs text-muted-foreground mt-1">
                {searchTerm || statusFilter !== 'all' ? 'Try adjusting filters' : 'Customers can join when tables are full'}
              </p>
            </div>
          ) : (
            filteredEntries.map(renderEntry)
          )}
        </div>
      </ScrollArea>
      
      {/* Notify confirmation dialog */}
      <Dialog open={showNotifyDialog} onOpenChange={setShowNotifyDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Bell className="h-4 w-4 text-blue-600" />
              Notify Customer
            </DialogTitle>
            <DialogDescription>
              Send notification that a table is available
            </DialogDescription>
          </DialogHeader>
          {notifyingEntry && (
            <div className="space-y-3 py-3">
              <div className="p-3 bg-muted rounded-lg">
                <p className="font-medium text-sm">
                  {notifyingEntry.user?.full_name || notifyingEntry.guest_name}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Party of {notifyingEntry.party_size} • {notifyingEntry.desired_time_range}
                </p>
              </div>
              <Alert className="border-blue-200 bg-blue-50">
                <Info className="h-4 w-4 text-blue-600" />
                <AlertDescription className="text-xs">
                  Customer will have 15 minutes to respond before the notification expires.
                </AlertDescription>
              </Alert>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNotifyDialog(false)}>
              Cancel
            </Button>
            <Button onClick={confirmNotification} className="bg-blue-600 hover:bg-blue-700">
              Send Notification
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}