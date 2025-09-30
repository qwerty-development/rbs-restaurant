'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { usePersistentNotifications } from '@/hooks/use-persistent-notifications'
import { Bell, BellOff, Check, Trash2, RefreshCw } from 'lucide-react'
import { useState } from 'react'

export function PersistentNotificationSettings() {
  const {
    unacknowledged,
    isLoading,
    isPersistentEnabled,
    acknowledgeNotification,
    acknowledgeAll,
    togglePersistent,
    cleanup,
    refresh
  } = usePersistentNotifications()

  const [isRefreshing, setIsRefreshing] = useState(false)
  const [isCleaningUp, setIsCleaningUp] = useState(false)

  const handleRefresh = async () => {
    setIsRefreshing(true)
    await refresh()
    setIsRefreshing(false)
  }

  const handleCleanup = async () => {
    setIsCleaningUp(true)
    await cleanup()
    setIsCleaningUp(false)
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Persistent Notifications (Production Optimized)
          </CardTitle>
          <CardDescription>
            <strong>Bulletproof notification system for dedicated tablets.</strong> Notifications will aggressively re-ping until acknowledged to ensure no critical events are missed.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 mb-4">
            <p className="text-sm text-orange-900 font-medium">
              ⚡ Production Mode: Ultra-aggressive pinging enabled for dedicated tablets
            </p>
            <p className="text-xs text-orange-700 mt-1">
              Battery-saving features disabled • Maximum reliability • 20 pings • Up to 83 minutes of alerts
            </p>
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="persistent-notifications">Enable Persistent Notifications</Label>
              <p className="text-sm text-muted-foreground">
                Recommended: Always ON for production tablets
              </p>
            </div>
            <Switch
              id="persistent-notifications"
              checked={isPersistentEnabled}
              onCheckedChange={togglePersistent}
            />
          </div>

          <div className="border-t pt-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h4 className="font-medium">Unacknowledged Notifications</h4>
                <p className="text-sm text-muted-foreground">
                  {isLoading ? 'Loading...' : `${unacknowledged.length} pending`}
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRefresh}
                  disabled={isRefreshing}
                >
                  <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
                  Refresh
                </Button>
                {unacknowledged.length > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={acknowledgeAll}
                  >
                    <Check className="h-4 w-4 mr-2" />
                    Acknowledge All
                  </Button>
                )}
              </div>
            </div>

            {!isLoading && unacknowledged.length > 0 && (
              <div className="space-y-2">
                {unacknowledged.map((notification) => (
                  <div
                    key={notification.id}
                    className="flex items-start justify-between p-3 border rounded-lg bg-muted/50"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h5 className="font-medium text-sm">{notification.title}</h5>
                        <Badge variant="secondary" className="text-xs">
                          {notification.type}
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          {notification.pingCount}/20 pings
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">{notification.body}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {new Date(notification.timestamp).toLocaleString()}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => acknowledgeNotification(notification.id)}
                    >
                      <Check className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            {!isLoading && unacknowledged.length === 0 && (
              <div className="text-center py-6 text-muted-foreground">
                <BellOff className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No pending notifications</p>
              </div>
            )}
          </div>

          <div className="border-t pt-4">
            <Button
              variant="outline"
              size="sm"
              onClick={handleCleanup}
              disabled={isCleaningUp}
              className="w-full"
            >
              <Trash2 className={`h-4 w-4 mr-2 ${isCleaningUp ? 'animate-pulse' : ''}`} />
              Clean Up Old Notifications
            </Button>
            <p className="text-xs text-muted-foreground mt-2">
              Remove acknowledged notifications older than 7 days
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">How It Works (Production Tablet Mode)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p className="font-medium text-orange-600">⚡ AGGRESSIVE RE-PING SCHEDULE:</p>
          <p>• 1st re-ping: 15 seconds | 2nd: 30s | 3rd: 45s | 4th: 1m | 5th: 1.5m</p>
          <p>• 6th: 2m | 7th: 3m | 8th: 4m | 9th: 5m | 10th: 6m | 11th: 7m</p>
          <p>• 12th: 8m | 13th: 10m | 14th: 12m | 15th: 15m | 16th: 20m</p>
          <p>• 17th: 25m | 18th: 30m | 19th: 40m | 20th: 50m (final)</p>
          <p className="font-medium text-orange-600 mt-3">🚨 PRODUCTION OPTIMIZATIONS:</p>
          <p>• Maximum 20 re-pings per notification (up from 10)</p>
          <p>• Total alert window: ~83 minutes (up from 27 minutes)</p>
          <p>• NO battery checks - tablets always plugged in</p>
          <p>• Intense vibration pattern for maximum attention</p>
          <p>• Urgent visual indicators (🚨 prefix, ⚠️ symbols)</p>
          <p>• Auto-acknowledge only after 48 hours (up from 24)</p>
          <p className="font-medium text-green-600 mt-3">✅ ACKNOWLEDGMENT:</p>
          <p>• Clicking or dismissing a notification marks it as acknowledged</p>
          <p>• Acknowledged notifications stop re-pinging immediately</p>
          <p>• Critical notifications (bookings, cancellations) always require acknowledgment</p>
        </CardContent>
      </Card>
    </div>
  )
}
