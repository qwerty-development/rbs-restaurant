'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export default function TestPWAPage() {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [canInstall, setCanInstall] = useState(false)
  const [isInstalled, setIsInstalled] = useState(false)
  const [logs, setLogs] = useState<string[]>([])

  const addLog = (message: string) => {
    setLogs(prev => [...prev, `${new Date().toLocaleTimeString()}: ${message}`])
  }

  useEffect(() => {
    addLog('PWA Test page loaded')
    
    // Check if already installed
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches ||
                        (navigator as any).standalone === true
    setIsInstalled(isStandalone)
    addLog(`Is standalone: ${isStandalone}`)

    // Listen for beforeinstallprompt
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault()
      const promptEvent = e as BeforeInstallPromptEvent
      setInstallPrompt(promptEvent)
      setCanInstall(true)
      addLog('beforeinstallprompt event fired!')
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    addLog('Event listener added for beforeinstallprompt')

    // Check service worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then(registrations => {
        addLog(`Service workers registered: ${registrations.length}`)
        registrations.forEach((reg, index) => {
          addLog(`SW ${index + 1}: ${reg.scope} - ${reg.active?.state || 'no active worker'}`)
        })
      })
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    }
  }, [])

  const handleInstall = async () => {
    if (installPrompt) {
      try {
        addLog('Attempting to show install prompt...')
        await installPrompt.prompt()
        const choiceResult = await installPrompt.userChoice
        addLog(`User choice: ${choiceResult.outcome}`)
        
        if (choiceResult.outcome === 'accepted') {
          setCanInstall(false)
          setIsInstalled(true)
        }
      } catch (error) {
        addLog(`Install error: ${error}`)
      }
    }
  }

  const testManifest = async () => {
    try {
      const response = await fetch('/manifest.json')
      const manifest = await response.json()
      addLog(`Manifest loaded: ${manifest.name}`)
    } catch (error) {
      addLog(`Manifest error: ${error}`)
    }
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>PWA Installation Test</CardTitle>
          <CardDescription>Test PWA installation functionality</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <strong>Can Install:</strong> {canInstall ? '✅ Yes' : '❌ No'}
            </div>
            <div>
              <strong>Is Installed:</strong> {isInstalled ? '✅ Yes' : '❌ No'}
            </div>
          </div>
          
          <div className="space-y-2">
            <Button 
              onClick={handleInstall} 
              disabled={!canInstall}
              className="w-full"
            >
              {canInstall ? 'Install PWA' : 'Install Not Available'}
            </Button>
            
            <Button 
              onClick={testManifest} 
              variant="outline"
              className="w-full"
            >
              Test Manifest
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Debug Logs</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="bg-gray-100 p-4 rounded-lg max-h-64 overflow-y-auto">
            {logs.map((log, index) => (
              <div key={index} className="text-sm font-mono">
                {log}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
