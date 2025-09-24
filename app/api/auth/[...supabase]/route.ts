// app/api/auth/[...supabase]/route.ts
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const type = requestUrl.searchParams.get('type')

  // If we have a code, try to exchange it for a session
  if (code) {
    const supabase = createRouteHandlerClient<any>({ cookies })

    try {
      const { data, error } = await supabase.auth.exchangeCodeForSession(code)

      if (error) {
        console.error('Error exchanging code for session:', error)

        // Only redirect to error page for signup/confirmation flows
        if (type === 'signup' || type === 'email_confirm') {
          return NextResponse.redirect(`${requestUrl.origin}/email-confirmation-error?error=auth_error`)
        }

        // For other flows, redirect to login with error
        return NextResponse.redirect(`${requestUrl.origin}/login?error=auth_error`)
      }

      // Log successful authentication
      console.log('Successfully authenticated user:', {
        userId: data.user?.id,
        email: data.user?.email,
        type: type || 'login'
      })

    } catch (error) {
      console.error('Unexpected error during authentication:', error)

      // Handle unexpected errors
      if (type === 'signup' || type === 'email_confirm') {
        return NextResponse.redirect(`${requestUrl.origin}/email-confirmation-error?error=auth_error`)
      }

      return NextResponse.redirect(`${requestUrl.origin}/login?error=auth_error`)
    }
  }

  // Redirect based on flow type
  if (type === 'signup' || type === 'email_confirm') {
    return NextResponse.redirect(`${requestUrl.origin}/email-confirmed`)
  }

  // Default: redirect to dashboard after successful authentication
  return NextResponse.redirect(`${requestUrl.origin}/dashboard`)
}