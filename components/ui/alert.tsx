import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"
import { X, AlertCircle, CheckCircle, Info, AlertTriangle } from "lucide-react"

const alertVariants = cva(
  "relative w-full rounded-xl border px-4 py-3 text-sm transition-all duration-200 grid has-[>svg]:grid-cols-[calc(var(--spacing)*4)_1fr] grid-cols-[0_1fr] has-[>svg]:gap-x-3 gap-y-0.5 items-start [&>svg]:size-4 [&>svg]:translate-y-0.5 [&>svg]:text-current hover-lift",
  {
    variants: {
      variant: {
        default: "bg-card border-border text-card-foreground shadow-sm",
        destructive: "border-destructive/20 bg-destructive/5 text-destructive [&>svg]:text-destructive shadow-sm",
        success: "border-green-200 bg-green-50/50 text-green-800 [&>svg]:text-green-600 shadow-sm",
        warning: "border-yellow-200 bg-yellow-50/50 text-yellow-800 [&>svg]:text-yellow-600 shadow-sm",
        info: "border-blue-200 bg-blue-50/50 text-blue-800 [&>svg]:text-blue-600 shadow-sm",
        modern: "border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10 text-card-foreground shadow-md backdrop-blur-sm",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface AlertProps
  extends React.ComponentProps<"div">,
    VariantProps<typeof alertVariants> {
  dismissible?: boolean
  onDismiss?: () => void
  icon?: React.ComponentType<{ className?: string }>
  animate?: boolean
}

function Alert({
  className,
  variant = "default",
  dismissible = false,
  onDismiss,
  icon: Icon,
  animate = false,
  children,
  ...props
}: AlertProps) {
  const [isVisible, setIsVisible] = React.useState(true)

  const handleDismiss = () => {
    setIsVisible(false)
    onDismiss?.()
  }

  if (!isVisible) return null

  const defaultIcons = {
    destructive: AlertCircle,
    success: CheckCircle,
    warning: AlertTriangle,
    info: Info,
    default: AlertCircle,
    modern: Info,
  }

  const IconComponent = Icon || defaultIcons[variant]

  return (
    <div
      data-slot="alert"
      role="alert"
      className={cn(
        alertVariants({ variant }),
        animate && "animate-slide-up",
        className
      )}
      {...props}
    >
      {IconComponent && (
        <IconComponent className="h-4 w-4 mt-0.5 flex-shrink-0" />
      )}

      <div className="flex-1 space-y-1">
        {children}
      </div>

      {dismissible && (
        <button
          type="button"
          className="flex-shrink-0 p-1 rounded-full hover:bg-current/10 transition-colors"
          onClick={handleDismiss}
          aria-label="Dismiss alert"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  )
}

function AlertTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-title"
      className={cn(
        "col-start-2 line-clamp-1 min-h-4 font-semibold tracking-tight",
        className
      )}
      {...props}
    />
  )
}

function AlertDescription({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-description"
      className={cn(
        "text-muted-foreground col-start-2 grid justify-items-start gap-1 text-sm [&_p]:leading-relaxed",
        className
      )}
      {...props}
    />
  )
}

// Enhanced Alert variants for common use cases
function ToastAlert({
  type = "info",
  title,
  description,
  className,
  ...props
}: {
  type?: "success" | "error" | "warning" | "info"
  title: string
  description?: string
} & AlertProps) {
  const typeConfig = {
    success: { variant: "success" as const, icon: CheckCircle },
    error: { variant: "destructive" as const, icon: AlertCircle },
    warning: { variant: "warning" as const, icon: AlertTriangle },
    info: { variant: "info" as const, icon: Info },
  }

  return (
    <Alert
      variant={typeConfig[type].variant}
      icon={typeConfig[type].icon}
      className={cn("max-w-md", className)}
      {...props}
    >
      <AlertTitle>{title}</AlertTitle>
      {description && <AlertDescription>{description}</AlertDescription>}
    </Alert>
  )
}

function InlineAlert({
  type = "info",
  message,
  className,
  ...props
}: {
  type?: "success" | "error" | "warning" | "info"
  message: string
} & AlertProps) {
  const typeConfig = {
    success: { variant: "success" as const, icon: CheckCircle },
    error: { variant: "destructive" as const, icon: AlertCircle },
    warning: { variant: "warning" as const, icon: AlertTriangle },
    info: { variant: "info" as const, icon: Info },
  }

  return (
    <Alert
      variant={typeConfig[type].variant}
      icon={typeConfig[type].icon}
      className={cn("text-sm", className)}
      {...props}
    >
      <AlertDescription className="col-start-2">{message}</AlertDescription>
    </Alert>
  )
}

export { Alert, AlertTitle, AlertDescription, ToastAlert, InlineAlert }
