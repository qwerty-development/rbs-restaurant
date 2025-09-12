
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

  // For multi-tenant users, find a basic tier restaurant
  let basicRestaurantStaffData = null
  for (const staff of staffData) {
    const restaurant = Array.isArray(staff.restaurant) 
      ? staff.restaurant[0] 
      : staff.restaurant
    
    if (restaurant?.tier === 'basic') {
      basicRestaurantStaffData = [staff]
      break
    }
  }

  // If no basic tier restaurant found, redirect to main dashboard
  if (!basicRestaurantStaffData) {
    redirect("/dashboard")
  }

  return (
    <RestaurantProvider>
      <SidebarProvider>
        <DashboardLayoutInner staffData={basicRestaurantStaffData}>
          {children}
        </DashboardLayoutInner>
      </SidebarProvider>
    </RestaurantProvider>
  )
}