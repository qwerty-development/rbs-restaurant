// app/(auth)/layout.tsx
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { Footer } from "@/components/layout/footer"

export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Middleware handles redirecting authenticated users away from auth pages to avoid loops

  return (
    <div className="min-h-screen flex flex-col relative">
      {/* Background Image with Overlay */}
      <div 
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{
          backgroundImage: "url('/auth-background.jpg')",
        }}
      />
      {/* Mulberry overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-purple-900/40 via-purple-800/30 to-purple-900/40" />
      
      {/* Content */}
      <div className="relative z-10 flex-1 flex items-center justify-center">
        <div className="w-full max-w-lg p-8">
          {children}
        </div>
      </div>
      <div className="relative z-10">
        <Footer variant="auth" />
      </div>
    </div>
  )
}