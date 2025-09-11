"use client"

import { useGlobalLayoutNotifications } from '@/lib/hooks/use-global-layout-notifications'

export function GlobalLayoutNotifications() {
  useGlobalLayoutNotifications()
  return null // This component doesn't render anything, just sets up the hook
}
