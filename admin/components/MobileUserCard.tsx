'use client'

import { formatDistanceToNow } from 'date-fns'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

type MobileUserCardProps = {
  userId: string
  onlineSince: string
  lastSeen?: string
}

export const MobileUserCard = ({ userId, onlineSince, lastSeen }: MobileUserCardProps) => {
  const shortId = userId.length > 10 ? `${userId.slice(0, 6)}…${userId.slice(-4)}` : userId

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-background/80 p-4 shadow-sm transition hover:border-primary/40">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Mobile user</p>
          <p className="text-sm font-semibold text-foreground truncate" title={userId}>
            {shortId}
          </p>
        </div>
        <Badge variant="outline" className="w-fit text-xs font-medium">
          Online
        </Badge>
      </div>

      <div className="flex flex-col gap-1 text-xs text-muted-foreground">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
          </span>
          <span>
            Online since{' '}
            <span className="font-medium text-foreground">
              {formatDistanceToNow(new Date(onlineSince), { addSuffix: true })}
            </span>
          </span>
        </div>
        <p className={cn('pl-4', !lastSeen && 'italic')}>
          Last seen:{' '}
          {lastSeen ? formatDistanceToNow(new Date(lastSeen), { addSuffix: true }) : '—'}
        </p>
      </div>
    </div>
  )
}



