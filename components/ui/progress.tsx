"use client"

import * as React from "react"
import * as ProgressPrimitive from "@radix-ui/react-progress"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const progressVariants = cva(
  "relative overflow-hidden rounded-full transition-all duration-300",
  {
    variants: {
      variant: {
        default: "bg-primary/20",
        secondary: "bg-secondary/30",
        success: "bg-green-100",
        warning: "bg-yellow-100",
        destructive: "bg-red-100",
        modern: "bg-gradient-to-r from-primary/10 to-primary/20 backdrop-blur-sm border border-primary/10",
      },
      size: {
        sm: "h-1",
        md: "h-2",
        lg: "h-3",
        xl: "h-4",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "md",
    },
  }
)

const indicatorVariants = cva(
  "h-full w-full flex-1 transition-all duration-500 ease-out",
  {
    variants: {
      variant: {
        default: "bg-gradient-to-r from-primary to-primary/90",
        secondary: "bg-gradient-to-r from-secondary to-secondary/90",
        success: "bg-gradient-to-r from-green-500 to-green-600",
        warning: "bg-gradient-to-r from-yellow-500 to-yellow-600",
        destructive: "bg-gradient-to-r from-red-500 to-red-600",
        modern: "bg-gradient-to-r from-primary via-primary/80 to-primary/90 shadow-sm",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface ProgressProps
  extends React.ComponentProps<typeof ProgressPrimitive.Root>,
    VariantProps<typeof progressVariants>,
    VariantProps<typeof indicatorVariants> {
  showLabel?: boolean
  label?: string
  showPercentage?: boolean
  animate?: boolean
  striped?: boolean
}

function Progress({
  className,
  variant,
  size,
  value = 0,
  showLabel = false,
  label,
  showPercentage = false,
  animate = false,
  striped = false,
  ...props
}: ProgressProps) {
  const displayValue = Math.min(100, Math.max(0, value || 0))
  const percentage = Math.round(displayValue)

  return (
    <div className="space-y-2">
      {(showLabel || showPercentage) && (
        <div className="flex justify-between items-center">
          {label && <span className="text-sm font-medium text-foreground">{label}</span>}
          {showPercentage && (
            <span className="text-sm font-medium text-muted-foreground">{percentage}%</span>
          )}
        </div>
      )}

      <ProgressPrimitive.Root
        data-slot="progress"
        className={cn(
          progressVariants({ variant, size }),
          animate && "animate-pulse",
          className
        )}
        {...props}
      >
        <ProgressPrimitive.Indicator
          data-slot="progress-indicator"
          className={cn(
            indicatorVariants({ variant }),
            striped && "bg-gradient-to-r from-transparent via-current to-transparent bg-[length:20px_100%] animate-pulse",
            "relative overflow-hidden"
          )}
          style={{ transform: `translateX(-${100 - displayValue}%)` }}
        >
          {striped && (
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-pulse" />
          )}
        </ProgressPrimitive.Indicator>
      </ProgressPrimitive.Root>
    </div>
  )
}

// Enhanced Progress variants for common use cases
function CircularProgress({
  value = 0,
  size = 40,
  strokeWidth = 4,
  className,
  showPercentage = false,
  label,
  ...props
}: {
  value?: number
  size?: number
  strokeWidth?: number
  showPercentage?: boolean
  label?: string
} & React.HTMLAttributes<HTMLDivElement>) {
  const radius = (size - strokeWidth) / 2
  const circumference = radius * 2 * Math.PI
  const strokeDasharray = circumference
  const strokeDashoffset = circumference - (value / 100) * circumference

  return (
    <div className={cn("relative", className)} style={{ width: size, height: size }}>
      <svg
        className="transform -rotate-90"
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-muted-foreground/20"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          strokeDasharray={strokeDasharray}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          className="text-primary transition-all duration-500"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        {showPercentage && (
          <span className="text-xs font-medium">{Math.round(value)}%</span>
        )}
        {label && (
          <span className="text-xs font-medium">{label}</span>
        )}
      </div>
    </div>
  )
}

function ProgressWithSteps({
  steps,
  currentStep,
  className,
  ...props
}: {
  steps: string[]
  currentStep: number
} & React.HTMLAttributes<HTMLDivElement>) {
  const progress = (currentStep / (steps.length - 1)) * 100

  return (
    <div className={cn("space-y-4", className)} {...props}>
      <div className="flex justify-between">
        {steps.map((step, index) => (
          <div
            key={index}
            className={cn(
              "flex flex-col items-center space-y-2",
              index <= currentStep ? "text-primary" : "text-muted-foreground"
            )}
          >
            <div
              className={cn(
                "w-8 h-8 rounded-full border-2 flex items-center justify-center text-xs font-medium transition-colors",
                index <= currentStep
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-muted-foreground"
              )}
            >
              {index + 1}
            </div>
            <span className="text-xs font-medium">{step}</span>
          </div>
        ))}
      </div>

      <Progress value={progress} size="sm" />
    </div>
  )
}

export { Progress, CircularProgress, ProgressWithSteps }
