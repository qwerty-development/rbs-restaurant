// app/api/menu/categories/route.ts
import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { searchParams } = new URL(request.url)
    const restaurantId = searchParams.get('restaurant_id')

    if (!restaurantId) {
      return NextResponse.json(
        { error: 'Restaurant ID is required' },
        { status: 400 }
      )
    }

    // Get the current user to verify they have access to this restaurant
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Verify user has access to this restaurant
    const { data: staffData, error: staffError } = await supabase
      .from('restaurant_staff')
      .select('restaurant_id')
      .eq('user_id', user.id)
      .eq('restaurant_id', restaurantId)
      .eq('is_active', true)
      .single()

    if (staffError || !staffData) {
      return NextResponse.json(
        { error: 'Access denied to this restaurant' },
        { status: 403 }
      )
    }

    // Fetch menu categories for the restaurant
    const { data: categories, error } = await supabase
      .from('menu_categories')
      .select(`
        id,
        restaurant_id,
        name,
        description,
        display_order,
        is_active,
        created_at,
        updated_at
      `)
      .eq('restaurant_id', restaurantId)
      .eq('is_active', true)
      .order('display_order', { ascending: true })

    if (error) {
      console.error('Error fetching menu categories:', error)
      return NextResponse.json(
        { error: 'Failed to fetch menu categories' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      categories: categories || [],
      count: categories?.length || 0
    })

  } catch (error) {
    console.error('Menu categories API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const body = await request.json()
    const { restaurant_id, name, description, display_order } = body

    if (!restaurant_id || !name) {
      return NextResponse.json(
        { error: 'Restaurant ID and name are required' },
        { status: 400 }
      )
    }

    // Get the current user to verify they have access to this restaurant
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Verify user has access to this restaurant
    const { data: staffData, error: staffError } = await supabase
      .from('restaurant_staff')
      .select('restaurant_id')
      .eq('user_id', user.id)
      .eq('restaurant_id', restaurant_id)
      .eq('is_active', true)
      .single()

    if (staffError || !staffData) {
      return NextResponse.json(
        { error: 'Access denied to this restaurant' },
        { status: 403 }
      )
    }

    // Create new menu category
    const { data: category, error } = await supabase
      .from('menu_categories')
      .insert({
        restaurant_id,
        name,
        description,
        display_order: display_order || 0,
        is_active: true
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating menu category:', error)
      return NextResponse.json(
        { error: 'Failed to create menu category' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      category,
      message: 'Menu category created successfully'
    }, { status: 201 })

  } catch (error) {
    console.error('Menu categories POST API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
