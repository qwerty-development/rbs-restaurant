'use client'

import { useMemo } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Smartphone } from 'lucide-react'
import { MobileUserCard } from '@/admin/components/MobileUserCard'
import { useMobilePresence } from '@/admin/hooks/useMobilePresence'

const STATUS_META = {
  connecting: { label: 'Connecting', color: 'text-amber-600', dot: 'bg-amber-500' },
  connected: { label: 'Connected', color: 'text-emerald-600', dot: 'bg-emerald-500' },
  disconnected: { label: 'Disconnected', color: 'text-gray-500', dot: 'bg-gray-400' },
  error: { label: 'Error', color: 'text-red-600', dot: 'bg-red-500' },
  idle: { label: 'Idle', color: 'text-muted-foreground', dot: 'bg-muted-foreground' },
} as const

export const MobileUsersWidget = () => {
  const { onlineUsers, status } = useMobilePresence()

  const statusMeta = STATUS_META[status] ?? STATUS_META.connecting
  const sortedUsers = useMemo(
    () =>
      [...onlineUsers].sort(
        (a, b) => new Date(a.onlineSince).getTime() - new Date(b.onlineSince).getTime()
      ),
    [onlineUsers]
  )

  return (
    <Card className="border-primary/10 bg-gradient-to-br from-white to-primary/5">
      <CardHeader className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-1.5">
          <CardTitle className="flex items-center gap-2 text-base md:text-lg">
            <Smartphone className="h-5 w-5 text-primary" />
            Mobile Users Online
          </CardTitle>
          <CardDescription>
            Live presence from the mobile app via Supabase Realtime Presence.
          </CardDescription>
        </div>
        <div className="flex items-center gap-4 text-sm">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className={`absolute inline-flex h-full w-full animate-ping rounded-full ${statusMeta.dot} opacity-60`} />
              <span className={`relative inline-flex h-2.5 w-2.5 rounded-full ${statusMeta.dot}`} />
            </span>
            <span className={`font-medium ${statusMeta.color}`}>{statusMeta.label}</span>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="mb-4 flex items-baseline gap-2">
          <p className="text-4xl font-semibold text-primary">{sortedUsers.length}</p>
          <p className="text-sm text-muted-foreground">users online</p>
        </div>

        {sortedUsers.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No mobile users are online right now. This widget updates automatically when users open
            the app.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {sortedUsers.map((user) => (
              <MobileUserCard
                key={user.userId}
                userId={user.userId}
                onlineSince={user.onlineSince}
                lastSeen={user.lastSeen}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}


