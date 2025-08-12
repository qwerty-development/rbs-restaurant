// app/api/menu/items/[id]/route.ts
import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const resolvedParams = await params
    const { id } = resolvedParams

    // Get the current user to verify they have access
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Get menu item with category information
    const { data: item, error } = await supabase
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
      .eq('id', id)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Menu item not found' },
          { status: 404 }
        )
      }
      console.error('Error fetching menu item:', error)
      return NextResponse.json(
        { error: 'Failed to fetch menu item' },
        { status: 500 }
      )
    }

    // Verify user has access to this restaurant
    const { data: staffData, error: staffError } = await supabase
      .from('restaurant_staff')
      .select('restaurant_id')
      .eq('user_id', user.id)
      .eq('restaurant_id', item.restaurant_id)
      .eq('is_active', true)
      .single()

    if (staffError || !staffData) {
      return NextResponse.json(
        { error: 'Access denied to this restaurant' },
        { status: 403 }
      )
    }

    return NextResponse.json({ item })

  } catch (error) {
    console.error('Menu item GET API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const resolvedParams = await params
    const { id } = resolvedParams
    const body = await request.json()

    // Get the current user to verify they have access
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // First, get the existing menu item to verify access
    const { data: existingItem, error: fetchError } = await supabase
      .from('menu_items')
      .select('restaurant_id')
      .eq('id', id)
      .single()

    if (fetchError) {
      if (fetchError.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Menu item not found' },
          { status: 404 }
        )
      }
      return NextResponse.json(
        { error: 'Failed to fetch menu item' },
        { status: 500 }
      )
    }

    // Verify user has access to this restaurant
    const { data: staffData, error: staffError } = await supabase
      .from('restaurant_staff')
      .select('restaurant_id')
      .eq('user_id', user.id)
      .eq('restaurant_id', existingItem.restaurant_id)
      .eq('is_active', true)
      .single()

    if (staffError || !staffData) {
      return NextResponse.json(
        { error: 'Access denied to this restaurant' },
        { status: 403 }
      )
    }

    // Prepare update data
    const updateData: any = {}
    const allowedFields = [
      'name', 'description', 'price', 'image_url', 'dietary_tags', 
      'allergens', 'calories', 'preparation_time', 'is_available', 
      'is_featured', 'display_order'
    ]

    allowedFields.forEach(field => {
      if (body[field] !== undefined) {
        updateData[field] = body[field]
      }
    })

    // Convert price to number if provided
    if (updateData.price !== undefined) {
      updateData.price = parseFloat(updateData.price)
    }

    // Convert numeric fields
    if (updateData.calories !== undefined) {
      updateData.calories = updateData.calories ? parseInt(updateData.calories) : null
    }
    if (updateData.preparation_time !== undefined) {
      updateData.preparation_time = updateData.preparation_time ? parseInt(updateData.preparation_time) : null
    }

    updateData.updated_at = new Date().toISOString()

    // Update the menu item
    const { data: item, error: updateError } = await supabase
      .from('menu_items')
      .update(updateData)
      .eq('id', id)
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

    if (updateError) {
      console.error('Error updating menu item:', updateError)
      return NextResponse.json(
        { error: 'Failed to update menu item' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      item,
      message: 'Menu item updated successfully'
    })

  } catch (error) {
    console.error('Menu item PATCH API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const resolvedParams = await params
    const { id } = resolvedParams

    // Get the current user to verify they have access
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // First, get the existing menu item to verify access
    const { data: existingItem, error: fetchError } = await supabase
      .from('menu_items')
      .select('restaurant_id')
      .eq('id', id)
      .single()

    if (fetchError) {
      if (fetchError.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Menu item not found' },
          { status: 404 }
        )
      }
      return NextResponse.json(
        { error: 'Failed to fetch menu item' },
        { status: 500 }
      )
    }

    // Verify user has access to this restaurant
    const { data: staffData, error: staffError } = await supabase
      .from('restaurant_staff')
      .select('restaurant_id')
      .eq('user_id', user.id)
      .eq('restaurant_id', existingItem.restaurant_id)
      .eq('is_active', true)
      .single()

    if (staffError || !staffData) {
      return NextResponse.json(
        { error: 'Access denied to this restaurant' },
        { status: 403 }
      )
    }

    // Delete the menu item
    const { error: deleteError } = await supabase
      .from('menu_items')
      .delete()
      .eq('id', id)

    if (deleteError) {
      console.error('Error deleting menu item:', deleteError)
      return NextResponse.json(
        { error: 'Failed to delete menu item' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      message: 'Menu item deleted successfully'
    })

  } catch (error) {
    console.error('Menu item DELETE API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
