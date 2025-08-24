// components/ui/badge.tsx
import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"
import { X } from "lucide-react"

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 hover-lift",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-gradient-to-r from-primary to-primary/90 text-primary-foreground hover:shadow-lg hover:shadow-primary/20",
        secondary:
          "border-transparent bg-gradient-to-r from-secondary to-secondary/80 text-secondary-foreground hover:shadow-md",
        destructive:
          "border-transparent bg-gradient-to-r from-destructive to-destructive/90 text-destructive-foreground hover:shadow-lg hover:shadow-destructive/20",
        success:
          "border-transparent bg-gradient-to-r from-green-500 to-green-600 text-white hover:shadow-lg hover:shadow-green-500/20",
        warning:
          "border-transparent bg-gradient-to-r from-yellow-500 to-yellow-600 text-white hover:shadow-lg hover:shadow-yellow-500/20",
        info:
          "border-transparent bg-gradient-to-r from-blue-500 to-blue-600 text-white hover:shadow-lg hover:shadow-blue-500/20",
        outline:
          "border-border bg-background text-foreground hover:bg-accent hover:text-accent-foreground",
        ghost:
          "border-transparent bg-accent/20 text-accent-foreground hover:bg-accent/30",
        modern:
          "border border-primary/20 bg-gradient-to-r from-primary/10 to-primary/20 text-primary hover:shadow-lg hover:shadow-primary/10",
      },
      size: {
        sm: "px-2 py-0.5 text-xs",
        md: "px-2.5 py-0.5 text-xs",
        lg: "px-3 py-1 text-sm",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "md",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {
  icon?: React.ComponentType<{ className?: string }>
  removable?: boolean
  onRemove?: () => void
  pulse?: boolean
  dot?: boolean
}

function Badge({
  className,
  variant,
  size,
  icon: Icon,
  removable = false,
  onRemove,
  pulse = false,
  dot = false,
  children,
  ...props
}: BadgeProps) {
  return (
    <div
      className={cn(
        badgeVariants({ variant, size }),
        pulse && "animate-pulse",
        className
      )}
      {...props}
    >
      {dot && (
        <div className="mr-1.5 h-2 w-2 rounded-full bg-current opacity-70" />
      )}

      {Icon && (
        <Icon className="mr-1 h-3 w-3" />
      )}

      <span className="truncate">{children}</span>

      {removable && (
        <button
          type="button"
          className="ml-1 rounded-full p-0.5 hover:bg-current/20 transition-colors"
          onClick={onRemove}
        >
          <X className="h-3 w-3" />
        </button>
      )}
    </div>
  )
}

// Enhanced Badge variants for common use cases
function StatusBadge({
  status,
  className,
  ...props
}: { status: "active" | "inactive" | "pending" | "error" | "success" } & BadgeProps) {
  const statusConfig = {
    active: { variant: "success" as const, children: "Active" },
    inactive: { variant: "secondary" as const, children: "Inactive" },
    pending: { variant: "warning" as const, children: "Pending", pulse: true },
    error: { variant: "destructive" as const, children: "Error" },
    success: { variant: "success" as const, children: "Success" },
  }

  return <Badge {...statusConfig[status]} className={className} {...props} />
}

function NotificationBadge({
  count,
  maxCount = 99,
  className,
  ...props
}: { count: number; maxCount?: number } & BadgeProps) {
  const displayCount = count > maxCount ? `${maxCount}+` : count.toString()

  if (count === 0) return null

  return (
    <Badge
      variant="destructive"
      size="sm"
      className={cn("min-w-[1.25rem] justify-center", className)}
      {...props}
    >
      {displayCount}
    </Badge>
  )
}

function PriorityBadge({
  priority,
  className,
  ...props
}: { priority: "low" | "medium" | "high" | "urgent" } & BadgeProps) {
  const priorityConfig = {
    low: { variant: "secondary" as const, children: "Low", icon: undefined },
    medium: { variant: "warning" as const, children: "Medium", icon: undefined },
    high: { variant: "destructive" as const, children: "High", icon: undefined },
    urgent: { variant: "destructive" as const, children: "Urgent", pulse: true, icon: undefined },
  }

  return <Badge {...priorityConfig[priority]} className={className} {...props} />
}

export { Badge, StatusBadge, NotificationBadge, PriorityBadge, badgeVariants }
