// components/dashboard/quick-actions.tsx
"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  Plus,
  UserCheck,
  Table2,
  Clock,
  Calendar,
  Search,
  FileText,
  Phone,
  ChevronRight,
  Sparkles
} from "lucide-react"
import { useRouter } from "next/navigation"
import { cn } from "@/lib/utils"

interface QuickActionsProps {
  onAddBooking: () => void
  stats?: {
    pendingCount: number
    unassignedCount: number
    arrivingSoonCount: number
  }
}

export function QuickActions({ onAddBooking, stats }: QuickActionsProps) {
  const router = useRouter()

  const actions = [
    {
      title: "Add Walk-in",
      description: "Create manual booking",
      icon: Plus,
      onClick: onAddBooking,
      variant: "default" as const,
      badge: null
    },
    {
      title: "Pending Bookings",
      description: "Review and confirm",
      icon: Clock,
      onClick: () => router.push("/bookings?status=pending"),
      variant: "outline" as const,
      badge: stats?.pendingCount || 0
    },
    {
      title: "Assign Tables",
      description: "Tables needed",
      icon: Table2,
      onClick: () => router.push("/bookings?needsTables=true"),
      variant: "outline" as const,
      badge: stats?.unassignedCount || 0
    },
    {
      title: "Check Arrivals",
      description: "Next 30 minutes",
      icon: UserCheck,
      onClick: () => router.push("/bookings?arriving=soon"),
      variant: "outline" as const,
      badge: stats?.arrivingSoonCount || 0
    }
  ]

  return (
    <Card className="animate-slide-up">
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Sparkles className="h-5 w-5 text-primary" />
          Quick Actions
        </CardTitle>
        <CardDescription>Common tasks and shortcuts</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {actions.map((action, index) => (
          <Button
            key={index}
            variant={action.variant}
            className={cn(
              "justify-start h-auto py-4 px-4 rounded-xl group relative overflow-hidden",
              "hover:shadow-lg hover:translate-y-[-2px] transition-all duration-200",
              "border border-border/50 hover:border-primary/30",
              action.variant === "default"
                ? "hover:scale-[1.02] bg-gradient-to-r from-primary to-primary/90 text-primary-foreground shadow-md hover:shadow-lg"
                : "hover:bg-accent/20 hover:shadow-sm"
            )}
            onClick={action.onClick}
            style={{
              animationDelay: `${(index + 1) * 100}ms`
            }}
          >
            <div className="flex items-center gap-3 flex-1">
              <div className={cn(
                "p-2 rounded-lg transition-colors duration-200",
                action.variant === "default"
                  ? "bg-primary/10 text-primary"
                  : "bg-accent/20 text-accent-foreground group-hover:bg-accent/30"
              )}>
                <action.icon className="h-4 w-4" />
              </div>
              <div className="flex-1 text-left">
                <div className="font-semibold text-sm">{action.title}</div>
                <div className="text-xs text-muted-foreground font-medium">{action.description}</div>
              </div>
              {action.badge !== null && action.badge > 0 && (
                <div className="badge-modern badge-primary mr-2">
                  {action.badge}
                </div>
              )}
              <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground group-hover:translate-x-1 transition-all duration-200" />
            </div>
          </Button>
        ))}

        <div className="mt-4 pt-4 border-t border-border/50 grid grid-cols-2 gap-3">
          <Button
            variant="outline"
            size="sm"
            className="rounded-lg hover:scale-105 hover:shadow-sm transition-all duration-200"
            onClick={() => router.push("/bookings")}
          >
            <Calendar className="h-4 w-4 mr-2" />
            All Bookings
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="rounded-lg hover:scale-105 hover:shadow-sm transition-all duration-200"
            onClick={() => router.push("/tables")}
          >
            <Table2 className="h-4 w-4 mr-2" />
            Manage Tables
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}