'use client'

import { useEffect, useState, useCallback } from 'react'

interface PersistentNotification {
  id: string
  type: string
  title: string
  body: string
  timestamp: number
  pingCount: number
  lastPingTime: number
  acknowledged: boolean
  maxPings: number
  tag: string
}

export function usePersistentNotifications() {
  const [unacknowledged, setUnacknowledged] = useState<PersistentNotification[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isPersistentEnabled, setIsPersistentEnabled] = useState(true)

  // Get unacknowledged notifications
  const getUnacknowledged = useCallback(async () => {
    if (!('serviceWorker' in navigator)) return

    try {
      const registration = await navigator.serviceWorker.ready
      const channel = new MessageChannel()

      return new Promise<PersistentNotification[]>((resolve) => {
        channel.port1.onmessage = (event) => {
          if (event.data?.type === 'UNACKNOWLEDGED_NOTIFICATIONS') {
            resolve(event.data.notifications || [])
          }
        }

        registration.active?.postMessage(
          { type: 'GET_UNACKNOWLEDGED_NOTIFICATIONS' },
          [channel.port2]
        )

        // Timeout fallback
        setTimeout(() => resolve([]), 1000)
      })
    } catch (error) {
      console.error('Failed to get unacknowledged notifications:', error)
      return []
    }
  }, [])

  // Acknowledge a specific notification
  const acknowledgeNotification = useCallback(async (notificationId: string) => {
    if (!('serviceWorker' in navigator)) return

    try {
      const registration = await navigator.serviceWorker.ready
      registration.active?.postMessage({
        type: 'ACKNOWLEDGE_NOTIFICATION',
        data: { notificationId }
      })

      // Update local state
      setUnacknowledged(prev => prev.filter(n => n.id !== notificationId))
    } catch (error) {
      console.error('Failed to acknowledge notification:', error)
    }
  }, [])

  // Acknowledge all notifications
  const acknowledgeAll = useCallback(async () => {
    if (!('serviceWorker' in navigator)) return

    try {
      const registration = await navigator.serviceWorker.ready
      registration.active?.postMessage({
        type: 'ACKNOWLEDGE_ALL_NOTIFICATIONS'
      })

      setUnacknowledged([])
    } catch (error) {
      console.error('Failed to acknowledge all notifications:', error)
    }
  }, [])

  // Toggle persistent notifications
  const togglePersistent = useCallback(async (enabled: boolean) => {
    if (!('serviceWorker' in navigator)) return

    try {
      const registration = await navigator.serviceWorker.ready
      registration.active?.postMessage({
        type: 'TOGGLE_PERSISTENT_NOTIFICATIONS',
        data: { enabled }
      })

      setIsPersistentEnabled(enabled)
      
      // Save preference
      localStorage.setItem('persistentNotificationsEnabled', enabled.toString())
    } catch (error) {
      console.error('Failed to toggle persistent notifications:', error)
    }
  }, [])

  // Cleanup old notifications
  const cleanup = useCallback(async () => {
    if (!('serviceWorker' in navigator)) return

    try {
      const registration = await navigator.serviceWorker.ready
      registration.active?.postMessage({
        type: 'CLEANUP_OLD_NOTIFICATIONS'
      })
    } catch (error) {
      console.error('Failed to cleanup notifications:', error)
    }
  }, [])

  // Load initial data
  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true)
      
      // Load preference
      const savedPref = localStorage.getItem('persistentNotificationsEnabled')
      if (savedPref !== null) {
        setIsPersistentEnabled(savedPref === 'true')
      }

      // Load unacknowledged notifications
      const notifications = await getUnacknowledged()
      setUnacknowledged(notifications)
      
      setIsLoading(false)
    }

    loadData()
  }, [getUnacknowledged])

  // Periodic refresh
  useEffect(() => {
    const interval = setInterval(async () => {
      const notifications = await getUnacknowledged()
      setUnacknowledged(notifications)
    }, 30000) // Refresh every 30 seconds

    return () => clearInterval(interval)
  }, [getUnacknowledged])

  return {
    unacknowledged,
    isLoading,
    isPersistentEnabled,
    acknowledgeNotification,
    acknowledgeAll,
    togglePersistent,
    cleanup,
    refresh: getUnacknowledged
  }
}
