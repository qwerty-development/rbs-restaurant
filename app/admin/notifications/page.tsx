'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { toast } from 'react-hot-toast'
import { useNotifications } from '@/lib/contexts/notification-context'

export default function AdminNotificationsPage() {
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [isSending, setIsSending] = useState(false)
  const { addNotification } = useNotifications()

  const showLocally = () => {
    if (!title.trim() || !body.trim()) {
      toast.error('Please fill title and body')
      return
    }
    addNotification({ type: 'general', title: title.trim(), message: body.trim() })
    toast.success('Shown locally')
  }

  const sendToAll = async () => {
    if (!title.trim() || !body.trim()) {
      toast.error('Please fill title and body')
      return
    }
    try {
      setIsSending(true)
      const res = await fetch('/api/admin/broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: title.trim(), body: body.trim() })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to send')
      toast.success(`Sent: ${data.sent}, Failed: ${data.failed}`)
    } catch (e: any) {
      toast.error(e.message || 'Failed to send')
    } finally {
      setIsSending(false)
    }
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-semibold">Broadcast Notification</h2>

      <Card>
        <CardHeader>
          <CardTitle>Compose</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium">Title</label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Announcement title" />
          </div>
          <div>
            <label className="text-sm font-medium">Body</label>
            <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={4} placeholder="Message body" />
          </div>

          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={showLocally}>Show on my device</Button>
            <Button type="button" onClick={sendToAll} disabled={isSending}>
              {isSending ? 'Sending…' : 'Send to all users'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}


