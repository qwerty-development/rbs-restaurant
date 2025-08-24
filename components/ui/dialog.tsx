"use client"

import * as React from "react"
import * as DialogPrimitive from "@radix-ui/react-dialog"
import { cva, type VariantProps } from "class-variance-authority"
import { XIcon, AlertTriangle, CheckCircle, Info, AlertCircle } from "lucide-react"

import { cn } from "@/lib/utils"

const dialogVariants = cva(
  "relative z-50 grid w-full gap-4 rounded-xl border bg-background shadow-lg duration-300 animate-in fade-in-0 zoom-in-95 slide-in-from-bottom-2",
  {
    variants: {
      variant: {
        default: "max-w-lg",
        sm: "max-w-sm",
        md: "max-w-md",
        lg: "max-w-lg",
        xl: "max-w-xl",
        "2xl": "max-w-2xl",
        "3xl": "max-w-3xl",
        "4xl": "max-w-4xl",
        "5xl": "max-w-5xl",
        full: "max-w-[95vw] max-h-[95vh]",
        modern: "max-w-lg bg-gradient-to-br from-card to-card/95 border-border/50 backdrop-blur-xl shadow-2xl",
        glass: "max-w-lg bg-white/90 backdrop-blur-xl border-white/20 shadow-2xl",
      },
      size: {
        auto: "",
        sm: "p-4",
        md: "p-6",
        lg: "p-8",
        xl: "p-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "md",
    },
  }
)

const overlayVariants = cva(
  "fixed inset-0 z-50 bg-black/50 backdrop-blur-sm",
  {
    variants: {
      blur: {
        none: "bg-black/50",
        sm: "bg-black/30 backdrop-blur-sm",
        md: "bg-black/40 backdrop-blur-md",
        lg: "bg-black/50 backdrop-blur-xl",
      },
    },
    defaultVariants: {
      blur: "sm",
    },
  }
)

function Dialog({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Root>) {
  return <DialogPrimitive.Root data-slot="dialog" {...props} />
}

function DialogTrigger({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Trigger>) {
  return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />
}

function DialogPortal({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Portal>) {
  return <DialogPrimitive.Portal data-slot="dialog-portal" {...props} />
}

function DialogClose({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Close>) {
  return <DialogPrimitive.Close data-slot="dialog-close" {...props} />
}

function DialogOverlay({
  className,
  blur = "sm",
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Overlay> & VariantProps<typeof overlayVariants>) {
  return (
    <DialogPrimitive.Overlay
      data-slot="dialog-overlay"
      className={cn(
        "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
        overlayVariants({ blur }),
        className
      )}
      {...props}
    />
  )
}

export interface DialogContentProps
  extends React.ComponentProps<typeof DialogPrimitive.Content>,
    VariantProps<typeof dialogVariants> {
  showCloseButton?: boolean
  closeButtonClassName?: string
  icon?: React.ComponentType<{ className?: string }>
  animate?: boolean
}

function DialogContent({
  className,
  children,
  showCloseButton = true,
  closeButtonClassName,
  variant = "default",
  size = "md",
  icon: Icon,
  animate = true,
  ...props
}: DialogContentProps) {
  return (
    <DialogPortal data-slot="dialog-portal">
      <DialogOverlay />
      <DialogPrimitive.Content
        data-slot="dialog-content"
        className={cn(
          "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 fixed top-[50%] left-[50%] translate-x-[-50%] translate-y-[-50%]",
          dialogVariants({ variant, size }),
          animate && "data-[state=closed]:slide-out-to-bottom-2 data-[state=open]:slide-in-from-bottom-2",
          className
        )}
        {...props}
      >
        {Icon && (
          <div className="flex items-center justify-center mb-2">
            <div className="p-3 rounded-full bg-primary/10">
              <Icon className="h-6 w-6 text-primary" />
            </div>
          </div>
        )}

        {children}

        {showCloseButton && (
          <DialogPrimitive.Close
            data-slot="dialog-close"
            className={cn(
              "ring-offset-background focus:ring-ring data-[state=open]:bg-accent data-[state=open]:text-muted-foreground absolute top-4 right-4 rounded-lg opacity-70 transition-all hover:opacity-100 focus:ring-2 focus:ring-offset-2 focus:outline-hidden disabled:pointer-events-none [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 p-2 hover:bg-accent/50",
              closeButtonClassName
            )}
          >
            <XIcon className="h-4 w-4" />
            <span className="sr-only">Close</span>
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Content>
    </DialogPortal>
  )
}

function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-header"
      className={cn("flex flex-col gap-3 text-center sm:text-left", className)}
      {...props}
    />
  )
}

function DialogFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn(
        "flex flex-col-reverse gap-3 sm:flex-row sm:justify-end sm:gap-2",
        className
      )}
      {...props}
    />
  )
}

function DialogTitle({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      className={cn("text-xl leading-none font-bold tracking-tight", className)}
      {...props}
    />
  )
}

function DialogDescription({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Description>) {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={cn("text-muted-foreground text-sm leading-relaxed", className)}
      {...props}
    />
  )
}

// Enhanced Dialog variants for common use cases
function ConfirmationDialog({
  title,
  description,
  confirmText = "Confirm",
  cancelText = "Cancel",
  onConfirm,
  onCancel,
  variant = "destructive",
  icon,
  children,
  ...props
}: {
  title: string
  description?: string
  confirmText?: string
  cancelText?: string
  onConfirm: () => void
  onCancel?: () => void
  variant?: "default" | "destructive" | "success" | "warning"
} & DialogContentProps) {
  const icons = {
    destructive: AlertTriangle,
    success: CheckCircle,
    warning: AlertTriangle,
    default: Info,
  }

  const IconComponent = icon || icons[variant]

  return (
    <DialogContent variant="modern" icon={IconComponent} {...props}>
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
        {description && <DialogDescription>{description}</DialogDescription>}
        {children}
      </DialogHeader>
      <DialogFooter>
        <DialogClose asChild>
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-lg border border-border hover:bg-accent/20 transition-colors"
          >
            {cancelText}
          </button>
        </DialogClose>
        <button
          onClick={onConfirm}
          className={cn(
            "px-4 py-2 rounded-lg font-medium transition-all",
            variant === "destructive"
              ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
              : variant === "success"
              ? "bg-green-600 text-white hover:bg-green-700"
              : variant === "warning"
              ? "bg-yellow-600 text-white hover:bg-yellow-700"
              : "bg-primary text-primary-foreground hover:bg-primary/90"
          )}
        >
          {confirmText}
        </button>
      </DialogFooter>
    </DialogContent>
  )
}

function InfoDialog({
  title,
  description,
  children,
  ...props
}: {
  title: string
  description?: string
} & DialogContentProps) {
  return (
    <DialogContent variant="modern" icon={Info} {...props}>
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
        {description && <DialogDescription>{description}</DialogDescription>}
        {children}
      </DialogHeader>
      <DialogFooter>
        <DialogClose asChild>
          <button className="px-4 py-2 rounded-lg border border-border hover:bg-accent/20 transition-colors">
            Close
          </button>
        </DialogClose>
      </DialogFooter>
    </DialogContent>
  )
}

function FormDialog({
  title,
  description,
  children,
  onSubmit,
  submitText = "Submit",
  cancelText = "Cancel",
  loading = false,
  ...props
}: {
  title: string
  description?: string
  onSubmit: () => void
  submitText?: string
  cancelText?: string
  loading?: boolean
} & DialogContentProps) {
  return (
    <DialogContent variant="modern" {...props}>
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
        {description && <DialogDescription>{description}</DialogDescription>}
      </DialogHeader>

      <div className="py-4">
        {children}
      </div>

      <DialogFooter>
        <DialogClose asChild>
          <button
            disabled={loading}
            className="px-4 py-2 rounded-lg border border-border hover:bg-accent/20 transition-colors disabled:opacity-50"
          >
            {cancelText}
          </button>
        </DialogClose>
        <button
          onClick={onSubmit}
          disabled={loading}
          className="px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors flex items-center gap-2"
        >
          {loading && <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />}
          {submitText}
        </button>
      </DialogFooter>
    </DialogContent>
  )
}

export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
  ConfirmationDialog,
  InfoDialog,
  FormDialog,
}
