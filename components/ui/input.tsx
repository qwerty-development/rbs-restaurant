// components/ui/input.tsx
import * as React from "react"
import { cn } from "@/lib/utils"
import { Search, Eye, EyeOff, X } from "lucide-react"

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  variant?: "default" | "search" | "modern" | "minimal"
  error?: boolean
  icon?: React.ComponentType<{ className?: string }>
  clearable?: boolean
  onClear?: () => void
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({
    className,
    type,
    variant = "default",
    error = false,
    icon: Icon,
    clearable = false,
    onClear,
    ...props
  }, ref) => {
    const [showPassword, setShowPassword] = React.useState(false)
    const [inputValue, setInputValue] = React.useState("")

    const inputType = type === "password" && showPassword ? "text" : type

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      setInputValue(e.target.value)
      props.onChange?.(e)
    }

    const handleClear = () => {
      setInputValue("")
      onClear?.()
    }

    const baseClasses = "flex h-10 w-full rounded-lg border bg-background px-3 py-2 text-sm transition-all duration-200 file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"

    const variantClasses = {
      default: "border-input focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 hover:border-primary/30 focus-visible:border-primary",
      search: "border-input pl-10 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 hover:border-primary/30 focus-visible:border-primary",
      modern: "border-border/50 bg-card/50 backdrop-blur-sm shadow-sm hover:shadow-md focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:ring-offset-2 hover:border-primary/50 focus-visible:border-primary",
      minimal: "border-transparent bg-transparent hover:bg-accent/20 focus-visible:bg-accent/20 focus-visible:border-primary/50"
    }

    const errorClasses = error ? "border-destructive focus-visible:ring-destructive/20" : ""

    return (
      <div className="relative">
        {variant === "search" && (
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        )}

        {Icon && variant !== "search" && (
          <Icon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        )}

        <input
          type={inputType}
          className={cn(
            baseClasses,
            variantClasses[variant],
            errorClasses,
            (variant === "search" || Icon) && "pl-10",
            type === "password" && "pr-20",
            clearable && inputValue && "pr-10",
            className
          )}
          ref={ref}
          value={inputValue}
          onChange={handleInputChange}
          {...props}
        />

        {/* Password toggle */}
        {type === "password" && (
          <button
            type="button"
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
            onClick={() => setShowPassword(!showPassword)}
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        )}

        {/* Clear button */}
        {clearable && inputValue && (
          <button
            type="button"
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
            onClick={handleClear}
          >
            <X className="h-4 w-4" />
          </button>
        )}

        {/* Error message */}
        {error && props.title && (
          <p className="mt-1 text-xs text-destructive">{props.title}</p>
        )}
      </div>
    )
  }
)
Input.displayName = "Input"

// Enhanced Input variants
interface InputGroupProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode
}

const InputGroup = React.forwardRef<HTMLDivElement, InputGroupProps>(
  ({ className, children, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("flex items-center rounded-lg border border-border bg-background focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20", className)}
      {...props}
    >
      {children}
    </div>
  )
)
InputGroup.displayName = "InputGroup"

interface InputAddonProps extends React.HTMLAttributes<HTMLDivElement> {
  position?: "left" | "right"
}

const InputAddon = React.forwardRef<HTMLDivElement, InputAddonProps>(
  ({ className, position = "left", children, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "flex items-center px-3 text-muted-foreground",
        position === "left" ? "border-r border-border" : "border-l border-border",
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
)
InputAddon.displayName = "InputAddon"

export { Input, InputGroup, InputAddon }