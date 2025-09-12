// Error Boundary for PWA Real-time Components
"use client"

import React from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { AlertTriangle, RefreshCw } from "lucide-react"

interface ErrorBoundaryState {
  hasError: boolean
  error?: Error
  errorInfo?: any
}

interface ErrorBoundaryProps {
  children: React.ReactNode
  fallbackTitle?: string
  fallbackDescription?: string
}

export class PWARealtimeErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.error('🚨 PWA Realtime Error Boundary caught an error:', error, errorInfo)
    this.setState({
      error,
      errorInfo
    })

    // In production, you might want to send this to an error reporting service
    if (process.env.NODE_ENV === 'production') {
      // Example: Send to error reporting service
      // errorReportingService.captureException(error, { extra: errorInfo })
    }
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: undefined, errorInfo: undefined })
    
    // Force a page refresh for real-time connection issues
    if (typeof window !== 'undefined') {
      window.location.reload()
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <Card className="w-full max-w-md mx-auto mt-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="h-5 w-5" />
              {this.props.fallbackTitle || "Real-time Connection Error"}
            </CardTitle>
            <CardDescription>
              {this.props.fallbackDescription || "There was an error with the real-time connection. Please refresh to restore functionality."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {process.env.NODE_ENV === 'development' && this.state.error && (
              <details className="text-xs text-gray-600 bg-gray-50 p-2 rounded">
                <summary className="cursor-pointer font-semibold">Error Details (Development Only)</summary>
                <pre className="mt-2 whitespace-pre-wrap">
                  {this.state.error.toString()}
                  {this.state.errorInfo?.componentStack}
                </pre>
              </details>
            )}
            
            <Button 
              onClick={this.handleRetry} 
              className="w-full"
              variant="default"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh & Retry
            </Button>
            
            <p className="text-xs text-gray-500 text-center">
              If this error persists, please contact support or try refreshing your browser.
            </p>
          </CardContent>
        </Card>
      )
    }

    return this.props.children
  }
}

// HOC for easier wrapping
export function withPWARealtimeErrorBoundary<T extends object>(
  Component: React.ComponentType<T>,
  errorBoundaryProps?: Partial<ErrorBoundaryProps>
) {
  return function WrappedComponent(props: T) {
    return (
      <PWARealtimeErrorBoundary {...errorBoundaryProps}>
        <Component {...props} />
      </PWARealtimeErrorBoundary>
    )
  }
}

// Hook for graceful error handling in components
export function usePWAErrorRecovery() {
  const handleConnectionError = React.useCallback((error: Error, context?: string) => {
    console.error(`🚨 PWA Connection Error${context ? ` in ${context}` : ''}:`, error)
    
    // Show user-friendly error message
    const message = error.message.includes('Failed to fetch') 
      ? 'Network connection lost. Attempting to reconnect...'
      : 'Real-time connection error. Please refresh if issues persist.'
    
    // You can integrate with your notification system here
    if (typeof window !== 'undefined' && 'navigator' in window && 'serviceWorker' in navigator) {
      // Post message to service worker for background recovery
      navigator.serviceWorker.ready.then(registration => {
        if (registration.active) {
          registration.active.postMessage({
            type: 'CONNECTION_ERROR',
            error: error.message,
            context,
            timestamp: Date.now()
          })
        }
      }).catch(e => {
        console.warn('Failed to notify service worker of connection error:', e)
      })
    }
    
    return { message, canRetry: true }
  }, [])

  const handleRetry = React.useCallback(() => {
    if (typeof window !== 'undefined') {
      // Attempt graceful reconnection first
      const connectionManager = (window as any).__realtimeConnectionManager
      if (connectionManager && typeof connectionManager.forceReconnect === 'function') {
        connectionManager.forceReconnect()
      } else {
        // Fallback to page refresh
        window.location.reload()
      }
    }
  }, [])

  return {
    handleConnectionError,
    handleRetry
  }
}