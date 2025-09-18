// app/layout.tsx
import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import { Toaster } from "react-hot-toast"
import { Toaster as SonnerToaster } from "sonner"
import { Providers } from "@/components/provider"
import { InstallPrompt } from "@/components/pwa/install-prompt"
import { PWAProvider } from "@/components/pwa/pwa-provider"
import { NotificationProvider } from "@/lib/contexts/notification-context"
import { NotificationContainer } from "@/components/notifications/notification-container"
import { GlobalLayoutNotifications } from "@/components/notifications/global-layout-notifications"
import { AppVisibilityHandler } from "@/components/pwa/app-visibility-handler"
 
// import { Analytics } from "@vercel/analytics/next"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "Plate Management",
  description: "Complete restaurant management system",
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Plate Management',
  },
  icons: {
    icon: [
      { url: '/icon-192x192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icon-384x384.png', sizes: '384x384', type: 'image/png' },
      { url: '/icon-512x512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [
      { url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
    ],
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover, orientation=landscape" />
        <meta name="theme-color" content="#7A2E4A" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Plate Management" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="application-name" content="Plate Management" />
        <meta name="msapplication-TileColor" content="#7A2E4A" />
        <meta name="msapplication-config" content="none" />
        <meta name="screen-orientation" content="landscape" />
        <meta name="orientation" content="landscape" />
        <link rel="manifest" href="/manifest.json" />
        <link rel="icon" type="image/png" sizes="192x192" href="/icon-192x192.png" />
        <link rel="icon" type="image/png" sizes="384x384" href="/icon-384x384.png" />
        <link rel="icon" type="image/png" sizes="512x512" href="/icon-512x512.png" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
      </head>
      <body className={inter.className} suppressHydrationWarning>
        <Providers>
          <PWAProvider>
            <NotificationProvider>
              <AppVisibilityHandler />
              <GlobalLayoutNotifications />
              {children}
              <NotificationContainer />
              
              <div className="fixed bottom-3 left-3 right-3 z-40 sm:max-w-sm sm:left-auto sm:right-3">
                <InstallPrompt />
              </div>
              {/* Global PWA install prompt (auto-hides when not eligible) */}
              {/* Note: Import added below */}
              <Toaster position="top-center" />
              <SonnerToaster richColors position="top-center" />
              {/* <Analytics /> */}
            </NotificationProvider>
          </PWAProvider>
        </Providers>
      </body>
    </html>
  )
}

