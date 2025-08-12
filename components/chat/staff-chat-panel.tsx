'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useStaffChat } from '@/lib/contexts/staff-chat-context'
import { X, Send } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'

type MessageRole = 'user' | 'assistant' | 'system'

interface ChatMessage {
  id: string
  role: MessageRole
  content: string
  ts: number
}

export default function StaffChatPanel() {
  const { isOpen, close, restaurantId, sessionId, setSessionId } = useStaffChat()
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState<string>('')
  const [isSending, setIsSending] = useState<boolean>(false)
  const scrollRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!sessionId) {
      setSessionId('staff_default')
    }
  }, [sessionId, setSessionId])

  useEffect(() => {
    if (isOpen && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [isOpen, messages])

  const canSend = useMemo(() => input.trim().length > 0 && !isSending, [input, isSending])

  const handleSend = async () => {
    const text = input.trim()
    if (!text) return
    setInput('')

    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: text,
      ts: Date.now(),
    }
    setMessages(prev => [...prev, userMsg])
    setIsSending(true)
    try {
      const url = '/api/staff-ai'
      const payload = {
        message: text,
        restaurant_id: restaurantId,
        session_id: sessionId ?? 'staff_default',
      }
      const isUuid = typeof restaurantId === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(restaurantId)
      const startedAt = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now()

      // BEFORE sending
      console.log('[StaffChat] Sending request', { url, payload, navigatorOnline: typeof navigator !== 'undefined' ? navigator.onLine : undefined, userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined, isUuid })

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        mode: 'same-origin',
        cache: 'no-store',
      })

      const finishedAt = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now()
      const durationMs = finishedAt - startedAt

      // AFTER receiving headers
      console.log('[StaffChat] Response meta', { status: res.status, ok: res.ok, durationMs })

      let data: any = null
      try {
        data = await res.json()
      } catch (parseError) {
        console.error('[StaffChat] Failed to parse JSON response', parseError)
        throw parseError
      }

      // AFTER parsing body
      console.log('[StaffChat] Response body', data)

      if (typeof data?.session_id === 'string') {
        console.log('[StaffChat] Updating sessionId', { sessionId: data.session_id })
        setSessionId(data.session_id)
      }
      if (!res.ok) {
        console.error('[StaffChat] Request failed', { status: res.status, body: data })
        throw new Error(data?.error || 'Request failed')
      }
      const assistantMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: data?.response ?? 'No response',
        ts: Date.now(),
      }
      setMessages(prev => [...prev, assistantMsg])
    } catch (error: any) {
      console.error('[StaffChat] Error sending message', error)
      try {
        console.error('[StaffChat] Error details', { name: error?.name, message: error?.message, stack: error?.stack })
      } catch {}
      const errMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'system',
        content: 'Error contacting Staff AI. Please try again.',
        ts: Date.now(),
      }
      setMessages(prev => [...prev, errMsg])
    } finally {
      setIsSending(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-end p-4 sm:p-6">
      <div className="absolute inset-0 bg-black/30" onClick={close} />

      <Card className="relative z-[90] w-full sm:w-[420px] h-[65vh] sm:h-[70vh] shadow-2xl flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <div>
            <p className="font-semibold">Staff Assistant</p>
            <p className="text-xs text-muted-foreground">Restaurant context: {restaurantId?.slice(0, 8)}…</p>
          </div>
          <Button variant="ghost" size="icon" onClick={close} aria-label="Close chat">
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-3 space-y-2 bg-muted/20">
          {messages.map(m => (
            <div key={m.id} className={m.role === 'user' ? 'text-right' : 'text-left'}>
              <div className={
                'inline-block max-w-[85%] rounded-2xl px-3 py-2 text-sm ' +
                (m.role === 'user' ? 'bg-primary text-primary-foreground' : m.role === 'assistant' ? 'bg-muted' : 'bg-destructive/10 text-destructive')
              }>
                {m.content}
              </div>
            </div>
          ))}
        </div>

        <div className="p-3 border-t flex items-center gap-2">
          <Input
            placeholder="Ask about covers, availability, customers, etc."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && canSend) {
                e.preventDefault()
                handleSend()
              }
            }}
          />
          <Button onClick={handleSend} disabled={!canSend} aria-label="Send">
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </Card>
    </div>
  )
}


