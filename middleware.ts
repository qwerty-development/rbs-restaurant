import { NextResponse, type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

export async function middleware(request: NextRequest) {
  // update session and get supabase client
  const { response, supabase } = await updateSession(request)

  const { data: { session } } = await supabase.auth.getSession()

  // Protect dashboard routes
  if (request.nextUrl.pathname.startsWith('/dashboard')) {
    if (!session) {
      const redirectUrl = request.nextUrl.clone()
      redirectUrl.pathname = '/login'
      redirectUrl.searchParams.set('redirectTo', request.nextUrl.pathname)
      return NextResponse.redirect(redirectUrl)
    }

    // Check if user has access to any restaurant
    const { data: staffData } = await supabase
      .from('restaurant_staff')
      .select('id, role, is_active, restaurant_id')
      .eq('user_id', session.user.id)
      .eq('is_active', true)

    if (!staffData || staffData.length === 0) {
      const redirectUrl = request.nextUrl.clone()
      redirectUrl.pathname = '/login'
      redirectUrl.searchParams.set('error', 'no_access')
      return NextResponse.redirect(redirectUrl)
    }

    // Handle restaurant-specific route validation
    const restaurantId = request.nextUrl.searchParams.get('restaurant')
    if (restaurantId) {
      // Verify user has access to this specific restaurant
      const hasAccess = staffData.some(staff => staff.restaurant_id === restaurantId)
      if (!hasAccess) {
        const redirectUrl = request.nextUrl.clone()
        redirectUrl.pathname = '/dashboard/overview'
        redirectUrl.search = ''
        return NextResponse.redirect(redirectUrl)
      }
    }

    // If accessing /dashboard root with single restaurant, redirect with restaurant param
    if (request.nextUrl.pathname === '/dashboard' && staffData.length === 1 && !restaurantId) {
      const redirectUrl = request.nextUrl.clone()
      redirectUrl.searchParams.set('restaurant', staffData[0].restaurant_id)
      return NextResponse.redirect(redirectUrl)
    }

    // If accessing /dashboard root with multiple restaurants and no param, redirect to overview
    if (request.nextUrl.pathname === '/dashboard' && staffData.length > 1 && !restaurantId) {
      const redirectUrl = request.nextUrl.clone()
      redirectUrl.pathname = '/dashboard/overview'
      return NextResponse.redirect(redirectUrl)
    }
  }

  // Redirect authenticated users away from auth pages
  if ((request.nextUrl.pathname === '/login' || request.nextUrl.pathname === '/register') && session) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
