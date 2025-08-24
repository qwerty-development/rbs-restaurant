"use client"

import * as React from "react"
import * as AvatarPrimitive from "@radix-ui/react-avatar"
import { cva, type VariantProps } from "class-variance-authority"
import { User, Crown, Star, Shield, Check } from "lucide-react"

import { cn } from "@/lib/utils"

const avatarVariants = cva(
  "relative flex shrink-0 overflow-hidden rounded-full ring-2 ring-transparent transition-all duration-200",
  {
    variants: {
      variant: {
        default: "ring-transparent hover:ring-primary/20",
        bordered: "ring-border hover:ring-primary/30",
        gradient: "ring-transparent bg-gradient-to-br from-primary/20 to-accent/20 hover:from-primary/30 hover:to-accent/30",
        glass: "ring-white/20 bg-white/10 backdrop-blur-sm",
      },
      size: {
        xs: "size-6",
        sm: "size-8",
        md: "size-10",
        lg: "size-12",
        xl: "size-16",
        "2xl": "size-20",
        "3xl": "size-24",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "md",
    },
  }
)

export interface AvatarProps
  extends React.ComponentProps<typeof AvatarPrimitive.Root>,
    VariantProps<typeof avatarVariants> {
  status?: "online" | "offline" | "away" | "busy" | "none"
  badge?: React.ComponentType<{ className?: string }>
  showBadge?: boolean
}

function Avatar({
  className,
  variant = "default",
  size = "md",
  status = "none",
  badge: BadgeIcon,
  showBadge = false,
  ...props
}: AvatarProps) {
  return (
    <div className="relative inline-block">
      <AvatarPrimitive.Root
        data-slot="avatar"
        className={cn(avatarVariants({ variant, size }), className)}
        {...props}
      />

      {/* Status indicator */}
      {status !== "none" && (
        <div
          className={cn(
            "absolute bottom-0 right-0 size-3 rounded-full border-2 border-background",
            status === "online" && "bg-green-500",
            status === "offline" && "bg-gray-400",
            status === "away" && "bg-yellow-500",
            status === "busy" && "bg-red-500"
          )}
        />
      )}

      {/* Custom badge */}
      {showBadge && BadgeIcon && (
        <div className="absolute -top-1 -right-1 size-5 rounded-full bg-primary flex items-center justify-center border-2 border-background">
          <BadgeIcon className="size-3 text-primary-foreground" />
        </div>
      )}
    </div>
  )
}

function AvatarImage({
  className,
  ...props
}: React.ComponentProps<typeof AvatarPrimitive.Image>) {
  return (
    <AvatarPrimitive.Image
      data-slot="avatar-image"
      className={cn("aspect-square size-full object-cover", className)}
      {...props}
    />
  )
}

function AvatarFallback({
  className,
  children,
  ...props
}: React.ComponentProps<typeof AvatarPrimitive.Fallback>) {
  return (
    <AvatarPrimitive.Fallback
      data-slot="avatar-fallback"
      className={cn(
        "bg-gradient-to-br from-muted to-muted/80 flex size-full items-center justify-center rounded-full font-medium text-muted-foreground",
        className
      )}
      {...props}
    >
      {children}
    </AvatarPrimitive.Fallback>
  )
}

// Enhanced Avatar components for specific use cases
function UserAvatar({
  name,
  image,
  size = "md",
  status = "none",
  className,
  ...props
}: {
  name: string
  image?: string
  size?: VariantProps<typeof avatarVariants>["size"]
  status?: AvatarProps["status"]
} & React.ComponentProps<typeof Avatar>) {
  const initials = name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)

  return (
    <Avatar size={size} status={status} className={className} {...props}>
      {image && <AvatarImage src={image} alt={name} />}
      <AvatarFallback>{initials}</AvatarFallback>
    </Avatar>
  )
}

function StaffAvatar({
  name,
  image,
  role,
  size = "md",
  className,
  ...props
}: {
  name: string
  image?: string
  role?: "manager" | "chef" | "server" | "admin"
  size?: VariantProps<typeof avatarVariants>["size"]
} & React.ComponentProps<typeof Avatar>) {
  const roleIcons = {
    manager: Crown,
    chef: Star,
    server: User,
    admin: Shield,
  }

  const BadgeIcon = role ? roleIcons[role] : undefined

  return (
    <UserAvatar
      name={name}
      image={image}
      size={size}
      badge={BadgeIcon}
      showBadge={!!role}
      className={className}
      {...props}
    />
  )
}

function VerifiedAvatar({
  name,
  image,
  verified = false,
  size = "md",
  className,
  ...props
}: {
  name: string
  image?: string
  verified?: boolean
  size?: VariantProps<typeof avatarVariants>["size"]
} & React.ComponentProps<typeof Avatar>) {
  return (
    <UserAvatar
      name={name}
      image={image}
      size={size}
      badge={verified ? Check : undefined}
      showBadge={verified}
      className={className}
      {...props}
    />
  )
}

// Avatar Group component for showing multiple avatars
function AvatarGroup({
  avatars,
  max = 4,
  size = "md",
  className,
  ...props
}: {
  avatars: Array<{ name: string; image?: string; status?: AvatarProps["status"] }>
  max?: number
  size?: VariantProps<typeof avatarVariants>["size"]
} & React.HTMLAttributes<HTMLDivElement>) {
  const visibleAvatars = avatars.slice(0, max)
  const remainingCount = Math.max(0, avatars.length - max)

  return (
    <div className={cn("flex -space-x-2", className)} {...props}>
      {visibleAvatars.map((avatar, index) => (
        <UserAvatar
          key={index}
          name={avatar.name}
          image={avatar.image}
          status={avatar.status}
          size={size}
          className="ring-2 ring-background"
        />
      ))}

      {remainingCount > 0 && (
        <div
          className={cn(
            "flex items-center justify-center rounded-full bg-muted ring-2 ring-background text-xs font-medium text-muted-foreground",
            size === "xs" && "size-6",
            size === "sm" && "size-8",
            size === "md" && "size-10",
            size === "lg" && "size-12",
            size === "xl" && "size-16",
            size === "2xl" && "size-20",
            size === "3xl" && "size-24"
          )}
        >
          +{remainingCount}
        </div>
      )}
    </div>
  )
}

export {
  Avatar,
  AvatarImage,
  AvatarFallback,
  UserAvatar,
  StaffAvatar,
  VerifiedAvatar,
  AvatarGroup,
  avatarVariants
}
