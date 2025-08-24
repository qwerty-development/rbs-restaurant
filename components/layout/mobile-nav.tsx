// components/layout/mobile-nav.tsx

'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Menu, X, LogOut } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { restaurantAuth } from '@/lib/restaurant-auth'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Role } from '@/lib/restaurant-auth'
import { NAV_ITEMS, BOTTOM_NAV_ITEMS } from '@/components/layout/nav-config'

interface MobileNavProps {
  restaurant: {
    id: string
    name: string
    main_image_url?: string
  }
  role: Role
  permissions: string[]
}

// Navigation items sourced from centralized config

export function MobileNav({ restaurant, role, permissions }: MobileNavProps) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()
  const [isOpen, setIsOpen] = useState(false)

  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut()
      router.push('/login')
      toast.success('Signed out successfully')
    } catch (error) {
      console.error('Error signing out:', error)
      toast.error('Failed to sign out')
    }
  }

  const filteredNavItems = NAV_ITEMS.filter(item => 
    !item.permission || restaurantAuth.hasPermission(permissions, item.permission, role)
  )

  const filteredBottomItems = BOTTOM_NAV_ITEMS.filter(item => 
    !item.permission || restaurantAuth.hasPermission(permissions, item.permission, role)
  )

  return (
    <>
      {/* Enhanced Mobile Header with modern design */}
      <header className="sticky top-0 z-50 w-full border-b border-border/50 bg-glass-bg/80 backdrop-blur-xl">
        <div className="flex h-14 sm:h-16 items-center px-4 sm:px-5">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsOpen(true)}
            className={cn(
              "md:hidden h-10 w-10 touch-manipulation rounded-xl",
              "hover:bg-accent/20 hover:scale-105 active:scale-95",
              "transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-ring/50 focus:ring-offset-2"
            )}
          >
            <Menu className="h-5 w-5" />
            <span className="sr-only">Toggle navigation menu</span>
          </Button>

          <div className="ml-4 flex-1">
            <h1 className="text-lg sm:text-xl font-bold truncate bg-gradient-to-r from-primary to-primary/90 bg-clip-text text-transparent">
              {restaurant.name}
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground font-medium capitalize">{role}</p>
          </div>
        </div>
      </header>

      {/* Enhanced Mobile Navigation Sheet */}
      <Sheet open={isOpen} onOpenChange={setIsOpen}>
        <SheetContent
          side="left"
          className={cn(
            "w-[280px] sm:w-[300px] p-0 bg-glass-bg/95 backdrop-blur-xl",
            "border-r border-glass-border/50"
          )}
        >
          <SheetHeader className="p-4 border-b border-glass-border/30 bg-white/5">
            <SheetTitle className="text-left">
              <div>
                <div className="font-bold text-lg bg-gradient-to-r from-primary to-primary/90 bg-clip-text text-transparent">
                  {restaurant.name}
                </div>
                <div className="text-sm text-muted-foreground font-medium capitalize">{role}</div>
              </div>
            </SheetTitle>
          </SheetHeader>

          <div className="flex flex-col h-[calc(100vh-4rem)] sm:h-[calc(100vh-5rem)]">
            {/* Navigation Items */}
            <nav className="flex-1 overflow-y-auto px-1.5 sm:px-2 py-3 sm:py-4">
              <div className="space-y-0.5 sm:space-y-1">
                {filteredNavItems.map((item, index) => {
                  const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`)
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setIsOpen(false)}
                      className={cn(
                        "flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 touch-manipulation group",
                        "hover:shadow-lg hover:translate-y-[-2px] active:scale-95",
                        isActive
                          ? "bg-primary/10 text-primary border border-primary/20 shadow-sm"
                          : "text-foreground hover:bg-accent/20 hover:text-accent-foreground"
                      )}
                      style={{
                        animationDelay: `${index * 50}ms`
                      }}
                    >
                      <div className={cn(
                        "p-2 rounded-lg transition-colors duration-200",
                        isActive
                          ? "bg-primary/20 text-primary"
                          : "bg-accent/20 text-accent-foreground group-hover:bg-accent/30"
                      )}>
                        <item.icon className="h-4 w-4" />
                      </div>
                      <span className="font-semibold">{item.title}</span>
                    </Link>
                  )
                })}
              </div>
            </nav>

            {/* Enhanced Bottom Items */}
            <div className="border-t border-glass-border/30 p-3 space-y-2 bg-white/5">
              {filteredBottomItems.map((item, index) => {
                const isActive = pathname === item.href
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setIsOpen(false)}
                                          className={cn(
                        "flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 touch-manipulation group",
                        "hover:shadow-lg hover:translate-y-[-2px] active:scale-95",
                        isActive
                          ? "bg-accent/30 text-accent-foreground border border-accent/30 shadow-sm"
                          : "text-foreground hover:bg-accent/20 hover:text-accent-foreground"
                      )}
                    style={{
                      animationDelay: `${(index + filteredNavItems.length) * 50}ms`
                    }}
                  >
                    <div className="relative">
                      <div className={cn(
                        "p-2 rounded-lg transition-colors duration-200",
                        isActive
                          ? "bg-accent/30 text-accent-foreground"
                          : "bg-accent/20 text-accent-foreground group-hover:bg-accent/30"
                      )}>
                        <item.icon className="h-4 w-4" />
                      </div>
                      {(item as any).badge && (item as any).badge > 0 && (
                        <span className="badge-modern badge-destructive absolute -top-1 -right-1">
                          {(item as any).badge}
                        </span>
                      )}
                    </div>
                    <span className="font-semibold">{item.title}</span>
                  </Link>
                )
              })}

              <Button
                variant="ghost"
                onClick={handleSignOut}
                className={cn(
                  "w-full justify-start gap-3 py-3 h-auto touch-manipulation rounded-xl",
                  "hover:shadow-lg hover:translate-y-[-2px] active:scale-95",
                  "text-destructive hover:bg-destructive/10 hover:text-destructive",
                  "transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-destructive/50 focus:ring-offset-2"
                )}
                style={{
                  animationDelay: `${(filteredBottomItems.length + filteredNavItems.length + 1) * 50}ms`
                }}
              >
                <div className="p-2 rounded-lg bg-destructive/10 text-destructive">
                  <LogOut className="h-4 w-4" />
                </div>
                <span className="font-semibold">Sign Out</span>
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </>
  )
}