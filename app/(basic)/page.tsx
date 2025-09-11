// app/(basic)/page.tsx
"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

export default function BasicRedirectPage() {
  const router = useRouter()
  
  useEffect(() => {
    router.replace('/basic-dashboard')
  }, [router])

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="animate-spin rounded-full h-16 w-16 border-4 border-border" />
    </div>
  )
}
