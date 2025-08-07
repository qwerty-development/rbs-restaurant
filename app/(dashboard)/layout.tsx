// app/(dashboard)/layout.tsx
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { Sidebar } from "@/components/layout/sidebar"
import { Header } from "@/components/layout/header"
import { MobileNav } from "@/components/layout/mobile-nav"

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
    <div className="min-h-screen bg-background">
      {/* Desktop Sidebar */}
      <div className="hidden lg:fixed lg:inset-y-0 lg:flex lg:w-64 lg:flex-col">
        <Sidebar 
          restaurant={staffData.restaurant}
          role={staffData.role}
          permissions={staffData.permissions}
        />
      </div>

      {/* Mobile Navigation */}
      <div className="lg:hidden">
        <MobileNav 
          restaurant={staffData.restaurant}
          role={staffData.role}
          permissions={staffData.permissions}
        />
      </div>

      {/* Main Content */}
      <div className="lg:pl-64">
        <Header 
          restaurant={staffData.restaurant}
          user={user}
          role={staffData.role}
        />
        <main className="py-6">
          <div className="px-4 sm:px-6 lg:px-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}