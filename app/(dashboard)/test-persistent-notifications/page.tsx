'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Bell, Send, AlertCircle, CheckCircle } from 'lucide-react'
import { sendNotification } from '@/app/actions'
import { usePersistentNotifications } from '@/hooks/use-persistent-notifications'

export default function PersistentNotificationTestPage() {
  const [title, setTitle] = useState('Test Notification')
  const [body, setBody] = useState('This is a test persistent notification')
  const [requiresAck, setRequiresAck] = useState(true)
  const [notificationType, setNotificationType] = useState<'booking' | 'cancellation' | 'waitlist' | 'general'>('booking')
  const [isSending, setIsSending] = useState(false)
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null)

  const { unacknowledged, refresh } = usePersistentNotifications()

  const handleSendNotification = async () => {
    setIsSending(true)
    setResult(null)

    try {
      const res = await sendNotification({
        title,
        body,
        type: notificationType,
        requiresAcknowledgment: requiresAck,
        id: `test_${Date.now()}`,
        tag: `test_${notificationType}`
      })

      setResult({
        success: res.success,
        message: res.success ? `Sent to ${res.sent} device(s)` : (res.error || 'Failed to send')
      })

      // Refresh unacknowledged list
      setTimeout(refresh, 1000)
    } catch (error) {
      setResult({
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error'
      })
    } finally {
      setIsSending(false)
    }
  }

  return (
    <div className="container mx-auto py-8 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Bell className="h-8 w-8" />
          Persistent Notification Test (Production Tablet Mode)
        </h1>
        <p className="text-muted-foreground mt-2">
          Test the bulletproof persistent notification system optimized for dedicated tablets
        </p>
        <div className="mt-2 bg-orange-50 border border-orange-200 rounded-lg p-3">
          <p className="text-sm text-orange-900 font-medium">
            ⚡ Production Mode: Ultra-aggressive pinging • No battery checks • 20 pings max • 83 min window
          </p>
        </div>
      </div>

      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Send Test Notification</CardTitle>
            <CardDescription>
              Configure and send a test notification to see the persistent pinging in action
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">Notification Title</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Enter notification title"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="body">Notification Body</Label>
              <Input
                id="body"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Enter notification body"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="type">Notification Type</Label>
              <select
                id="type"
                value={notificationType}
                onChange={(e) => setNotificationType(e.target.value as any)}
                className="w-full px-3 py-2 border rounded-md"
              >
                <option value="booking">Booking</option>
                <option value="cancellation">Cancellation</option>
                <option value="waitlist">Waitlist</option>
                <option value="general">General</option>
              </select>
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="requires-ack">Requires Acknowledgment</Label>
                <p className="text-sm text-muted-foreground">
                  Enable persistent re-pinging until user interacts
                </p>
              </div>
              <Switch
                id="requires-ack"
                checked={requiresAck}
                onCheckedChange={setRequiresAck}
              />
            </div>

            <Button
              onClick={handleSendNotification}
              disabled={isSending}
              className="w-full"
            >
              <Send className={`h-4 w-4 mr-2 ${isSending ? 'animate-pulse' : ''}`} />
              {isSending ? 'Sending...' : 'Send Test Notification'}
            </Button>

            {result && (
              <div className={`flex items-start gap-2 p-3 rounded-md ${
                result.success ? 'bg-green-50 text-green-900' : 'bg-red-50 text-red-900'
              }`}>
                {result.success ? (
                  <CheckCircle className="h-5 w-5 mt-0.5" />
                ) : (
                  <AlertCircle className="h-5 w-5 mt-0.5" />
                )}
                <div>
                  <p className="font-medium">{result.success ? 'Success' : 'Error'}</p>
                  <p className="text-sm">{result.message}</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Current Unacknowledged Notifications</CardTitle>
            <CardDescription>
              These notifications are actively re-pinging
            </CardDescription>
          </CardHeader>
          <CardContent>
            {unacknowledged.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No unacknowledged notifications
              </p>
            ) : (
              <div className="space-y-2">
                {unacknowledged.map((notif) => (
                  <div key={notif.id} className="p-3 border rounded-lg">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-medium text-sm">{notif.title}</p>
                      <Badge variant="secondary">{notif.type}</Badge>
                      <Badge variant="outline">{notif.pingCount}/20</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{notif.body}</p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Test Instructions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div>
              <p className="font-medium mb-1">1. Enable Notifications</p>
              <p className="text-muted-foreground">Make sure push notifications are enabled in your browser</p>
            </div>
            <div>
              <p className="font-medium mb-1">2. Send Test Notification</p>
              <p className="text-muted-foreground">Click "Send Test Notification" with "Requires Acknowledgment" enabled</p>
            </div>
            <div>
              <p className="font-medium mb-1">3. Observe Aggressive Re-pinging</p>
              <p className="text-muted-foreground">
                First re-ping at 15s, then: 30s, 45s, 1m, 1.5m, 2m, 3m, 4m, 5m, 6m, 7m, 8m, 10m, 12m, 15m, 20m, 25m, 30m, 40m, 50m (20 total)
              </p>
            </div>
            <div>
              <p className="font-medium mb-1">4. Interact with Notification</p>
              <p className="text-muted-foreground">Click or dismiss the notification to stop re-pinging</p>
            </div>
            <div>
              <p className="font-medium mb-1">5. Verify Acknowledgment</p>
              <p className="text-muted-foreground">
                The notification should disappear from the "Current Unacknowledged Notifications" list
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Expected Behavior (Production Tablet Mode)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>✅ Notification appears immediately with 🚨 URGENT prefix</p>
            <p>✅ First re-ping at 15 seconds (FAST!)</p>
            <p>✅ Up to 20 re-pings over ~83 minutes</p>
            <p>✅ Shows ping counter: [1/20], [2/20], etc.</p>
            <p>✅ Intense vibration pattern: [300, 150, 300, 150, 300, 150, 300]</p>
            <p>✅ Urgent visual indicators (🚨, ⚠️ symbols)</p>
            <p>✅ Clicking notification stops all future pings</p>
            <p>✅ Dismissing notification stops all future pings</p>
            <p>✅ NO battery checks - optimized for plugged-in tablets</p>
            <p>✅ Auto-acknowledges only after 48 hours</p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
