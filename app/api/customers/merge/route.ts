import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const { targetCustomerId, sourceCustomerId, restaurantId } = await request.json()

    if (!targetCustomerId || !sourceCustomerId || !restaurantId) {
      return NextResponse.json(
        { message: 'Missing required fields' },
        { status: 400 }
      )
    }

    if (targetCustomerId === sourceCustomerId) {
      return NextResponse.json(
        { message: 'Cannot merge a customer with itself' },
        { status: 400 }
      )
    }

    const supabase = await createClient()

    // Get current user and verify permissions
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json(
        { message: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Check if user has permission to manage customers
    const { data: staffData } = await supabase
      .from('restaurant_staff')
      .select('role, permissions')
      .eq('user_id', user.id)
      .eq('restaurant_id', restaurantId)
      .eq('is_active', true)
      .single()

    if (!staffData) {
      return NextResponse.json(
        { message: 'Insufficient permissions' },
        { status: 403 }
      )
    }

    // Owners have full access, others need specific permission
    const hasPermission = staffData.role === 'owner' || staffData.permissions.includes('customers.manage')
    if (!hasPermission) {
      return NextResponse.json(
        { message: 'Insufficient permissions' },
        { status: 403 }
      )
    }

    // Fetch both customers with their profiles
    const { data: customers, error: fetchError } = await supabase
      .from('restaurant_customers')
      .select(`
        *,
        profile:profiles!restaurant_customers_user_id_fkey(*)
      `)
      .in('id', [targetCustomerId, sourceCustomerId])
      .eq('restaurant_id', restaurantId)

    if (fetchError) {
      console.error('Customer fetch error:', fetchError)
      throw fetchError
    }

    if (!customers || customers.length !== 2) {
      console.error('Customers not found. Found:', customers?.length, 'customers')
      return NextResponse.json(
        { message: 'One or both customers not found' },
        { status: 404 }
      )
    }

    const targetCustomer = customers.find((c: any) => c.id === targetCustomerId)
    const sourceCustomer = customers.find((c: any) => c.id === sourceCustomerId)

    if (!targetCustomer || !sourceCustomer) {
      console.error('Customer matching failed. Target:', !!targetCustomer, 'Source:', !!sourceCustomer)
      return NextResponse.json(
        { message: 'Customers not found' },
        { status: 404 }
      )
    }

    // Validate merge rules: cannot merge two registered users
    if (targetCustomer.user_id && sourceCustomer.user_id) {
      console.error('Cannot merge two registered users')
      return NextResponse.json(
        { message: 'Cannot merge two registered users' },
        { status: 400 }
      )
    }

    console.log('About to merge customers:', {
      targetId: targetCustomerId,
      sourceId: sourceCustomerId,
      restaurantId: restaurantId,
      targetHasUserId: !!targetCustomer.user_id,
      sourceHasUserId: !!sourceCustomer.user_id
    })

    // Use the RPC function for atomic customer merge
    const { error: mergeError } = await supabase.rpc('merge_customers', {
      p_target_customer_id: targetCustomerId,
      p_source_customer_id: sourceCustomerId,
      p_restaurant_id: restaurantId
    })

    if (mergeError) {
      console.error('RPC merge error:', mergeError)
      throw mergeError
    }

    return NextResponse.json(
      { message: 'Customers merged successfully' },
      { status: 200 }
    )

  } catch (error) {
    console.error('Error merging customers:', error)
    
    // More detailed error logging
    if (error instanceof Error) {
      console.error('Error name:', error.name)
      console.error('Error message:', error.message)
      console.error('Error stack:', error.stack)
    }
    
    return NextResponse.json(
      { message: 'Internal server error', error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

async function performManualMerge(supabase: any, targetCustomer: any, sourceCustomer: any) {
  // Combine numeric fields
  const mergedData = {
    total_bookings: targetCustomer.total_bookings + sourceCustomer.total_bookings,
    total_spent: Number(targetCustomer.total_spent) + Number(sourceCustomer.total_spent),
    no_show_count: targetCustomer.no_show_count + sourceCustomer.no_show_count,
    cancelled_count: targetCustomer.cancelled_count + sourceCustomer.cancelled_count,
    
    // Take the earliest first visit
    first_visit: targetCustomer.first_visit && sourceCustomer.first_visit 
      ? new Date(Math.min(new Date(targetCustomer.first_visit).getTime(), new Date(sourceCustomer.first_visit).getTime())).toISOString()
      : targetCustomer.first_visit || sourceCustomer.first_visit,
    
    // Take the latest last visit
    last_visit: targetCustomer.last_visit && sourceCustomer.last_visit 
      ? new Date(Math.max(new Date(targetCustomer.last_visit).getTime(), new Date(sourceCustomer.last_visit).getTime())).toISOString()
      : targetCustomer.last_visit || sourceCustomer.last_visit,
    
    // Calculate new average party size
    average_party_size: targetCustomer.total_bookings + sourceCustomer.total_bookings > 0 
      ? ((Number(targetCustomer.average_party_size) * targetCustomer.total_bookings) + 
         (Number(sourceCustomer.average_party_size) * sourceCustomer.total_bookings)) / 
        (targetCustomer.total_bookings + sourceCustomer.total_bookings)
      : 0,

    // Preserve important flags (VIP status, blacklist)
    vip_status: targetCustomer.vip_status || sourceCustomer.vip_status,
    blacklisted: targetCustomer.blacklisted || sourceCustomer.blacklisted,
    blacklist_reason: targetCustomer.blacklist_reason || sourceCustomer.blacklist_reason,

    // Merge preferences (target customer takes precedence)
    preferred_table_types: targetCustomer.preferred_table_types || sourceCustomer.preferred_table_types,
    preferred_time_slots: targetCustomer.preferred_time_slots || sourceCustomer.preferred_time_slots,

    // If target customer doesn't have contact info but source does, use source
    guest_name: targetCustomer.guest_name || sourceCustomer.guest_name,
    guest_email: targetCustomer.guest_email || sourceCustomer.guest_email,
    guest_phone: targetCustomer.guest_phone || sourceCustomer.guest_phone,

    updated_at: new Date().toISOString()
  }

  // Update target customer with merged data
  const { error: updateError } = await supabase
    .from('restaurant_customers')
    .update(mergedData)
    .eq('id', targetCustomer.id)

  if (updateError) {
    throw updateError
  }

  // Transfer related records to target customer
  
  // Transfer bookings
  const { error: bookingsError } = await supabase
    .from('bookings')
    .update({ 
      guest_name: targetCustomer.guest_name || sourceCustomer.guest_name,
      guest_email: targetCustomer.guest_email || sourceCustomer.guest_email,
      guest_phone: targetCustomer.guest_phone || sourceCustomer.guest_phone
    })
    .match({
      guest_name: sourceCustomer.guest_name,
      guest_email: sourceCustomer.guest_email,
      restaurant_id: targetCustomer.restaurant_id
    })

  if (bookingsError) {
    console.warn('Error transferring bookings:', bookingsError)
  }

  // Transfer customer notes
  const { error: notesError } = await supabase
    .from('customer_notes')
    .update({ customer_id: targetCustomer.id })
    .eq('customer_id', sourceCustomer.id)

  if (notesError) {
    console.warn('Error transferring customer notes:', notesError)
  }

  // Transfer customer tag assignments
  const { error: tagsError } = await supabase
    .from('customer_tag_assignments')
    .update({ customer_id: targetCustomer.id })
    .eq('customer_id', sourceCustomer.id)

  if (tagsError) {
    console.warn('Error transferring customer tags:', tagsError)
  }

  // Transfer customer preferences
  const { error: preferencesError } = await supabase
    .from('customer_preferences')
    .update({ customer_id: targetCustomer.id })
    .eq('customer_id', sourceCustomer.id)

  if (preferencesError) {
    console.warn('Error transferring customer preferences:', preferencesError)
  }

  // Transfer customer relationships
  const { error: relationshipsError1 } = await supabase
    .from('customer_relationships')
    .update({ customer_id: targetCustomer.id })
    .eq('customer_id', sourceCustomer.id)

  const { error: relationshipsError2 } = await supabase
    .from('customer_relationships')
    .update({ related_customer_id: targetCustomer.id })
    .eq('related_customer_id', sourceCustomer.id)

  if (relationshipsError1 || relationshipsError2) {
    console.warn('Error transferring customer relationships:', relationshipsError1 || relationshipsError2)
  }

  // Finally, delete the source customer
  const { error: deleteError } = await supabase
    .from('restaurant_customers')
    .delete()
    .eq('id', sourceCustomer.id)

  if (deleteError) {
    throw deleteError
  }
}
