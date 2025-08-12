'use client'

import React, { createContext, useCallback, useContext, useMemo, useState } from 'react'

interface StaffChatContextValue {
  isOpen: boolean
  open: () => void
  close: () => void
  toggle: () => void
  restaurantId: string
  sessionId: string | null
  setSessionId: (sessionId: string | null) => void
}

const StaffChatContext = createContext<StaffChatContextValue | undefined>(undefined)

interface StaffChatProviderProps {
  children: React.ReactNode
  restaurantId: string
}

export function StaffChatProvider({ children, restaurantId }: StaffChatProviderProps) {
  const [isOpen, setIsOpen] = useState<boolean>(false)
  const [sessionId, setSessionId] = useState<string | null>(null)

  const open = useCallback(() => setIsOpen(true), [])
  const close = useCallback(() => setIsOpen(false), [])
  const toggle = useCallback(() => setIsOpen(prev => !prev), [])

  const value: StaffChatContextValue = useMemo(() => ({
    isOpen,
    open,
    close,
    toggle,
    restaurantId,
    sessionId,
    setSessionId,
  }), [isOpen, open, close, toggle, restaurantId, sessionId])

  return (
    <StaffChatContext.Provider value={value}>
      {children}
    </StaffChatContext.Provider>
  )
}

export function useStaffChat() {
  const ctx = useContext(StaffChatContext)
  if (!ctx) {
    throw new Error('useStaffChat must be used within a StaffChatProvider')
  }
  return ctx
}


