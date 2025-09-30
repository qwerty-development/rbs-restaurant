'use client'

import { useEffect, useRef } from 'react'

/**
 * Aggressive Wake Lock Manager for Production Tablets
 * 
 * This component ensures the device stays awake and prevents the screen from sleeping.
 * Optimized for dedicated restaurant tablets that are always plugged in.
 * 
 * Features:
 * - Persistent wake lock with auto-reacquisition
 * - Page Lifecycle API integration
 * - Multiple fallback mechanisms
 */
export function AggressiveWakeLock() {
  const wakeLockRef = useRef<WakeLockSentinel | null>(null)
  const reacquireTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const isAcquiringRef = useRef(false)

  // Acquire wake lock
  const acquireWakeLock = async () => {
    if (isAcquiringRef.current) return
    if (wakeLockRef.current && !wakeLockRef.current.released) {
      console.log('🔒 Wake lock already active')
      return
    }

    if (!('wakeLock' in navigator)) {
      console.warn('Wake Lock API not supported')
      return
    }

    isAcquiringRef.current = true

    try {
      wakeLockRef.current = await navigator.wakeLock.request('screen')
      console.log('🔒 Wake lock ACQUIRED')

      wakeLockRef.current.addEventListener('release', () => {
        console.warn('🔓 Wake lock RELEASED - will reacquire')
        wakeLockRef.current = null
        
        // Schedule reacquisition
        if (reacquireTimeoutRef.current) {
          clearTimeout(reacquireTimeoutRef.current)
        }
        
        reacquireTimeoutRef.current = setTimeout(() => {
          acquireWakeLock()
        }, 1000) // Retry after 1 second
      })

    } catch (error: any) {
      console.error('Failed to acquire wake lock:', error)
      
      // Retry with exponential backoff
      const retryDelay = 5000
      if (reacquireTimeoutRef.current) {
        clearTimeout(reacquireTimeoutRef.current)
      }
      
      reacquireTimeoutRef.current = setTimeout(() => {
        acquireWakeLock()
      }, retryDelay)
    } finally {
      isAcquiringRef.current = false
    }
  }

  // Release wake lock
  const releaseWakeLock = async () => {
    if (wakeLockRef.current) {
      try {
        await wakeLockRef.current.release()
        wakeLockRef.current = null
        console.log('🔓 Wake lock released manually')
      } catch (error) {
        console.error('Failed to release wake lock:', error)
      }
    }
  }

  // Handle visibility change
  const handleVisibilityChange = () => {
    if (document.hidden) {
      console.log('📱 App hidden - wake lock may be released by browser')
      // Don't release immediately - let the browser decide
      // We'll reacquire when visible again
    } else {
      console.log('📱 App visible - ensuring wake lock')
      // Reacquire wake lock when app becomes visible
      setTimeout(() => {
        acquireWakeLock()
      }, 100)
    }
  }

  // Handle page lifecycle events
  const handleFreeze = () => {
    console.warn('🧊 Page frozen - wake lock will be released')
  }

  const handleResume = () => {
    console.warn('🔥 Page resumed - reacquiring wake lock')
    setTimeout(() => {
      acquireWakeLock()
    }, 100)
  }

  // Handle focus/blur
  const handleFocus = () => {
    console.log('🎯 Page focused - ensuring wake lock')
    acquireWakeLock()
  }

  // Initialize
  useEffect(() => {
    console.log('🚀 Aggressive Wake Lock Manager initialized')

    // Initial acquisition
    acquireWakeLock()

    // Event listeners
    document.addEventListener('visibilitychange', handleVisibilityChange)
    document.addEventListener('freeze', handleFreeze)
    document.addEventListener('resume', handleResume)
    window.addEventListener('focus', handleFocus)

    // Periodic check to ensure wake lock is still active (every 30 seconds)
    const checkInterval = setInterval(() => {
      if (!wakeLockRef.current || wakeLockRef.current.released) {
        console.warn('⚠️ Wake lock not active - reacquiring')
        acquireWakeLock()
      }
    }, 30000)

    // Cleanup
    return () => {
      console.log('🧹 Cleaning up Aggressive Wake Lock Manager')
      
      if (reacquireTimeoutRef.current) {
        clearTimeout(reacquireTimeoutRef.current)
      }
      
      clearInterval(checkInterval)
      
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      document.removeEventListener('freeze', handleFreeze)
      document.removeEventListener('resume', handleResume)
      window.removeEventListener('focus', handleFocus)
      
      releaseWakeLock()
    }
  }, [])

  // No UI - this is a background component
  return null
}
