// app/api/menu/items/route.ts
import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { searchParams } = new URL(request.url)
    const restaurantId = searchParams.get('restaurant_id')
    const categoryId = searchParams.get('category_id')
    const available = searchParams.get('available')
    const featured = searchParams.get('featured')
    const search = searchParams.get('search')

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

    // Build the query
    let query = supabase
      .from('menu_items')
      .select(`
        id,
        restaurant_id,
        category_id,
        name,
        description,
        price,
        image_url,
        dietary_tags,
        allergens,
        calories,
        preparation_time,
        is_available,
        is_featured,
        display_order,
        created_at,
        updated_at,
        category:menu_categories!menu_items_category_id_fkey(
          id,
          name,
          description
        )
      `)
      .eq('restaurant_id', restaurantId)

    // Apply filters
    if (categoryId) {
      query = query.eq('category_id', categoryId)
    }

    if (available === 'true') {
      query = query.eq('is_available', true)
    }

    if (featured === 'true') {
      query = query.eq('is_featured', true)
    }

    if (search) {
      query = query.or(`name.ilike.%${search}%,description.ilike.%${search}%`)
    }

    // Order by display_order and name
    query = query.order('display_order', { ascending: true })
    query = query.order('name', { ascending: true })

    const { data: items, error } = await query

    if (error) {
      console.error('Error fetching menu items:', error)
      return NextResponse.json(
        { error: 'Failed to fetch menu items' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      items: items || [],
      count: items?.length || 0
    })

  } catch (error) {
    console.error('Menu items API error:', error)
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
    const {
      restaurant_id,
      category_id,
      name,
      description,
      price,
      image_url,
      dietary_tags,
      allergens,
      calories,
      preparation_time,
      is_available,
      is_featured,
      display_order
    } = body

    if (!restaurant_id || !category_id || !name || price === undefined) {
      return NextResponse.json(
        { error: 'Restaurant ID, category ID, name, and price are required' },
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

    // Verify the category exists and belongs to this restaurant
    const { data: categoryData, error: categoryError } = await supabase
      .from('menu_categories')
      .select('id')
      .eq('id', category_id)
      .eq('restaurant_id', restaurant_id)
      .single()

    if (categoryError || !categoryData) {
      return NextResponse.json(
        { error: 'Invalid category ID' },
        { status: 400 }
      )
    }

    // Create new menu item
    const { data: item, error } = await supabase
      .from('menu_items')
      .insert({
        restaurant_id,
        category_id,
        name,
        description,
        price: parseFloat(price),
        image_url,
        dietary_tags: dietary_tags || [],
        allergens: allergens || [],
        calories: calories ? parseInt(calories) : null,
        preparation_time: preparation_time ? parseInt(preparation_time) : null,
        is_available: is_available !== false,
        is_featured: is_featured === true,
        display_order: display_order || 0
      })
      .select(`
        id,
        restaurant_id,
        category_id,
        name,
        description,
        price,
        image_url,
        dietary_tags,
        allergens,
        calories,
        preparation_time,
        is_available,
        is_featured,
        display_order,
        created_at,
        updated_at,
        category:menu_categories!menu_items_category_id_fkey(
          id,
          name,
          description
        )
      `)
      .single()

    if (error) {
      console.error('Error creating menu item:', error)
      return NextResponse.json(
        { error: 'Failed to create menu item' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      item,
      message: 'Menu item created successfully'
    }, { status: 201 })

  } catch (error) {
    console.error('Menu items POST API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
