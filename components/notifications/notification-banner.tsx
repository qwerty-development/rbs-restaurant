"use client"

import React from 'react'
import { X, Calendar, Bell, AlertCircle, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { Notification } from '@/lib/contexts/notification-context'

interface NotificationBannerProps {
  notification: Notification
  onDismiss: (id: string) => void
}

export function NotificationBanner({ notification, onDismiss }: NotificationBannerProps) {
  
  const getIcon = () => {
    switch (notification.type) {
      case 'booking':
        return <Calendar className="h-5 w-5 text-blue-600 dark:text-blue-400" />
      case 'order':
        return <Bell className="h-5 w-5 text-orange-600 dark:text-orange-400" />
      case 'general':
        return <AlertCircle className="h-5 w-5 text-gray-600 dark:text-gray-400" />
      default:
        return <Bell className="h-5 w-5 text-gray-600 dark:text-gray-400" />
    }
  }

  const getTypeColor = () => {
    switch (notification.type) {
      case 'booking':
        return 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800'
      case 'order':
        return 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800'
      case 'general':
        return 'bg-gray-50 dark:bg-gray-900/20 border-gray-200 dark:border-gray-800'
      default:
        return 'bg-gray-50 dark:bg-gray-900/20 border-gray-200 dark:border-gray-800'
    }
  }

  const formatTime = (timestamp: Date) => {
    const now = new Date()
    const diff = now.getTime() - timestamp.getTime()
    const seconds = Math.floor(diff / 1000)
    
    if (seconds < 60) return 'Just now'
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
    return timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  return (
    <div
      className={cn(
        "w-full rounded-xl border shadow-xl backdrop-blur bg-white/90 dark:bg-slate-900/80",
        "ring-1 ring-black/5 dark:ring-white/5",
        getTypeColor()
      )}
    >
      <div className="p-4">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0">
            {getIcon()}
          </div>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
                {notification.title}
              </h4>
              <Badge 
                variant="secondary" 
                className="text-[10px] px-2 py-0.5 bg-slate-100/80 dark:bg-slate-700/60 text-slate-600 dark:text-slate-300"
              >
                {notification.type}
              </Badge>
            </div>
            
            <p className="text-sm text-slate-700 dark:text-slate-300 mb-2 line-clamp-2">
              {notification.message}
            </p>
            
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500 dark:text-slate-400">
                {formatTime(notification.timestamp)}
              </span>
              
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onDismiss(notification.id)}
                className="h-6 w-6 p-0 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
