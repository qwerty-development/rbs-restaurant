"use client"

import { useEffect, useState } from 'react'
import { type RealtimeHealthStatus } from '@/hooks/use-realtime-health'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Wifi,
  WifiOff,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  Activity,
  Clock,
  Zap
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { format } from 'date-fns'

interface ConnectionStatusIndicatorProps {
  healthStatus: RealtimeHealthStatus
  onForceReconnect?: () => void
  showDetails?: boolean
  compact?: boolean
  isAggressivePolling?: boolean
  unhealthyDurationMinutes?: number
}

export function ConnectionStatusIndicator({
  healthStatus,
  onForceReconnect,
  showDetails = false,
  compact = false,
  isAggressivePolling = false,
  unhealthyDurationMinutes = 0
}: ConnectionStatusIndicatorProps) {
  const [isReconnecting, setIsReconnecting] = useState(false)

  // Handle reconnection loading state
  useEffect(() => {
    if (healthStatus.connectionState === 'reconnecting') {
      setIsReconnecting(true)
    } else {
      setIsReconnecting(false)
    }
  }, [healthStatus.connectionState])

  const getStatusInfo = () => {
    // If aggressive polling is active, show recovery mode
    if (isAggressivePolling) {
      return {
        icon: Zap,
        color: 'text-blue-600',
        bgColor: 'bg-blue-50',
        borderColor: 'border-blue-200',
        label: 'Recovery Mode',
        variant: 'secondary'
      }
    }

    switch (healthStatus.connectionState) {
      case 'connected':
        return {
          icon: healthStatus.isHealthy ? CheckCircle : AlertTriangle,
          color: healthStatus.isHealthy ? 'text-green-500' : 'text-yellow-500',
          bgColor: healthStatus.isHealthy ? 'bg-green-50' : 'bg-yellow-50',
          borderColor: healthStatus.isHealthy ? 'border-green-200' : 'border-yellow-200',
          label: healthStatus.isHealthy ? 'Connected' : 'Degraded',
          variant: healthStatus.isHealthy ? 'default' : 'secondary'
        }
      case 'disconnected':
        return {
          icon: WifiOff,
          color: 'text-red-500',
          bgColor: 'bg-red-50',
          borderColor: 'border-red-200',
          label: 'Disconnected',
          variant: 'destructive'
        }
      case 'reconnecting':
        return {
          icon: RefreshCw,
          color: 'text-blue-500',
          bgColor: 'bg-blue-50',
          borderColor: 'border-blue-200',
          label: 'Reconnecting',
          variant: 'secondary'
        }
      default:
        return {
          icon: Activity,
          color: 'text-gray-500',
          bgColor: 'bg-gray-50',
          borderColor: 'border-gray-200',
          label: 'Unknown',
          variant: 'outline'
        }
    }
  }

  const statusInfo = getStatusInfo()
  const Icon = statusInfo.icon

  if (compact) {
    return (
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              "h-6 w-6 p-0 rounded-full",
              statusInfo.bgColor,
              statusInfo.borderColor,
              "border"
            )}
          >
            <Icon
              className={cn(
                "h-3 w-3",
                statusInfo.color,
                isReconnecting && "animate-spin"
              )}
            />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80" align="end">
          <ConnectionStatusDetails
            healthStatus={healthStatus}
            onForceReconnect={onForceReconnect}
            isAggressivePolling={isAggressivePolling}
            unhealthyDurationMinutes={unhealthyDurationMinutes}
          />
        </PopoverContent>
      </Popover>
    )
  }

  if (showDetails) {
    return (
      <div className={cn(
        "border rounded-lg p-3",
        statusInfo.bgColor,
        statusInfo.borderColor
      )}>
        <ConnectionStatusDetails
          healthStatus={healthStatus}
          onForceReconnect={onForceReconnect}
          isAggressivePolling={isAggressivePolling}
          unhealthyDurationMinutes={unhealthyDurationMinutes}
        />
      </div>
    )
  }

  return (
    <Badge
      variant={statusInfo.variant as any}
      className={cn(
        "gap-1 px-2 py-1",
        statusInfo.bgColor,
        statusInfo.color
      )}
    >
      <Icon
        className={cn(
          "h-3 w-3",
          isReconnecting && "animate-spin"
        )}
      />
      {statusInfo.label}
    </Badge>
  )
}

