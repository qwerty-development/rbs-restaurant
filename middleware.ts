
// middleware.ts
import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function middleware(req: NextRequest) {
  const res = NextResponse.next()
  const supabase = createMiddlewareClient({ req, res })
  
  const {
    data: { session },
  } = await supabase.auth.getSession()

  // Protect dashboard routes
  if (req.nextUrl.pathname.startsWith('/dashboard')) {
    if (!session) {
      return NextResponse.redirect(new URL('/login', req.url))
    }

    // Check if user has restaurant access
    const { data: staffData, error } = await supabase
      .from('restaurant_staff')
      .select('id, role, is_active, restaurant_id')
      .eq('user_id', session.user.id)
      .eq('is_active', true)
      .single()

    if (error || !staffData) {
      // User doesn't have restaurant access
      await supabase.auth.signOut()
      return NextResponse.redirect(new URL('/login?error=no_access', req.url))
    }
  }

  // Redirect authenticated users away from auth pages
  if ((req.nextUrl.pathname === '/login' || req.nextUrl.pathname === '/register') && session) {
    return NextResponse.redirect(new URL('/dashboard', req.url))
  }

  return res
}

export const config = {
  matcher: ['/dashboard/:path*', '/login', '/register']
}
