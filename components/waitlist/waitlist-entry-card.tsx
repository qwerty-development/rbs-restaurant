// components/waitlist/waitlist-entry-card.tsx

import { useState } from 'react'
import { format, parseISO } from 'date-fns'
import { 
  Clock, 
  Users, 
  Calendar,
  Phone,
  Mail,
  CheckCircle,
  XCircle,
  MoreVertical,
  User,
  CalendarPlus
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Card, CardContent } from '@/components/ui/card'
import { formatTimeRange, getTableTypeDisplay, getStatusColor } from '@/lib/utils/time-utils'
import type { WaitlistEntry } from '@/types'

interface WaitlistEntryCardProps {
  entry: WaitlistEntry
  onStatusUpdate: (entryId: string, newStatus: string) => Promise<void>
  onCreateBooking?: (entry: WaitlistEntry) => void
}

export function WaitlistEntryCard({ entry, onStatusUpdate, onCreateBooking }: WaitlistEntryCardProps) {
  const [isUpdating, setIsUpdating] = useState(false)

  const handleStatusUpdate = async (newStatus: string) => {
    setIsUpdating(true)
    try {
      await onStatusUpdate(entry.id, newStatus)
    } finally {
      setIsUpdating(false)
    }
  }

  const handleCreateBooking = () => {
    if (onCreateBooking) {
      onCreateBooking(entry)
    }
  }

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Avatar className="h-12 w-12">
              <AvatarImage src={entry.user?.avatar_url} />
              <AvatarFallback>
                <User className="h-6 w-6" />
              </AvatarFallback>
            </Avatar>
            <div className="space-y-1">
              <div className="flex items-center space-x-3">
                <h3 className="font-semibold text-lg">
                  {entry.user?.full_name || 'Unknown Customer'}
                </h3>
                <Badge className={getStatusColor(entry.status)}>
                  {entry.status.charAt(0).toUpperCase() + entry.status.slice(1)}
                </Badge>
              </div>
              <div className="flex items-center space-x-6 text-sm text-muted-foreground">
                <div className="flex items-center space-x-1">
                  <Calendar className="h-4 w-4" />
                  <span>{format(parseISO(entry.desired_date), 'MMM dd, yyyy')}</span>
                </div>
                <div className="flex items-center space-x-1">
                  <Clock className="h-4 w-4" />
                  <span>{formatTimeRange(entry.desired_time_range)}</span>
                </div>
                <div className="flex items-center space-x-1">
                  <Users className="h-4 w-4" />
                  <span>{entry.party_size} {entry.party_size === 1 ? 'guest' : 'guests'}</span>
                </div>
              </div>
              <div className="flex items-center space-x-6 text-sm text-muted-foreground">
                {entry.user?.phone_number && (
                  <div className="flex items-center space-x-1">
                    <Phone className="h-4 w-4" />
                    <span>{entry.user.phone_number}</span>
                  </div>
                )}
                <div>
                  <span className="font-medium">Table Preference:</span> {getTableTypeDisplay(entry.table_type)}
                </div>
              </div>
              <div className="text-xs text-muted-foreground">
                Added on {format(parseISO(entry.created_at), 'MMM dd, yyyy at HH:mm')}
              </div>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            {/* Quick Action Buttons */}
            {entry.status === 'active' && (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleStatusUpdate('notified')}
                  disabled={isUpdating}
                >
                  Mark Notified
                </Button>
                <Button
                  size="sm"
                  onClick={() => handleStatusUpdate('booked')}
                  disabled={isUpdating}
                >
                  Mark as Booked
                </Button>
              </>
            )}
            {entry.status === 'notified' && (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleCreateBooking}
                  disabled={isUpdating}
                >
                  <CalendarPlus className="h-4 w-4 mr-2" />
                  Create Booking
                </Button>
                <Button
                  size="sm"
                  onClick={() => handleStatusUpdate('booked')}
                  disabled={isUpdating}
                >
                  Mark as Booked
                </Button>
              </>
            )}
            
            {/* More Actions Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" disabled={isUpdating}>
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>Actions</DropdownMenuLabel>
                <DropdownMenuSeparator />
                
                {onCreateBooking && !['booked', 'expired'].includes(entry.status) && (
                  <DropdownMenuItem onClick={handleCreateBooking}>
                    <CalendarPlus className="h-4 w-4 mr-2" />
                    Create Booking
                  </DropdownMenuItem>
                )}
                
                {entry.status !== 'notified' && !['booked', 'expired'].includes(entry.status) && (
                  <DropdownMenuItem
                    onClick={() => handleStatusUpdate('notified')}
                  >
                    <Phone className="h-4 w-4 mr-2" />
                    Mark as Notified
                  </DropdownMenuItem>
                )}
                
                {!['booked', 'expired'].includes(entry.status) && (
                  <DropdownMenuItem
                    onClick={() => handleStatusUpdate('booked')}
                  >
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Mark as Booked
                  </DropdownMenuItem>
                )}
                
                {!['expired', 'booked'].includes(entry.status) && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() => handleStatusUpdate('expired')}
                      className="text-red-600"
                    >
                      <XCircle className="h-4 w-4 mr-2" />
                      Mark as Expired
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
