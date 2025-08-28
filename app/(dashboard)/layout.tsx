// app/(dashboard)/layout.tsx
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { Sidebar } from "@/components/layout/sidebar"
import { MobileNav } from "@/components/layout/mobile-nav"
import { StaffChatProvider } from "@/lib/contexts/staff-chat-context"
import StaffChatToggle from "@/components/chat/chat-toggle"
import StaffChatPanel from "@/components/chat/staff-chat-panel"
import { SidebarProvider } from "@/lib/contexts/sidebar-context"

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

  // Get restaurant and staff info
  const { data: staffData }:any = await supabase
    .from("restaurant_staff")
    .select(`
      id,
      role,
      permissions,
      restaurant:restaurants(*)
    `)
    .eq("user_id", user.id)
    .eq("is_active", true)
    .single()

  if (!staffData) {
    redirect("/login")
  }

  return (
    <SidebarProvider>
      <div className="min-h-screen bg-background relative">
        {/* Sidebar Container - Show on tablets and up */}
        <div className="hidden sm:block fixed inset-y-0 left-0 z-30">
          <Sidebar 
            restaurant={staffData.restaurant}
            role={staffData.role}
            permissions={staffData.permissions}
          />
        </div>

        {/* Mobile Navigation - Show on phones only */}
        <div className="sm:hidden">
          <MobileNav 
            restaurant={staffData.restaurant}
            role={staffData.role}
            permissions={staffData.permissions}
          />
        </div>

        {/* Main Content - Full height optimization without header */}
        <div className="transition-all duration-200 ease-out sm:ml-16">
          <StaffChatProvider restaurantId={staffData.restaurant.id}>
            <main className="min-h-screen">
              {children}
            </main>
            <StaffChatToggle />
            <StaffChatPanel />
          </StaffChatProvider>
        </div>
      </div>
    </SidebarProvider>
  )
}