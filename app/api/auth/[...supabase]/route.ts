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
  const error_code = requestUrl.searchParams.get('error')
  const error_description = requestUrl.searchParams.get('error_description')

  // Handle OAuth errors (expired/invalid links, etc.)
  if (error_code) {
    console.error('OAuth error:', { error_code, error_description })

    let errorType = 'auth_error'
    if (error_description?.includes('expired')) {
      errorType = 'expired'
    } else if (error_description?.includes('invalid')) {
      errorType = 'invalid'
    }

    if (type === 'signup' || type === 'email_confirm') {
      return NextResponse.redirect(`${requestUrl.origin}/email-confirmation-error?error=${errorType}`)
    }

    return NextResponse.redirect(`${requestUrl.origin}/login?error=${errorType}`)
  }

  // Exchange code for session if code is present
  if (code) {
    const supabase = createRouteHandlerClient<any>({ cookies })

    try {
      const { data, error } = await supabase.auth.exchangeCodeForSession(code)

      if (error) {
        console.error('Error exchanging code for session:', error)

        // Determine error type for better user experience
        let errorType = 'auth_error'
        if (error.message.includes('expired')) {
          errorType = 'expired'
        } else if (error.message.includes('invalid') || error.message.includes('already')) {
          errorType = 'invalid'
        }

        if (type === 'signup' || type === 'email_confirm') {
          return NextResponse.redirect(`${requestUrl.origin}/email-confirmation-error?error=${errorType}`)
        }

        return NextResponse.redirect(`${requestUrl.origin}/login?error=${errorType}`)
      }

      // Success - log for debugging
      console.log('Successfully exchanged code for session:', {
        userId: data.user?.id,
        email: data.user?.email,
        type
      })

    } catch (error) {
      console.error('Unexpected error during code exchange:', error)

      if (type === 'signup' || type === 'email_confirm') {
        return NextResponse.redirect(`${requestUrl.origin}/email-confirmation-error?error=auth_error`)
      }

      return NextResponse.redirect(`${requestUrl.origin}/login?error=auth_error`)
    }
  }

  // Successful redirect based on flow type
  if (type === 'signup' || type === 'email_confirm') {
    return NextResponse.redirect(`${requestUrl.origin}/email-confirmed`)
  }

  // Default: URL to redirect to after sign in process completes
  return NextResponse.redirect(`${requestUrl.origin}/dashboard`)
}