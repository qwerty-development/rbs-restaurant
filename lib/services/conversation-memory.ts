export interface ConversationMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: number
}

export interface ConversationSession {
  sessionId: string
  restaurantId: string
  messages: ConversationMessage[]
  createdAt: number
  lastActivity: number
}

const STORAGE_KEY = 'staff_chat_conversation'
const MAX_MESSAGES = 20
const SESSION_TIMEOUT_MS = 8 * 60 * 60 * 1000 // 8 hours

export class ConversationMemory {
  private session: ConversationSession | null = null

  constructor() {
    this.loadFromStorage()
  }

  /**
   * Initialize or restore a conversation session
   */
  initSession(restaurantId: string, sessionId?: string): string {
    const now = Date.now()
    
    // If we have an existing session, check if it's still valid
    if (this.session) {
      const isExpired = now - this.session.lastActivity > SESSION_TIMEOUT_MS
      const isDifferentRestaurant = this.session.restaurantId !== restaurantId
      
      if (isExpired || isDifferentRestaurant) {
        this.clearSession()
      } else {
        // Update activity timestamp
        this.session.lastActivity = now
        this.saveToStorage()
        return this.session.sessionId
      }
    }

    // Create new session
    const newSessionId = sessionId || `staff_${restaurantId}_${now}`
    this.session = {
      sessionId: newSessionId,
      restaurantId,
      messages: [],
      createdAt: now,
      lastActivity: now
    }

    this.saveToStorage()
    return newSessionId
  }

  /**
   * Add a message to the conversation history
   */
  addMessage(role: 'user' | 'assistant' | 'system', content: string): void {
    if (!this.session) {
      throw new Error('No active session. Call initSession first.')
    }

    const message: ConversationMessage = {
      role,
      content,
      timestamp: Date.now()
    }

    this.session.messages.push(message)
    this.session.lastActivity = Date.now()

    // Implement sliding window - keep only the last MAX_MESSAGES
    if (this.session.messages.length > MAX_MESSAGES) {
      this.session.messages = this.session.messages.slice(-MAX_MESSAGES)
    }

    this.saveToStorage()
  }

  /**
   * Get conversation history for API requests
   */
  getConversationHistory(): ConversationMessage[] {
    return this.session?.messages || []
  }

  /**
   * Get formatted conversation history for API
   */
  getFormattedHistory(): Array<{ role: string; content: string }> {
    return this.getConversationHistory().map(msg => ({
      role: msg.role,
      content: msg.content
    }))
  }

  /**
   * Clear the current conversation session
   */
  clearSession(): void {
    this.session = null
    this.removeFromStorage()
  }

  /**
   * Get current session info
   */
  getSessionInfo(): { sessionId: string; restaurantId: string; messageCount: number } | null {
    if (!this.session) return null
    
    return {
      sessionId: this.session.sessionId,
      restaurantId: this.session.restaurantId,
      messageCount: this.session.messages.length
    }
  }

  /**
   * Check if session is expired
   */
  isSessionExpired(): boolean {
    if (!this.session) return true
    return Date.now() - this.session.lastActivity > SESSION_TIMEOUT_MS
  }

  /**
   * Reset conversation but keep session active
   */
  resetConversation(): void {
    if (this.session) {
      this.session.messages = []
      this.session.lastActivity = Date.now()
      this.saveToStorage()
    }
  }

  private loadFromStorage(): void {
    if (typeof window === 'undefined') return

    try {
      const stored = sessionStorage.getItem(STORAGE_KEY)
      if (stored) {
        const session: ConversationSession = JSON.parse(stored)
        
        // Check if session is expired
        if (Date.now() - session.lastActivity > SESSION_TIMEOUT_MS) {
          this.removeFromStorage()
          return
        }

        this.session = session
      }
    } catch (error) {
      console.warn('[ConversationMemory] Failed to load from storage:', error)
      this.removeFromStorage()
    }
  }

  private saveToStorage(): void {
    if (typeof window === 'undefined' || !this.session) return

    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(this.session))
    } catch (error) {
      console.warn('[ConversationMemory] Failed to save to storage:', error)
    }
  }

  private removeFromStorage(): void {
    if (typeof window === 'undefined') return
    
    try {
      sessionStorage.removeItem(STORAGE_KEY)
    } catch (error) {
      console.warn('[ConversationMemory] Failed to remove from storage:', error)
    }
  }
}

// Global instance
export const conversationMemory = new ConversationMemory()