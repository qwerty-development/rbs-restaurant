'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { 
  Download, 
  Smartphone, 
  Monitor, 
  CheckCircle, 
  ExternalLink,
  Share
} from 'lucide-react'
import { toast } from 'react-hot-toast'
import { Badge } from '@/components/ui/badge'

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

interface DownloadAppButtonProps {
  variant?: 'default' | 'card' | 'compact'
  className?: string
}

export function DownloadAppButton({ variant = 'card', className }: DownloadAppButtonProps) {
  const [isIOS, setIsIOS] = useState(false)
  const [isStandalone, setIsStandalone] = useState(false)
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [isInstallable, setIsInstallable] = useState(false)
  const [platform, setPlatform] = useState<'ios' | 'android' | 'desktop' | 'unknown'>('unknown')

  useEffect(() => {
    // Detect platform
    const userAgent = navigator.userAgent.toLowerCase()
    const iOS = /ipad|iphone|ipod/.test(userAgent) && !(window as any).MSStream
    const android = /android/.test(userAgent)
    const desktop = !iOS && !android

    setIsIOS(iOS)
    
    if (iOS) setPlatform('ios')
    else if (android) setPlatform('android')
    else if (desktop) setPlatform('desktop')

    // Check if app is already installed (running in standalone mode)
    const standalone = window.matchMedia('(display-mode: standalone)').matches ||
                      (navigator as any).standalone === true
    setIsStandalone(standalone)

    // Listen for the beforeinstallprompt event
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault()
      const promptEvent = e as BeforeInstallPromptEvent
      setInstallPrompt(promptEvent)
      setIsInstallable(true)
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    }
  }, [])

  const handleInstall = async () => {
    if (installPrompt) {
      try {
        await installPrompt.prompt()
        const choiceResult = await installPrompt.userChoice
        
        if (choiceResult.outcome === 'accepted') {
          toast.success('App installed successfully! You can now access it from your home screen.')
        } else {
          toast('App installation cancelled')
        }
        
        setInstallPrompt(null)
        setIsInstallable(false)
      } catch (error) {
        console.error('Error installing app:', error)
        toast.error('Failed to install app. Please try again.')
      }
    }
  }

  const getPlatformIcon = () => {
    switch (platform) {
      case 'ios':
        return <Smartphone className="h-5 w-5" />
      case 'android':
        return <Smartphone className="h-5 w-5" />
      case 'desktop':
        return <Monitor className="h-5 w-5" />
      default:
        return <Download className="h-5 w-5" />
    }
  }

  const getPlatformInstructions = () => {
    if (platform === 'ios') {
      return {
        title: 'Install on iPhone/iPad',
        steps: [
          'Tap the Share button ⎋ in Safari',
          'Select "Add to Home Screen" ➕',
          'Tap "Add" to install the app'
        ]
      }
    }
    return null
  }

  if (variant === 'compact') {
    if (isStandalone) {
      return (
        <div className={`flex items-center gap-2 text-sm text-muted-foreground ${className}`}>
          <CheckCircle className="h-4 w-4 text-green-500" />
          App Installed
        </div>
      )
    }

    if (isInstallable) {
      return (
        <Button onClick={handleInstall} size="sm" className={className}>
          <Download className="mr-2 h-4 w-4" />
          Install App
        </Button>
      )
    }

    return null
  }

  if (variant === 'default') {
    if (isStandalone) {
      return (
        <div className={`flex items-center gap-2 ${className}`}>
          <CheckCircle className="h-5 w-5 text-green-500" />
          <span className="text-sm font-medium text-green-700 dark:text-green-400">
            App is installed and running!
          </span>
        </div>
      )
    }

    if (isInstallable) {
      return (
        <Button onClick={handleInstall} className={className}>
          <Download className="mr-2 h-4 w-4" />
          Download & Install App
        </Button>
      )
    }

    if (platform === 'ios') {
      return (
        <Button variant="outline" disabled className={className}>
          <Share className="mr-2 h-4 w-4" />
          Use Safari to Install
        </Button>
      )
    }

    return (
      <Button variant="outline" disabled className={className}>
        <Download className="mr-2 h-4 w-4" />
        Install Not Available
      </Button>
    )
  }

  // Card variant (default)
  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-primary/10 p-2.5">
              {getPlatformIcon()}
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
          {isStandalone && (
            <Badge variant="default" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300">
              <CheckCircle className="mr-1 h-3 w-3" />
              Installed
            </Badge>
          )}
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
            
            <div className="grid gap-2 text-sm">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-500" />
                <span>✅ Offline functionality</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-500" />
                <span>✅ Push notifications</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-500" />
                <span>✅ Home screen access</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-500" />
                <span>✅ Native app experience</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="text-sm text-muted-foreground">
              Install the Plate Management app for the best experience:
            </div>
            
            <div className="grid gap-2 text-sm">
              <div className="flex items-center gap-2">
                <Download className="h-4 w-4 text-blue-500" />
                <span>⚡ Faster loading and performance</span>
              </div>
              <div className="flex items-center gap-2">
                <Smartphone className="h-4 w-4 text-blue-500" />
                <span>📱 Native app-like experience</span>
              </div>
              <div className="flex items-center gap-2">
                <Monitor className="h-4 w-4 text-blue-500" />
                <span>🔔 Real-time push notifications</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-blue-500" />
                <span>💾 Works offline with cached data</span>
              </div>
            </div>

            {isInstallable ? (
              <Button onClick={handleInstall} className="w-full" size="lg">
                <Download className="mr-2 h-4 w-4" />
                Download & Install App Now
              </Button>
            ) : getPlatformInstructions() ? (
              <div className="space-y-3">
                <Button variant="outline" className="w-full" asChild>
                  <div>
                    <ExternalLink className="mr-2 h-4 w-4" />
                    {getPlatformInstructions()?.title}
                  </div>
                </Button>
                
                <div className="bg-muted p-3 rounded-lg space-y-2">
                  <div className="font-medium text-sm">Installation Steps:</div>
                  <ol className="space-y-1 text-sm text-muted-foreground">
                    {getPlatformInstructions()?.steps.map((step, index) => (
                      <li key={index}>{index + 1}. {step}</li>
                    ))}
                  </ol>
                </div>
              </div>
            ) : (
              <Button variant="outline" disabled className="w-full">
                <Download className="mr-2 h-4 w-4" />
                Install Not Available on This Device
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}