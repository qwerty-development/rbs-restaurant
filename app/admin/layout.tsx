'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import {
  LogOut,
  Settings,
  Users,
  Building,
  BarChart3,
  Shield,
  Menu,
  X,
  UserCheck,
  Calendar,
  Clock,
  Star,
  Database,
  TrendingUp,
  FileText,
  Bell,
  CreditCard,
  ChefHat
} from 'lucide-react'
import { toast } from 'react-hot-toast'

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const [isAuthorized, setIsAuthorized] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [userEmail, setUserEmail] = useState<string>('')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const router = useRouter()
  const supabase = createClient()
  const pathname = usePathname()

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const { data: { user }, error: userError } = await supabase.auth.getUser()

        if (userError || !user) {
          router.push('/login?redirectTo=/admin')
          return
        }

        setUserEmail(user.email || '')

        // Check if user is an admin
        const { data: adminData, error: adminError } = await supabase
          .from('rbs_admins')
          .select('id, user_id')
          .eq('user_id', user.id)
          .single()

        if (adminError || !adminData) {
          router.push('/login?error=admin_access_required')
          return
        }

        setIsAuthorized(true)
      } catch (error) {
        console.error('Auth check error:', error)
        router.push('/login?error=admin_access_required')
      } finally {
        setIsLoading(false)
      }
    }

    checkAuth()
  }, [router, supabase])

  const handleSignOut = async () => {
    try {
      const { error } = await supabase.auth.signOut()
      if (error) throw error
      
      toast.success('Signed out successfully')
      router.push('/login')
    } catch (error) {
      console.error('Sign out error:', error)
      toast.error('Failed to sign out')
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <Card className="p-8">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Checking admin access...</p>
          </div>
        </Card>
      </div>
    )
  }

  if (!isAuthorized) {
    return null // Will redirect in useEffect
  }

  const navigationItems = [
    { 
      section: 'Overview',
      items: [
        { name: 'Dashboard', href: '/admin', icon: BarChart3, current: false },
        
      ]
    },
    {
      section: 'Management',
      items: [
        { name: 'Restaurants', href: '/admin/restaurants', icon: Building, current: false },
        { name: 'Users', href: '/admin/users', icon: Users, current: false },
        { name: 'Restaurant Staff', href: '/admin/restaurants/staff', icon: UserCheck, current: false },
        { name: 'Menu Management', href: '/admin/menu', icon: ChefHat, current: false },
        { name: 'Banners', href: '/admin/banners', icon: CreditCard, current: false },
      ]
    },
    {
      section: 'Operations',
      items: [
        { name: 'Bookings', href: '/admin/bookings', icon: Calendar, current: false },
        { name: 'Availability', href: '/admin/availability', icon: Clock, current: false },
        { name: 'Reviews', href: '/admin/reviews', icon: Star, current: false },
        { name: 'Notifications', href: '/admin/notifications', icon: Bell, current: false },
      ]
    },
    {
      section: 'System',
      items: [
        { name: 'Reports', href: '/admin/reports', icon: FileText, current: false },
      ]
    }
  ]

  // Determine the most specific (longest) matching nav item for current path
  const allItems = navigationItems.flatMap(section => section.items)
  const matchedItems = allItems.filter(item => {
    if (item.href === '/admin') return pathname === '/admin'
    return pathname === item.href || pathname.startsWith(item.href + '/')
  })
  const activeHref = matchedItems.reduce<string | null>((best, item) => {
    if (!best) return item.href
    return item.href.length > best.length ? item.href : best
  }, null) || null

  const navigationWithActive = navigationItems.map(section => ({
    ...section,
    items: section.items.map(item => ({
      ...item,
      current: item.href === activeHref
    }))
  }))

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Mobile sidebar */}
      <div className={`fixed inset-0 z-50 lg:hidden ${sidebarOpen ? 'block' : 'hidden'}`}>
        <div className="fixed inset-0 bg-gray-600 bg-opacity-75" onClick={() => setSidebarOpen(false)} />
        <div className="fixed inset-y-0 left-0 flex w-64 flex-col bg-white">
          <div className="flex h-16 items-center justify-between px-4 border-b">
            <div className="flex items-center">
              <Shield className="h-8 w-8 text-blue-600" />
              <h1 className="ml-2 text-xl font-bold text-gray-900">RBS Admin</h1>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSidebarOpen(false)}
            >
              <X className="h-5 w-5" />
            </Button>
          </div>
          <nav className="flex-1 px-4 py-4 space-y-4">
            {navigationWithActive.map((section) => (
              <div key={section.section} className="space-y-2">
                <h3 className="px-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  {section.section}
                </h3>
                <div className="space-y-1">
                  {section.items.map((item) => (
                    <Link
                      key={item.name}
                      href={item.href}
                      className={`flex items-center px-3 py-2 rounded-lg text-sm font-medium transition-colors touch-manipulation ${
                        item.current
                          ? 'bg-blue-100 text-blue-700'
                          : 'text-gray-700 hover:bg-gray-100'
                      }`}
                      style={{ minHeight: '44px' }}
                    >
                      <item.icon className="mr-3 h-5 w-5 flex-shrink-0" />
                      {item.name}
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </nav>
          <div className="border-t p-4">
            <div className="flex items-center mb-3">
              <div className="h-8 w-8 rounded-full bg-blue-600 flex items-center justify-center">
                <span className="text-white text-sm font-medium">
                  {userEmail.charAt(0).toUpperCase()}
                </span>
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-700">Admin User</p>
                <p className="text-xs text-gray-500">{userEmail}</p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleSignOut}
              className="w-full"
            >
              <LogOut className="mr-2 h-4 w-4" />
              Sign Out
            </Button>
          </div>
        </div>
      </div>

      {/* Desktop sidebar */}
      <div className="hidden lg:fixed lg:inset-y-0 lg:flex lg:w-64 lg:flex-col">
        <div className="flex flex-col flex-grow bg-white border-r shadow-sm">
          <div className="flex h-16 items-center px-6 border-b">
            <Shield className="h-8 w-8 text-blue-600" />
            <h1 className="ml-3 text-xl font-bold text-gray-900">RBS Admin</h1>
          </div>
          
          <nav className="flex-1 px-4 py-6 space-y-6">
            {navigationWithActive.map((section) => (
              <div key={section.section} className="space-y-3">
                <h3 className="px-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  {section.section}
                </h3>
                <div className="space-y-1">
                  {section.items.map((item) => (
                    <Link
                      key={item.name}
                      href={item.href}
                      className={`flex items-center px-3 py-2 rounded-lg text-sm font-medium transition-colors touch-manipulation ${
                        item.current
                          ? 'bg-blue-100 text-blue-700'
                          : 'text-gray-700 hover:bg-gray-100'
                      }`}
                      style={{ minHeight: '44px' }}
                    >
                      <item.icon className="mr-3 h-5 w-5 flex-shrink-0" />
                      {item.name}
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </nav>

          <div className="border-t p-4">
            <div className="flex items-center mb-4">
              <div className="h-10 w-10 rounded-full bg-blue-600 flex items-center justify-center">
                <span className="text-white font-medium">
                  {userEmail.charAt(0).toUpperCase()}
                </span>
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-700">Admin User</p>
                <p className="text-xs text-gray-500">{userEmail}</p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleSignOut}
              className="w-full"
            >
              <LogOut className="mr-2 h-4 w-4" />
              Sign Out
            </Button>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="lg:pl-64">
        {/* Top bar for mobile */}
        <div className="lg:hidden bg-white border-b px-4 py-3">
          <div className="flex items-center justify-between">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu className="h-6 w-6" />
            </Button>
            <div className="flex items-center">
              <Shield className="h-6 w-6 text-blue-600" />
              <h1 className="ml-2 text-lg font-semibold text-gray-900">RBS Admin</h1>
            </div>
            <div></div>
          </div>
        </div>

        {/* Main content area */}
        <main className="min-h-screen">
          <div className="py-8">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              {children}
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