function ConnectionStatusDetails({
  healthStatus,
  onForceReconnect,
  isAggressivePolling,
  unhealthyDurationMinutes
}: {
  healthStatus: RealtimeHealthStatus
  onForceReconnect?: () => void
  isAggressivePolling?: boolean
  unhealthyDurationMinutes?: number
}) {
  const handleReconnect = () => {
    if (onForceReconnect) {
      onForceReconnect()
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="font-semibold text-sm">Real-time Connection</h4>
        <Badge variant={healthStatus.isHealthy ? "default" : "destructive"}>
          {healthStatus.connectionState}
        </Badge>
      </div>

      <div className="grid grid-cols-2 gap-3 text-xs">
        <div className="space-y-1">
          <span className="text-muted-foreground">Status</span>
          <div className="flex items-center gap-1">
            {healthStatus.isHealthy ? (
              <CheckCircle className="h-3 w-3 text-green-500" />
            ) : (
              <AlertTriangle className="h-3 w-3 text-red-500" />
            )}
            <span className={healthStatus.isHealthy ? "text-green-700" : "text-red-700"}>
              {healthStatus.isHealthy ? "Healthy" : "Unhealthy"}
            </span>
          </div>
        </div>

        <div className="space-y-1">
          <span className="text-muted-foreground">Channels</span>
          <div className="flex items-center gap-1">
            <Activity className="h-3 w-3 text-blue-500" />
            <span>{healthStatus.channelCount}</span>
          </div>
        </div>

        <div className="space-y-1">
          <span className="text-muted-foreground">Last Activity</span>
          <div className="flex items-center gap-1">
            <Clock className="h-3 w-3 text-gray-500" />
            <span>
              {healthStatus.lastActivity
                ? format(healthStatus.lastActivity, 'HH:mm:ss')
                : 'Never'
              }
            </span>
          </div>
        </div>

        <div className="space-y-1">
          <span className="text-muted-foreground">Attempts</span>
          <div className="flex items-center gap-1">
            <RefreshCw className="h-3 w-3 text-orange-500" />
            <span>{healthStatus.reconnectAttempts}</span>
          </div>
        </div>
      </div>

      {!healthStatus.isHealthy && (
        <Alert className="border-amber-200 bg-amber-50">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <AlertDescription className="text-xs text-amber-800">
            {isAggressivePolling
              ? `Recovery mode active for ${Math.round(unhealthyDurationMinutes || 0)} minutes. Background sync running.`
              : "Real-time updates may be delayed. Manual refresh recommended."
            }
          </AlertDescription>
        </Alert>
      )}

      {isAggressivePolling && (
        <Alert className="border-blue-200 bg-blue-50">
          <Zap className="h-4 w-4 text-blue-600" />
          <AlertDescription className="text-xs text-blue-800">
            Service worker is maintaining data freshness via background sync.
          </AlertDescription>
        </Alert>
      )}

      <div className="flex gap-2">
        <Button
          onClick={handleReconnect}
          size="sm"
          variant="outline"
          className="flex-1 h-7 text-xs"
          disabled={healthStatus.connectionState === 'reconnecting'}
        >
          <RefreshCw className={cn(
            "h-3 w-3 mr-1",
            healthStatus.connectionState === 'reconnecting' && "animate-spin"
          )} />
          {healthStatus.connectionState === 'reconnecting' ? 'Reconnecting...' : 'Reconnect'}
        </Button>

        <Button
          onClick={() => window.location.reload()}
          size="sm"
          variant="ghost"
          className="h-7 text-xs"
        >
          <Zap className="h-3 w-3 mr-1" />
          Refresh Page
        </Button>
      </div>

      <div className="text-xs text-muted-foreground pt-1 border-t">
        <p>Connection monitors real-time booking updates and notifications.</p>
      </div>
    </div>
  )
}