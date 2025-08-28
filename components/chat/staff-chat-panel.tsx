'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useStaffChat } from '@/lib/contexts/staff-chat-context'
import { X, Send, RotateCcw, Clock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import { ConversationMessage } from '@/lib/services/conversation-memory'

type MessageRole = 'user' | 'assistant' | 'system'

interface ChatMessage {
  id: string
  role: MessageRole
  content: string
  ts: number
}

export default function StaffChatPanel() {
  const { 
    isOpen, 
    close, 
    restaurantId, 
    sessionId, 
    setSessionId,
    addMessage,
    getConversationHistory,
    clearConversation,
    resetConversation,
    isSessionExpired,
    getSessionInfo
  } = useStaffChat()
  
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState<string>('')
  const [isSending, setIsSending] = useState<boolean>(false)
  const scrollRef = useRef<HTMLDivElement | null>(null)

  // Load conversation history when component mounts or session changes
  useEffect(() => {
    const history = getConversationHistory()
    const chatMessages: ChatMessage[] = history.map((msg, index) => ({
      id: `${sessionId}_${index}_${msg.timestamp}`,
      role: msg.role,
      content: msg.content,
      ts: msg.timestamp
    }))
    setMessages(chatMessages)
  }, [sessionId, getConversationHistory])

  // Check for session expiration
  useEffect(() => {
    if (isSessionExpired()) {
      clearConversation()
    }
  }, [isSessionExpired, clearConversation])

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

  const handleStaffChatError = (error: any, response?: Response) => {
    if (response?.status === 403) {
      console.error('Request blocked - check User-Agent header')
      return 'Request was blocked. Please contact support.'
    }
    
    if (response?.status === 429) {
      const retryAfter = response.headers?.get('retry-after') || '60'
      console.error(`Rate limited. Retry after ${retryAfter} seconds`)
      return `Too many requests. Please wait ${retryAfter} seconds before trying again.`
    }
    
    if (response?.status === 400) {
      console.error('Bad request:', error)
      return 'Invalid request. Please check your input.'
    }
    
    if (response?.status === 503) {
      console.error('Service unavailable')
      return 'AI service is temporarily unavailable. Please try again later.'
    }
    
    console.error('Unexpected error:', error)
    return 'An unexpected error occurred. Please try again.'
  }

  const canSend = useMemo(() => input.trim().length > 0 && !isSending, [input, isSending])

  const sessionInfo = getSessionInfo()

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
    
    // Add to local state for immediate UI update
    setMessages(prev => [...prev, userMsg])
    
    // Add to conversation memory
    addMessage('user', text)
    
    setIsSending(true)
    try {
      const url = '/api/staff-ai'
      
      // Get conversation history for API request
      const conversationHistory = getConversationHistory()
      const formattedHistory = conversationHistory.map(msg => ({
        role: msg.role,
        content: msg.content
      }))

      const payload = {
        message: text,
        conversation_history: formattedHistory,
        restaurant_id: restaurantId,
        session_id: sessionId ?? 'staff_default',
      }
      
      const isUuid = typeof restaurantId === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(restaurantId)
      const startedAt = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now()

      // BEFORE sending
      console.log('[StaffChat] Sending request with conversation history', { 
        url, 
        payload: { ...payload, conversation_history: `${formattedHistory.length} messages` }, 
        navigatorOnline: typeof navigator !== 'undefined' ? navigator.onLine : undefined, 
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined, 
        isUuid 
      })

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
        const errorMessage = handleStaffChatError(data?.error || 'Request failed', res)
        throw new Error(errorMessage)
      }
      
      const assistantResponse = data?.response ?? 'No response'
      const assistantMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: assistantResponse,
        ts: Date.now(),
      }
      
      // Add to local state for immediate UI update
      setMessages(prev => [...prev, assistantMsg])
      
      // Add to conversation memory
      addMessage('assistant', assistantResponse)
      
    } catch (error: any) {
      console.error('[StaffChat] Error sending message', error)
      try {
        console.error('[StaffChat] Error details', { name: error?.name, message: error?.message, stack: error?.stack })
      } catch {}
      
      const errorMessage = error?.message || 'Error contacting Staff AI. Please try again.'
      const errMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'system',
        content: errorMessage,
        ts: Date.now(),
      }
      setMessages(prev => [...prev, errMsg])
      
      // Add error to conversation memory
      addMessage('system', errorMessage)
    } finally {
      setIsSending(false)
    }
  }

  const handleClearConversation = () => {
    clearConversation()
    setMessages([])
  }

  const handleResetConversation = () => {
    resetConversation()
    setMessages([])
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-end p-4 sm:p-6">
      <div className="absolute inset-0 bg-black/30" onClick={close} />

      <Card className="relative z-[90] w-full sm:w-[420px] h-[65vh] sm:h-[70vh] shadow-2xl flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <p className="font-semibold">Staff Assistant</p>
              {sessionInfo && (
                <span className="text-xs bg-muted px-2 py-1 rounded-full">
                  {sessionInfo.messageCount} msgs
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Restaurant: {restaurantId?.slice(0, 8)}… | Session: {sessionId?.slice(-6)}
            </p>
          </div>
          <div className="flex items-center gap-1">
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={handleResetConversation}
              title="Reset conversation (keep session)"
              className="h-8 w-8"
            >
              <RotateCcw className="h-3 w-3" />
            </Button>
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={handleClearConversation}
              title="Start new session"
              className="h-8 w-8"
            >
              <Clock className="h-3 w-3" />
            </Button>
            <Button variant="ghost" size="icon" onClick={close} aria-label="Close chat">
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-3 space-y-2 bg-muted/20">
          {messages.length === 0 && (
            <div className="text-center text-sm text-muted-foreground py-8">
              <p className="mb-2">👋 Welcome to Staff Assistant!</p>
              <p className="text-xs">Ask about bookings, capacity, customers, or anything restaurant-related.</p>
              <p className="text-xs mt-1">Your conversation will be remembered during your shift.</p>
            </div>
          )}
          {messages.map(m => (
            <div key={m.id} className={m.role === 'user' ? 'text-right' : 'text-left'}>
              <div className={
                'inline-block max-w-[85%] rounded-2xl px-3 py-2 text-sm ' +
                (m.role === 'user' ? 'bg-primary text-primary-foreground' : m.role === 'assistant' ? 'bg-muted' : 'bg-destructive/10 text-destructive')
              }>
                {m.content}
              </div>
              <div className="text-xs text-muted-foreground mt-1 px-1">
                {new Date(m.ts).toLocaleTimeString()}
              </div>
            </div>
          ))}
          {isSending && (
            <div className="text-left">
              <div className="inline-block bg-muted rounded-2xl px-3 py-2 text-sm">
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 bg-muted-foreground rounded-full animate-pulse" />
                  <div className="w-2 h-2 bg-muted-foreground rounded-full animate-pulse delay-75" />
                  <div className="w-2 h-2 bg-muted-foreground rounded-full animate-pulse delay-150" />
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="p-3 border-t">
          <div className="flex items-center gap-2">
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
              disabled={isSending}
            />
            <Button onClick={handleSend} disabled={!canSend} aria-label="Send">
              <Send className="h-4 w-4" />
            </Button>
          </div>
          {sessionInfo && (
            <div className="text-xs text-muted-foreground mt-2 flex justify-between">
              <span>Session expires in ~{Math.max(0, Math.round((8 * 60 * 60 * 1000 - (Date.now() - (sessionInfo as any).lastActivity || 0)) / (60 * 1000)))} min</span>
              <span>{sessionInfo.messageCount}/{20} messages</span>
            </div>
          )}
        </div>
      </Card>
    </div>
  )
}


