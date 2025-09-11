// app/api/switch-tier/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const { tier } = await request.json()
    
    if (!tier || !['basic', 'pro'].includes(tier)) {
      return NextResponse.json({ error: 'Invalid tier' }, { status: 400 })
    }

    const supabase = await createClient()
    
    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    // Get user's restaurant
    const { data: staffData, error: staffError } = await supabase
      .from('restaurant_staff')
      .select('restaurant_id')
      .eq('user_id', user.id)
      .single()

    if (staffError || !staffData) {
      return NextResponse.json({ error: 'Restaurant not found' }, { status: 404 })
    }

    // Update restaurant tier
    const { error: updateError } = await supabase
      .from('restaurants')
      .update({ tier })
      .eq('id', staffData.restaurant_id)

    if (updateError) {
      return NextResponse.json({ error: 'Failed to update tier' }, { status: 500 })
    }

    return NextResponse.json({ 
      success: true, 
      message: `Successfully switched to ${tier} tier` 
    })

  } catch (error) {
    console.error('Error switching tier:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
