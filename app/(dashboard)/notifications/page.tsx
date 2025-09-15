// app/(dashboard)/notifications/page.tsx

import { Bell, Check, X, Clock, UserPlus, Calendar, AlertCircle } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { NotificationTestPanel } from '@/components/notifications/notification-test-panel'

// Mock notification data - replace with real data from Supabase
const notifications = [
  {
    id: 1,
    type: 'booking',
    title: 'New Booking Request',
    message: 'John Doe has requested a table for 4 people on Dec 25, 2024 at 7:00 PM',
    time: '2 minutes ago',
    unread: true,
    icon: Calendar,
    action: 'booking'
  },
  {
    id: 2,
    type: 'staff',
    title: 'Staff Member Added',
    message: 'Sarah Johnson has been added as a new staff member',
    time: '1 hour ago',
    unread: true,
    icon: UserPlus,
    action: 'staff'
  },
  {
    id: 3,
    type: 'alert',
    title: 'Table Availability Alert',
    message: 'Table 5 has been overbooked for tonight',
    time: '3 hours ago',
    unread: false,
    icon: AlertCircle,
    action: 'tables'
  },
]

export default function NotificationsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Notifications</h1>
          <p className="text-muted-foreground">
            Stay updated with your restaurant activities
          </p>
        </div>
        <Button variant="outline" size="sm">
          <Check className="h-4 w-4 mr-2" />
          Mark All Read
        </Button>
      </div>

      {/* Test Panel for Development */}
      <div className="flex justify-center">
        <NotificationTestPanel />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Recent Notifications
          </CardTitle>
          <CardDescription>
            You have {notifications.filter(n => n.unread).length} unread notifications
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {notifications.map((notification, index) => (
            <div key={notification.id}>
              <div className="flex items-start gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors">
                <div className={`p-2 rounded-full ${
                  notification.type === 'booking' ? 'bg-blue-100 text-blue-600' :
                  notification.type === 'staff' ? 'bg-green-100 text-green-600' :
                  'bg-orange-100 text-orange-600'
                }`}>
                  <notification.icon className="h-4 w-4" />
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-medium text-sm">{notification.title}</h3>
                        {notification.unread && (
                          <Badge variant="secondary" className="h-5 px-1.5 text-xs">
                            New
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        {notification.message}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {notification.time}
                      </p>
                    </div>
                    
                    <div className="flex items-center gap-1">
                      {notification.unread && (
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                          <Check className="h-4 w-4" />
                        </Button>
                      )}
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
              
              {index < notifications.length - 1 && <Separator className="my-2" />}
            </div>
          ))}
          
          {notifications.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <Bell className="h-8 w-8 mx-auto mb-3 opacity-50" />
              <p>No notifications yet</p>
              <p className="text-sm">We'll notify you when something important happens</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
