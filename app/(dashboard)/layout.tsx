// app/(dashboard)/layout.tsx
export const dynamic = 'force-dynamic'

import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { Sidebar } from "@/components/layout/sidebar"
import { MobileNav } from "@/components/layout/mobile-nav"
import { StaffChatProvider } from "@/lib/contexts/staff-chat-context"
import StaffChatToggle from "@/components/chat/chat-toggle"
import StaffChatPanel from "@/components/chat/staff-chat-panel"
import { SidebarProvider } from "@/lib/contexts/sidebar-context"
import { RestaurantProvider } from "@/lib/contexts/restaurant-context"
import { DashboardLayoutInner } from "@/components/layout/dashboard-layout-inner"
import { EnhancedPWAProvider } from "@/components/pwa/enhanced-pwa-provider"

export default async function DashboardLayout({
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

  // Get the current restaurant ID for notifications
  const restaurantId = staffData[0]?.restaurant_id

  return (
    <EnhancedPWAProvider restaurantId={restaurantId}>
      <RestaurantProvider>
        <SidebarProvider>
          <DashboardLayoutInner staffData={staffData}>
            {children}
          </DashboardLayoutInner>
        </SidebarProvider>
      </RestaurantProvider>
    </EnhancedPWAProvider>
  )
}