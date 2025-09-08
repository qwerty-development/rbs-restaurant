// app/(basic)/layout.tsx
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { Sidebar } from "@/components/layout/sidebar"
import { MobileNav } from "@/components/layout/mobile-nav"
import { SidebarProvider } from "@/lib/contexts/sidebar-context"
import { RestaurantProvider } from "@/lib/contexts/restaurant-context"
import { DashboardLayoutInner } from "@/components/layout/dashboard-layout-inner"

export default async function BasicLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect("/login")
  }

  // Get all restaurants where user is staff
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

  // Handle both array and object formats from Supabase
  const firstStaff = staffData[0]
  const restaurant = Array.isArray(firstStaff.restaurant) 
    ? firstStaff.restaurant[0] 
    : firstStaff.restaurant

  // Verify this is a Basic tier restaurant
  if (restaurant?.tier !== 'basic') {
    redirect("/dashboard")
  }

  return (
    <RestaurantProvider>
      <SidebarProvider>
        <DashboardLayoutInner staffData={staffData}>
          {children}
        </DashboardLayoutInner>
      </SidebarProvider>
    </RestaurantProvider>
  )
}
