"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { 
  Wifi, 
  WifiOff, 
  RefreshCw, 
  Activity,
  AlertTriangle,
  CheckCircle,
  Clock
} from "lucide-react"
import { cn } from "@/lib/utils"
import { type ConnectionStats } from "@/lib/hooks/use-enhanced-realtime"

interface ConnectionStatusProps {
  isConnected: boolean
  connectionStats: ConnectionStats
  onReconnect: () => void
  compact?: boolean
}

export function ConnectionStatus({ 
  isConnected, 
  connectionStats, 
  onReconnect, 
  compact = false 
}: ConnectionStatusProps) {
  const [isReconnecting, setIsReconnecting] = useState(false)

  const handleReconnect = async () => {
    setIsReconnecting(true)
    try {
      await onReconnect()
    } finally {
      setTimeout(() => setIsReconnecting(false), 1000)
    }
  }

  const getStatusColor = () => {
    if (!isConnected) return "destructive"
    if (connectionStats.reconnectAttempts > 0) return "warning" 
    return "success"
  }

  const getStatusIcon = () => {
    if (isReconnecting) return <RefreshCw className="h-3 w-3 animate-spin" />
    if (!isConnected) return <WifiOff className="h-3 w-3" />
    if (connectionStats.reconnectAttempts > 0) return <AlertTriangle className="h-3 w-3" />
    return <Wifi className="h-3 w-3" />
  }

  const getStatusText = () => {
    if (isReconnecting) return "Reconnecting..."
    if (!isConnected) return "Disconnected"
    if (connectionStats.reconnectAttempts > 0) return "Unstable"
    return "Connected"
  }

  const formatLastConnected = (date: Date | null) => {
    if (!date) return "Never"
    const now = Date.now()
    const diff = Math.floor((now - date.getTime()) / 1000)
    if (diff < 60) return `${diff}s ago`
    const minutes = Math.floor(diff / 60)
    if (minutes < 60) return `${minutes}m ago`
    const hours = Math.floor(minutes / 60)
    return `${hours}h ago`
  }

  if (compact) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className={cn(
                "h-8 w-8 p-0",
                !isConnected && "text-red-500 hover:text-red-600"
              )}
              onClick={handleReconnect}
              disabled={isReconnecting}
            >
              {getStatusIcon()}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom" align="end">
            <div className="space-y-1 text-xs">
              <div className="flex items-center gap-2">
                <span className="font-medium">Real-time Status:</span>
                <Badge 
                  variant={getStatusColor() as any}
                  className="text-xs py-0 px-1"
                >
                  {getStatusText()}
                </Badge>
              </div>
              <div className="text-muted-foreground space-y-0.5">
                <div>Connected: {formatLastConnected(connectionStats.lastConnected)}</div>
                <div>Active: {connectionStats.activeSubscriptions} of {connectionStats.totalSubscriptions}</div>
                {connectionStats.reconnectAttempts > 0 && (
                  <div>Reconnects: {connectionStats.reconnectAttempts}</div>
                )}
                {connectionStats.lastError && (
                  <div className="text-red-500">Error: {connectionStats.lastError}</div>
                )}
                <div>Network: {connectionStats.networkStatus}</div>
              </div>
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )
  }

  return (
    <div className="flex items-center gap-3 p-3 rounded-lg border bg-card">
      <div className="flex items-center gap-2">
        {getStatusIcon()}
        <span className="text-sm font-medium">{getStatusText()}</span>
        <Badge 
          variant={getStatusColor() as any}
          className="text-xs"
        >
          Real-time
        </Badge>
      </div>
      
      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        <div className="flex items-center gap-1">
          <Clock className="h-3 w-3" />
          {formatLastConnected(connectionStats.lastConnected)}
        </div>
        <div className="flex items-center gap-1">
          <Activity className="h-3 w-3" />
          {connectionStats.activeSubscriptions} active
        </div>
        {connectionStats.reconnectAttempts > 0 && (
          <div className="flex items-center gap-1 text-amber-500">
            <RefreshCw className="h-3 w-3" />
            {connectionStats.reconnectAttempts} reconnects
          </div>
        )}
      </div>

      <Button
        variant="outline"
        size="sm"
        onClick={handleReconnect}
        disabled={isReconnecting}
        className="ml-auto"
      >
        {isReconnecting ? (
          <RefreshCw className="h-3 w-3 animate-spin mr-1" />
        ) : (
          <RefreshCw className="h-3 w-3 mr-1" />
        )}
        Reconnect
      </Button>
    </div>
  )
}

// Global connection status indicator for the header/navbar
export function GlobalConnectionStatus({ 
  isConnected, 
  connectionStats, 
  onReconnect 
}: ConnectionStatusProps) {
  if (isConnected && connectionStats.reconnectAttempts === 0) {
    // Don't show anything when connection is stable
    return null
  }

  return (
    <div className="fixed top-16 right-4 z-50 animate-in slide-in-from-top-2">
      <div className={cn(
        "flex items-center gap-2 px-3 py-2 rounded-lg shadow-lg border",
        !isConnected ? "bg-red-50 border-red-200 text-red-700" : 
        connectionStats.reconnectAttempts > 0 ? "bg-amber-50 border-amber-200 text-amber-700" :
        "bg-green-50 border-green-200 text-green-700"
      )}>
        {!isConnected ? (
          <WifiOff className="h-4 w-4" />
        ) : connectionStats.reconnectAttempts > 0 ? (
          <AlertTriangle className="h-4 w-4" />
        ) : (
          <CheckCircle className="h-4 w-4" />
        )}
        
        <span className="text-sm font-medium">
          {!isConnected 
            ? "Real-time disconnected" 
            : connectionStats.reconnectAttempts > 0
            ? "Connection unstable"
            : "Connected"
          }
        </span>

        <Button
          variant="ghost"
          size="sm"
          onClick={onReconnect}
          className="h-6 px-2 text-xs hover:bg-white/50"
        >
          Reconnect
        </Button>
      </div>
    </div>
  )
}