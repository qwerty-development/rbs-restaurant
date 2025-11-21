'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  MobilePresenceService,
  type MobilePresenceState,
  type ConnectionStatus,
} from '@/admin/services/MobilePresenceService'

export type OnlineMobileUser = {
  userId: string
  onlineSince: string
  lastSeen?: string
}

export const useMobilePresence = () => {
  const [state, setState] = useState<MobilePresenceState>({})
  const [status, setStatus] = useState<ConnectionStatus>('connecting')

  useEffect(() => {
    const service = MobilePresenceService.getInstance()
    const unsubscribe = service.subscribe(setState, setStatus)
    return () => unsubscribe()
  }, [])

  const onlineUsers: OnlineMobileUser[] = useMemo(() => {
    return Object.entries(state)
      .map(([userId, presences]) => {
        if (!presences || presences.length === 0) return null
        const sorted = [...presences].sort(
          (a, b) => new Date(a.online_at).getTime() - new Date(b.online_at).getTime()
        )
        const first = sorted[0]
        const latest = sorted[sorted.length - 1]
        return {
          userId,
          onlineSince: first.online_at,
          lastSeen: latest.last_seen,
        }
      })
      .filter(Boolean) as OnlineMobileUser[]
  }, [state])

  const isUserOnline = useCallback(
    (userId: string) => {
      return Boolean(state[userId]?.length)
    },
    [state]
  )

  const refresh = useCallback(() => {
    MobilePresenceService.getInstance().refresh()
  }, [])

  const reconnect = useCallback(() => {
    MobilePresenceService.getInstance().reconnect()
  }, [])

  return {
    onlineUsers,
    presenceState: state,
    status,
    isUserOnline,
    refresh,
    reconnect
  }
}


