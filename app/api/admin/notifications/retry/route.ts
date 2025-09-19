import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

interface RetryRequest {
  notification_ids: string[]
}

export async function POST(request: NextRequest) {
  try {
    const body: RetryRequest = await request.json()
    
    if (!body.notification_ids || body.notification_ids.length === 0) {
      return NextResponse.json({ error: 'Notification IDs are required' }, { status: 400 })
    }

    // Admin authentication check
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: admin } = await supabase
      .from('rbs_admins')
      .select('id')
      .eq('user_id', user.id)
      .single()
    
    if (!admin) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    // Use database function to retry notifications
    const { data: result, error } = await supabase
      .rpc('admin_retry_notifications', {
        p_notification_ids: body.notification_ids
      })

    if (error) {
      console.error('Database function error:', error)
      throw error
    }

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }

    return NextResponse.json({ 
      success: true, 
      queued_for_retry: result.queued_for_retry
    })

  } catch (error) {
    console.error('Retry notification error:', error)
    return NextResponse.json({ 
      error: 'Failed to retry notifications' 
    }, { status: 500 })
  }
}