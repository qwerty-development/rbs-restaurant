'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Download, Smartphone, X } from 'lucide-react'
import { toast } from 'sonner'

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export function InstallPrompt() {
  const [isIOS, setIsIOS] = useState(false)
  const [isStandalone, setIsStandalone] = useState(false)
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [showPrompt, setShowPrompt] = useState(false)
  const [isInstallable, setIsInstallable] = useState(false)

  useEffect(() => {
    // Check if we're on iOS
    const iOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream
    setIsIOS(iOS)

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
      setShowPrompt(true)
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)

    // Show iOS install prompt if on iOS and not standalone
    if (iOS && !standalone) {
      setShowPrompt(true)
    }

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
          toast.success('App installed successfully!')
          setShowPrompt(false)
        } else {
          toast.info('App installation cancelled')
        }
        
        setInstallPrompt(null)
        setIsInstallable(false)
      } catch (error) {
        console.error('Error installing app:', error)
        toast.error('Failed to install app')
      }
    }
  }

  const dismissPrompt = () => {
    setShowPrompt(false)
    // Store dismissal in localStorage to avoid showing again immediately
    localStorage.setItem('installPromptDismissed', Date.now().toString())
  }

  // Don't show if already installed or if dismissed recently
  if (isStandalone || !showPrompt) {
    return null
  }

  // Check if user dismissed recently (within 7 days)
  const dismissedTime = localStorage.getItem('installPromptDismissed')
  if (dismissedTime) {
    const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000)
    if (parseInt(dismissedTime) > sevenDaysAgo) {
      return null
    }
  }

  return (
    <Card className="border-primary/20 bg-gradient-to-r from-primary/5 to-primary/10">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <div className="rounded-lg bg-primary/10 p-2">
              <Download className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg">Install Plate Management App</CardTitle>
              <CardDescription>
                Get quick access to your plate restaurant management tools
              </CardDescription>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={dismissPrompt}
            className="h-8 w-8"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="text-sm text-muted-foreground">
          Install the app for faster access, offline support, and push notifications.
        </div>
        
        {isInstallable ? (
          <Button onClick={handleInstall} className="w-full">
            <Download className="mr-2 h-4 w-4" />
            Install App
          </Button>
        ) : isIOS ? (
          <div className="space-y-3">
            <Button disabled className="w-full">
              <Smartphone className="mr-2 h-4 w-4" />
              Add to Home Screen
            </Button>
            <div className="text-sm bg-muted p-3 rounded-lg">
              <p className="font-medium mb-2">To install on iOS:</p>
              <ol className="space-y-1 text-muted-foreground">
                <li>1. Tap the share button <span className="font-mono">⎋</span> in Safari</li>
                <li>2. Select "Add to Home Screen" <span className="font-mono">➕</span></li>
                <li>3. Tap "Add" to install the app</li>
              </ol>
            </div>
          </div>
        ) : (
          <Button disabled className="w-full">
            <Download className="mr-2 h-4 w-4" />
            Install Not Available
          </Button>
        )}
      </CardContent>
    </Card>
  )
}