// components/layout/mobile-nav.tsx

'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { 
  Menu,
  X,
  LayoutDashboard, 
  Calendar, 
  Users, 
  Utensils, 
  TableIcon,
  BarChart3, 
  Settings,
  Star,
  DollarSign,
  Gift,
  Megaphone,
  HelpCircle,
  LogOut
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { restaurantAuth } from '@/lib/restaurant-auth'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Role } from '@/lib/restaurant-auth'

interface MobileNavProps {
  restaurant: {
    id: string
    name: string
    main_image_url?: string
  }
  role: Role
  permissions: string[]
}

const navigationItems = [
  {
    title: 'Dashboard',
    href: '/dashboard',
    icon: LayoutDashboard,
    permission: null,
  },
  {
    title: 'Bookings',
    href: '/bookings',
    icon: Calendar,
    permission: 'bookings.view',
  },
  {
    title: 'Customers',
    href: '/customers',
    icon: Users,
    permission: 'customers.view',
  },
  {
    title: 'Menu',
    href: '/menu',
    icon: Utensils,
    permission: 'menu.view',
  },
  {
    title: 'Tables',
    href: '/tables',
    icon: TableIcon,
    permission: 'tables.view',
  },
  {
    title: 'Analytics',
    href: '/analytics',
    icon: BarChart3,
    permission: 'analytics.view',
  },
  {
    title: 'Reviews',
    href: '/reviews',
    icon: Star,
    permission: 'reviews.view',
  },
  {
    title: 'Loyalty',
    href: '/loyalty',
    icon: Gift,
    permission: 'loyalty.view',
  },
  {
    title: 'Offers',
    href: '/offers',
    icon: DollarSign,
    permission: 'offers.view',
  },
  {
    title: 'Marketing',
    href: '/marketing',
    icon: Megaphone,
    permission: 'marketing.view',
  },
  {
    title: 'Staff',
    href: '/staff',
    icon: Users,
    permission: 'staff.manage',
  },
  {
    title: 'Settings',
    href: '/settings',
    icon: Settings,
    permission: 'settings.view',
  },
]

const bottomNavigationItems = [
  {
    title: 'Help & Support',
    href: '/help',
    icon: HelpCircle,
    permission: null,
  },
]

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

  const filteredNavItems = navigationItems.filter(item => 
    !item.permission || restaurantAuth.hasPermission(permissions, item.permission, role)
  )

  const filteredBottomItems = bottomNavigationItems.filter(item => 
    !item.permission || restaurantAuth.hasPermission(permissions, item.permission, role)
  )

  return (
    <>
      {/* Mobile Header */}
      <header className="sticky top-0 z-50 w-full border-b bg-background">
        <div className="flex h-16 items-center px-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsOpen(true)}
            className="lg:hidden"
          >
            <Menu className="h-6 w-6" />
            <span className="sr-only">Toggle navigation menu</span>
          </Button>
          
          <div className="ml-4">
            <h1 className="text-lg font-semibold">{restaurant.name}</h1>
          </div>
        </div>
      </header>

      {/* Mobile Navigation Sheet */}
      <Sheet open={isOpen} onOpenChange={setIsOpen}>
        <SheetContent side="left" className="w-[280px] p-0">
          <SheetHeader className="p-4 border-b">
            <SheetTitle className="text-left">
              <div>
                <div className="font-semibold">{restaurant.name}</div>
                <div className="text-sm text-muted-foreground capitalize">{role}</div>
              </div>
            </SheetTitle>
          </SheetHeader>

          <div className="flex flex-col h-[calc(100vh-5rem)]">
            {/* Navigation Items */}
            <nav className="flex-1 overflow-y-auto px-2 py-4">
              <div className="space-y-1">
                {filteredNavItems.map((item) => {
                  const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`)
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setIsOpen(false)}
                      className={cn(
                        "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                        isActive
                          ? "bg-accent text-accent-foreground"
                          : "text-foreground hover:bg-accent/50"
                      )}
                    >
                      <item.icon className="h-5 w-5" />
                      <span>{item.title}</span>
                    </Link>
                  )
                })}
              </div>
            </nav>

            {/* Bottom Items */}
            <div className="border-t p-2 space-y-1">
              {filteredBottomItems.map((item) => {
                const isActive = pathname === item.href
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setIsOpen(false)}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                      isActive
                        ? "bg-accent text-accent-foreground"
                        : "text-foreground hover:bg-accent/50"
                    )}
                  >
                    <item.icon className="h-5 w-5" />
                    <span>{item.title}</span>
                  </Link>
                )
              })}
              
              <Button
                variant="ghost"
                onClick={handleSignOut}
                className="w-full justify-start gap-3"
              >
                <LogOut className="h-5 w-5" />
                <span>Sign Out</span>
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </>
  )
}