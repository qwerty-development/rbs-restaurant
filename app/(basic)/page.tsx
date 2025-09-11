// app/(basic)/page.tsx
import { redirect } from "next/navigation"

export const dynamic = 'force-dynamic'

export default function BasicRedirectPage() {
  // Server-side redirect - more reliable for Vercel
  redirect('/basic-dashboard')
}
