import { cn } from "@/lib/utils"

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "circle" | "text" | "card" | "avatar"
  size?: "sm" | "md" | "lg" | "xl"
}

function Skeleton({
  className,
  variant = "default",
  size = "md",
  ...props
}: SkeletonProps) {
  const baseClasses = "animate-pulse bg-gradient-to-r from-muted via-muted/80 to-muted bg-[length:200%_100%]"

  const variantClasses = {
    default: "rounded-lg",
    circle: "rounded-full",
    text: "rounded h-4",
    card: "rounded-xl border border-border/20",
    avatar: "rounded-full"
  }

  const sizeClasses = {
    sm: "h-3",
    md: "h-4",
    lg: "h-6",
    xl: "h-8"
  }

  return (
    <div
      className={cn(
        baseClasses,
        variantClasses[variant],
        variant !== "text" && variant !== "avatar" && sizeClasses[size],
        variant === "avatar" && "w-10 h-10",
        className
      )}
      {...props}
    />
  )
}

// Enhanced Skeleton variants for common use cases
function SkeletonCard({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("card-modern p-6 space-y-4", className)} {...props}>
      <div className="flex items-center space-x-3">
        <Skeleton variant="avatar" />
        <div className="space-y-2 flex-1">
          <Skeleton variant="text" size="sm" className="w-3/4" />
          <Skeleton variant="text" size="sm" className="w-1/2" />
        </div>
      </div>
      <div className="space-y-2">
        <Skeleton variant="text" className="w-full" />
        <Skeleton variant="text" className="w-4/5" />
        <Skeleton variant="text" className="w-2/3" />
      </div>
    </div>
  )
}

function SkeletonTable({ rows = 5, columns = 4, className, ...props }: { rows?: number; columns?: number } & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("space-y-3", className)} {...props}>
      {/* Header */}
      <div className="flex space-x-4 pb-3 border-b border-border/20">
        {Array.from({ length: columns }).map((_, i) => (
          <Skeleton key={i} variant="text" size="sm" className="flex-1" />
        ))}
      </div>
      {/* Rows */}
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div key={rowIndex} className="flex space-x-4">
          {Array.from({ length: columns }).map((_, colIndex) => (
            <Skeleton key={colIndex} variant="text" size="sm" className="flex-1" />
          ))}
        </div>
      ))}
    </div>
  )
}

function SkeletonStats({ count = 4, className, ...props }: { count?: number } & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("grid gap-6 md:grid-cols-2 lg:grid-cols-4", className)} {...props}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="card-modern p-6">
          <div className="flex items-center justify-between">
            <Skeleton variant="text" size="sm" className="w-20" />
            <Skeleton variant="circle" className="w-8 h-8" />
          </div>
          <Skeleton variant="text" size="xl" className="w-16 mt-4" />
          <Skeleton variant="text" size="sm" className="w-24 mt-2" />
        </div>
      ))}
    </div>
  )
}

export { Skeleton, SkeletonCard, SkeletonTable, SkeletonStats }
