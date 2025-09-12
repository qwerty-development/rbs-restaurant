'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { 
  Download, 
  CheckCircle, 
  XCircle, 
  AlertCircle,
  Smartphone,
  Monitor,
  RefreshCw,
  ExternalLink,
  Share,
  Info
} from 'lucide-react'
import { toast } from 'react-hot-toast'

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

interface PWADiagnostics {
  hasServiceWorker: boolean
  serviceWorkerRegistered: boolean
  hasManifest: boolean
  manifestValid: boolean
  isSecure: boolean
  isInstallable: boolean
  installPromptAvailable: boolean
  isStandalone: boolean
  platform: 'ios' | 'android' | 'desktop' | 'unknown'
  browser: string
  manifestErrors: string[]
  recommendations: string[]
}

interface DownloadAppButtonProps {
  variant?: 'default' | 'card' | 'compact'
  className?: string
  showDiagnostics?: boolean
}

export function DownloadAppButton({ 
  variant = 'card', 
  className, 
  showDiagnostics = false 
}: DownloadAppButtonProps) {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [diagnostics, setDiagnostics] = useState<PWADiagnostics | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [showDebug, setShowDebug] = useState(showDiagnostics)

  useEffect(() => {
    runDiagnostics()
  }, [])

  const runDiagnostics = async () => {
    setIsLoading(true)
    
    try {
      const userAgent = navigator.userAgent.toLowerCase()
      const isIOS = /ipad|iphone|ipod/.test(userAgent)
      const isAndroid = /android/.test(userAgent)
      const isDesktop = !isIOS && !isAndroid
      
      let browser = 'unknown'
      if (userAgent.includes('chrome')) browser = 'chrome'
      else if (userAgent.includes('firefox')) browser = 'firefox'
      else if (userAgent.includes('safari')) browser = 'safari'
      else if (userAgent.includes('edge')) browser = 'edge'

      const platform = isIOS ? 'ios' : isAndroid ? 'android' : isDesktop ? 'desktop' : 'unknown'
      
      const hasServiceWorker = 'serviceWorker' in navigator
      let serviceWorkerRegistered = false
      
      if (hasServiceWorker) {
        try {
          const registration = await navigator.serviceWorker.getRegistration()
          serviceWorkerRegistered = !!registration
        } catch (error) {
          console.warn('Service worker check failed:', error)
        }
      }

      // Check manifest
      const hasManifest = !!document.querySelector('link[rel="manifest"]')
      let manifestValid = false
      let manifestErrors: string[] = []
      
      if (hasManifest) {
        try {
          const manifestLink = document.querySelector('link[rel="manifest"]') as HTMLLinkElement
          const manifestUrl = manifestLink?.href
          
          if (manifestUrl) {
            const response = await fetch(manifestUrl)
            const manifest = await response.json()
            
            // Basic validation
            if (!manifest.name) manifestErrors.push('Missing name field')
            if (!manifest.start_url) manifestErrors.push('Missing start_url field')
            if (!manifest.display) manifestErrors.push('Missing display field')
            if (!manifest.icons || manifest.icons.length === 0) manifestErrors.push('Missing icons')
            
            manifestValid = manifestErrors.length === 0
          }
        } catch (error) {
          manifestErrors.push('Failed to fetch or parse manifest')
          console.warn('Manifest check failed:', error)
        }
      }

      const isSecure = location.protocol === 'https:' || location.hostname === 'localhost'
      const isStandalone = window.matchMedia('(display-mode: standalone)').matches || 
                          (navigator as any).standalone === true

      const recommendations: string[] = []
      
      if (!hasServiceWorker) recommendations.push('Service Worker not supported in this browser')
      if (!serviceWorkerRegistered) recommendations.push('Service Worker needs to be registered')
      if (!hasManifest) recommendations.push('Web App Manifest not found')
      if (!manifestValid) recommendations.push('Web App Manifest has validation errors')
      if (!isSecure) recommendations.push('HTTPS required for PWA installation')
      if (platform === 'ios' && browser !== 'safari') recommendations.push('iOS PWA installation only works in Safari')
      
      setDiagnostics({
        hasServiceWorker,
        serviceWorkerRegistered,
        hasManifest,
        manifestValid,
        isSecure,
        isInstallable: !!installPrompt,
        installPromptAvailable: !!installPrompt,
        isStandalone,
        platform,
        browser,
        manifestErrors,
        recommendations
      })
    } catch (error) {
      console.error('Diagnostics failed:', error)
      toast.error('Failed to run PWA diagnostics')
    }
    
    setIsLoading(false)
  }

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault()
      const promptEvent = e as BeforeInstallPromptEvent
      setInstallPrompt(promptEvent)
      
      // Update diagnostics
      if (diagnostics) {
        setDiagnostics({
          ...diagnostics,
          isInstallable: true,
          installPromptAvailable: true
        })
      }
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    }
  }, [diagnostics])

  const handleInstall = async () => {
    if (installPrompt) {
      try {
        await installPrompt.prompt()
        const choiceResult = await installPrompt.userChoice
        
        if (choiceResult.outcome === 'accepted') {
          toast.success('App installed successfully! You can now access it from your home screen.')
          // Update diagnostics
          runDiagnostics()
        } else {
          toast('App installation cancelled')
        }
        
        setInstallPrompt(null)
      } catch (error) {
        console.error('Error installing app:', error)
        toast.error('Failed to install app. Please try again.')
      }
    }
  }

  const handleForceRefresh = () => {
    runDiagnostics()
    toast.success('PWA diagnostics refreshed')
  }

  const renderDiagnostics = () => {
    if (!showDebug || !diagnostics) return null

    return (
      <Card className="mt-4 border-orange-200 bg-orange-50 dark:border-orange-800 dark:bg-orange-950/20">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Info className="h-4 w-4" />
            PWA Diagnostics
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={handleForceRefresh}
              className="ml-auto h-6 px-2"
            >
              <RefreshCw className="h-3 w-3" />
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-xs">
          <div className="grid gap-2">
            <div className="flex items-center justify-between">
              <span>Platform: {diagnostics.platform} ({diagnostics.browser})</span>
              <Badge variant="outline" className="text-xs">{diagnostics.platform}</Badge>
            </div>
            
            <div className="flex items-center justify-between">
              <span>HTTPS Secure</span>
              {diagnostics.isSecure ? (
                <CheckCircle className="h-4 w-4 text-green-500" />
              ) : (
                <XCircle className="h-4 w-4 text-red-500" />
              )}
            </div>

            <div className="flex items-center justify-between">
              <span>Service Worker Support</span>
              {diagnostics.hasServiceWorker ? (
                <CheckCircle className="h-4 w-4 text-green-500" />
              ) : (
                <XCircle className="h-4 w-4 text-red-500" />
              )}
            </div>

            <div className="flex items-center justify-between">
              <span>Service Worker Registered</span>
              {diagnostics.serviceWorkerRegistered ? (
                <CheckCircle className="h-4 w-4 text-green-500" />
              ) : (
                <XCircle className="h-4 w-4 text-red-500" />
              )}
            </div>

            <div className="flex items-center justify-between">
              <span>Web App Manifest</span>
              {diagnostics.hasManifest ? (
                <CheckCircle className="h-4 w-4 text-green-500" />
              ) : (
                <XCircle className="h-4 w-4 text-red-500" />
              )}
            </div>

            <div className="flex items-center justify-between">
              <span>Manifest Valid</span>
              {diagnostics.manifestValid ? (
                <CheckCircle className="h-4 w-4 text-green-500" />
              ) : (
                <XCircle className="h-4 w-4 text-red-500" />
              )}
            </div>

            <div className="flex items-center justify-between">
              <span>Install Prompt Available</span>
              {diagnostics.installPromptAvailable ? (
                <CheckCircle className="h-4 w-4 text-green-500" />
              ) : (
                <XCircle className="h-4 w-4 text-orange-500" />
              )}
            </div>

            <div className="flex items-center justify-between">
              <span>Already Installed</span>
              {diagnostics.isStandalone ? (
                <CheckCircle className="h-4 w-4 text-green-500" />
              ) : (
                <XCircle className="h-4 w-4 text-gray-400" />
              )}
            </div>
          </div>

          {diagnostics.manifestErrors.length > 0 && (
            <>
              <Separator />
              <div>
                <div className="font-medium text-red-700 dark:text-red-300 mb-1">Manifest Errors:</div>
                <ul className="list-disc list-inside text-red-600 dark:text-red-400 space-y-1">
                  {diagnostics.manifestErrors.map((error, index) => (
                    <li key={index}>{error}</li>
                  ))}
                </ul>
              </div>
            </>
          )}

          {diagnostics.recommendations.length > 0 && (
            <>
              <Separator />
              <div>
                <div className="font-medium text-orange-700 dark:text-orange-300 mb-1">Recommendations:</div>
                <ul className="list-disc list-inside text-orange-600 dark:text-orange-400 space-y-1">
                  {diagnostics.recommendations.map((rec, index) => (
                    <li key={index}>{rec}</li>
                  ))}
                </ul>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    )
  }

  if (isLoading) {
    return (
      <Card className={className}>
        <CardContent className="flex items-center justify-center p-6">
          <RefreshCw className="h-5 w-5 animate-spin mr-2" />
          Checking PWA compatibility...
        </CardContent>
      </Card>
    )
  }

  if (!diagnostics) {
    return (
      <Card className={className}>
        <CardContent className="flex items-center justify-center p-6 text-red-500">
          <XCircle className="h-5 w-5 mr-2" />
          Failed to check PWA compatibility
        </CardContent>
      </Card>
    )
  }

  const { isStandalone, platform, isInstallable, isSecure, hasServiceWorker, serviceWorkerRegistered, hasManifest, manifestValid } = diagnostics

  if (variant === 'compact') {
    if (isStandalone) {
      return (
        <div className={`flex items-center gap-2 text-sm text-muted-foreground ${className}`}>
          <CheckCircle className="h-4 w-4 text-green-500" />
          App Installed
        </div>
      )
    }

    if (isInstallable && installPrompt) {
      return (
        <Button onClick={handleInstall} size="sm" className={className}>
          <Download className="mr-2 h-4 w-4" />
          Install App
        </Button>
      )
    }

    return (
      <Button 
        variant="outline" 
        size="sm" 
        className={className}
        onClick={() => setShowDebug(!showDebug)}
      >
        <AlertCircle className="mr-2 h-4 w-4" />
        Not Available
      </Button>
    )
  }

  // Card variant
  return (
    <div className={className}>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-primary/10 p-2.5">
                {platform === 'desktop' ? (
                  <Monitor className="h-5 w-5" />
                ) : (
                  <Smartphone className="h-5 w-5" />
                )}
              </div>
              <div>
                <CardTitle className="text-xl">
                  {isStandalone ? 'App Installed!' : 'Download Plate Management App'}
                </CardTitle>
                <CardDescription>
                  {isStandalone 
                    ? 'You\'re using the installed app version'
                    : 'Get the full app experience with offline support'
                  }
                </CardDescription>
              </div>
            </div>
            <div className="flex flex-col gap-1">
              {isStandalone && (
                <Badge variant="default" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300">
                  <CheckCircle className="mr-1 h-3 w-3" />
                  Installed
                </Badge>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowDebug(!showDebug)}
                className="h-6 px-2 text-xs"
              >
                {showDebug ? 'Hide' : 'Debug'}
              </Button>
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="space-y-4">
          {isStandalone ? (
            <div className="space-y-3">
              <div className="flex items-start gap-3 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                <CheckCircle className="h-5 w-5 text-green-500 mt-0.5" />
                <div className="space-y-1">
                  <div className="font-medium text-green-900 dark:text-green-100">
                    Perfect! You're using the app version
                  </div>
                  <div className="text-sm text-green-700 dark:text-green-300">
                    Enjoy faster loading, offline support, and push notifications
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Installation Status */}
              <div className="space-y-2">
                {!isSecure && (
                  <div className="flex items-start gap-2 p-2 bg-red-50 dark:bg-red-900/20 rounded text-sm text-red-700 dark:text-red-300">
                    <XCircle className="h-4 w-4 mt-0.5" />
                    HTTPS required for PWA installation
                  </div>
                )}
                
                {!hasServiceWorker && (
                  <div className="flex items-start gap-2 p-2 bg-red-50 dark:bg-red-900/20 rounded text-sm text-red-700 dark:text-red-300">
                    <XCircle className="h-4 w-4 mt-0.5" />
                    Service Worker not supported in this browser
                  </div>
                )}

                {!hasManifest && (
                  <div className="flex items-start gap-2 p-2 bg-red-50 dark:bg-red-900/20 rounded text-sm text-red-700 dark:text-red-300">
                    <XCircle className="h-4 w-4 mt-0.5" />
                    Web App Manifest not found
                  </div>
                )}
              </div>

              {/* Installation Button */}
              {isInstallable && installPrompt ? (
                <Button onClick={handleInstall} className="w-full" size="lg">
                  <Download className="mr-2 h-4 w-4" />
                  Download & Install App Now
                </Button>
              ) : platform === 'ios' ? (
                <div className="space-y-3">
                  <Button variant="outline" className="w-full" asChild>
                    <div>
                      <Share className="mr-2 h-4 w-4" />
                      Install on iPhone/iPad
                    </div>
                  </Button>
                  
                  <div className="bg-muted p-3 rounded-lg space-y-2">
                    <div className="font-medium text-sm">Installation Steps:</div>
                    <ol className="space-y-1 text-sm text-muted-foreground">
                      <li>1. Tap the Share button ⎋ in Safari</li>
                      <li>2. Select "Add to Home Screen" ➕</li>
                      <li>3. Tap "Add" to install the app</li>
                    </ol>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <Button variant="outline" disabled className="w-full">
                    <AlertCircle className="mr-2 h-4 w-4" />
                    Install Not Available
                  </Button>
                  <p className="text-sm text-muted-foreground text-center">
                    Your browser or device doesn't support PWA installation
                  </p>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {renderDiagnostics()}
    </div>
  )
}