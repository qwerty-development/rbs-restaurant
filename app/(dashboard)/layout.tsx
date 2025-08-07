// app/(dashboard)/layout.tsx
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { Sidebar } from "@/components/layout/sidebar"
import { MobileNav } from "@/components/layout/mobile-nav"
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
        {/* Sidebar Container - Always positioned, smooth transitions */}
        <div className="hidden md:block fixed inset-y-0 left-0 z-30">
          <Sidebar 
            restaurant={staffData.restaurant}
            role={staffData.role}
            permissions={staffData.permissions}
          />
        </div>

        {/* Mobile Navigation - Show on small tablets and phones */}
        <div className="md:hidden">
          <MobileNav 
            restaurant={staffData.restaurant}
            role={staffData.role}
            permissions={staffData.permissions}
          />
        </div>

        {/* Main Content - Full height optimization without header */}
        <div className="transition-all duration-200 ease-out md:ml-16">
          <main className="min-h-screen">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  )
}