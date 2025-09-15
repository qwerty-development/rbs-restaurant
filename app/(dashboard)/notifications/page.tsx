// app/(dashboard)/notifications/page.tsx

"use client"

import { Bell, Check, X, Clock, UserPlus, Calendar, AlertCircle } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { NotificationTestPanel } from '@/components/notifications/notification-test-panel'
import { useDatabaseNotifications } from '@/lib/hooks/use-database-notifications'
import { useSearchParams } from 'next/navigation'
import { formatDistanceToNow } from 'date-fns'

export default function NotificationsPage() {
  const searchParams = useSearchParams()
  const restaurantId = searchParams.get('restaurant')

  const {
    notifications,
    unreadCount,
    isLoading,
    markAsRead,
    markAllAsRead
  } = useDatabaseNotifications(restaurantId || undefined)

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'new_booking':
      case 'booking':
        return Calendar
      case 'staff':
        return UserPlus
      case 'alert':
        return AlertCircle
      default:
        return Bell
    }
  }

  const getNotificationColor = (type: string) => {
    switch (type) {
      case 'new_booking':
      case 'booking':
        return 'bg-blue-100 text-blue-600'
      case 'staff':
        return 'bg-green-100 text-green-600'
      case 'alert':
        return 'bg-orange-100 text-orange-600'
      default:
        return 'bg-gray-100 text-gray-600'
    }
  }
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Notifications</h1>
          <p className="text-muted-foreground">
            Stay updated with your restaurant activities
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={markAllAsRead}>
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
            {isLoading ? 'Loading notifications...' : `You have ${unreadCount} unread notifications`}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">
              Loading notifications...
            </div>
          ) : notifications.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No notifications yet
            </div>
          ) : (
            notifications.map((notification, index) => {
              const Icon = getNotificationIcon(notification.type)
              return (
                <div key={notification.id}>
                  <div
                    className={`flex items-start gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer ${
                      !notification.read ? 'bg-blue-50/50' : ''
                    }`}
                    onClick={() => !notification.read && markAsRead(notification.id)}
                  >
                    <div className={`p-2 rounded-full ${getNotificationColor(notification.type)}`}>
                      <Icon className="h-4 w-4" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-medium text-sm">{notification.title}</h3>
                            {!notification.read && (
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
                            {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
                          </p>
                        </div>

                        <div className="flex items-center gap-1">
                          {!notification.read && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0"
                              onClick={(e) => {
                                e.stopPropagation()
                                markAsRead(notification.id)
                              }}
                            >
                              <Check className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {index < notifications.length - 1 && <Separator className="my-2" />}
                </div>
              )
            })
          )}
        </CardContent>
      </Card>
    </div>
  )
}
