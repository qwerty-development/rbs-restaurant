// app/basic-dashboard/layout.tsx
export const dynamic = 'force-dynamic'

import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"

export default async function BasicDashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect("/login")
  }

  // Get restaurant staff data
  const { data: staffData } = await supabase
    .from("restaurant_staff")
    .select(`
      id,
      role,
      permissions,
      restaurant_id,
      restaurant:restaurants(*)
    `)
    .eq("user_id", user.id)
    .eq("is_active", true)

  if (!staffData || staffData.length === 0) {
    redirect("/login")
  }

  // Get the restaurant data
  const firstStaff = staffData[0]
  const restaurant = Array.isArray(firstStaff.restaurant) 
    ? firstStaff.restaurant[0] 
    : firstStaff.restaurant

  // Verify this is a Basic tier restaurant
  if (restaurant?.tier !== 'basic') {
    redirect("/dashboard")
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Simple header for basic tier */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-semibold text-gray-900">
                {restaurant?.name}
              </h1>
              <p className="text-sm text-gray-500">Basic Plan</p>
            </div>
            <nav className="flex items-center space-x-6">
              <a 
                href="/basic-dashboard" 
                className="text-gray-700 hover:text-gray-900 font-medium"
              >
                Dashboard
              </a>
              <a 
                href="/menu" 
                className="text-gray-700 hover:text-gray-900"
              >
                Menu
              </a>
              <a 
                href="/reviews" 
                className="text-gray-700 hover:text-gray-900"
              >
                Reviews
              </a>
              <a 
                href="/profile" 
                className="text-gray-700 hover:text-gray-900"
              >
                Profile
              </a>
              <a 
                href="/settings" 
                className="text-gray-700 hover:text-gray-900"
              >
                Settings
              </a>
            </nav>
          </div>
        </div>
      </header>
      
      {/* Main content */}
      <main>
        {children}
      </main>
    </div>
  )
}