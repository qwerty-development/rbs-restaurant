// lib/restaurant-auth.ts
import { createClient } from '@/lib/supabase/client'




export const restaurantAuth = {
  // Restaurant staff login with enhanced validation
  async signIn(email: string, password: string) {
    const supabase = createClient()
    
    try {
      // Authenticate user
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password
      })

      if (authError) throw authError
      if (!authData.user) throw new Error('Authentication failed')

      // Check if user has restaurant access
      const { data: staffData, error: staffError }:any = await supabase
        .from('restaurant_staff')
        .select(`
          id,
          role,
          permissions,
          is_active,
          restaurant_id,
          last_login_at,
          restaurant:restaurants(*),
          user:profiles(*)
        `)
        .eq('user_id', authData.user.id)
        .eq('is_active', true)
        .single()

      if (staffError || !staffData) {
        await supabase.auth.signOut()
        throw new Error("You don't have access to any restaurant. Please contact your restaurant owner.")
      }

      // Log the login activity
      await supabase
        .from('staff_activity_log')
        .insert({
          staff_id: staffData.id,
          restaurant_id: staffData.restaurant_id,
          action_type: 'login',
          action_details: { timestamp: new Date().toISOString() }
        })

      // Update user metadata
      await supabase.auth.updateUser({
        data: {
          restaurant_id: staffData.restaurant_id,
          restaurant_name: staffData.restaurant.name,
          staff_role: staffData.role,
          staff_permissions: staffData.permissions
        }
      })

      return { user: authData.user, staff: staffData }
    } catch (error) {
      console.error('Login error:', error)
      throw error
    }
  },

  // Register new restaurant with owner
  async registerRestaurant(data: {
    restaurantName: string
    ownerName: string
    email: string
    password: string
    phone: string
    address: string
    cuisineType: string
  }) {
    const supabase = createClient()
    
    try {
      // Create user account
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: data.email,
        password: data.password,
        options: {
          data: {
            full_name: data.ownerName,
            phone_number: data.phone
          }
        }
      })

      if (authError) throw authError
      if (!authData.user) throw new Error('Failed to create user account')

      // Create restaurant
      const { data: restaurant, error: restaurantError } = await supabase
        .from('restaurants')
        .insert({
          name: data.restaurantName,
          address: data.address,
          phone_number: data.phone,
          cuisine_type: data.cuisineType,
          opening_time: '09:00',
          closing_time: '22:00',
          booking_policy: 'instant',
          status: 'active'
        })
        .select()
        .single()

      if (restaurantError) throw restaurantError

      // Create owner staff entry
      const { error: staffError } = await supabase
        .from('restaurant_staff')
        .insert({
          restaurant_id: restaurant.id,
          user_id: authData.user.id,
          role: 'owner',
          permissions: ['all'],
          is_active: true,
          created_by: authData.user.id
        })

      if (staffError) throw staffError

      // Initialize restaurant data
      await Promise.all([
        // Create default floor plan
        supabase.from('floor_plans').insert({
          restaurant_id: restaurant.id,
          name: 'Main Floor',
          is_default: true
        }),
        
        // Initialize loyalty balance if table exists
        supabase.from('restaurant_loyalty_balance').insert({
          restaurant_id: restaurant.id,
          current_balance: 10000,
          total_purchased: 10000
        }).then(() => {}, () => {}) // Ignore error if table doesn't exist
      ])

      return { user: authData.user, restaurant }
    } catch (error) {
      console.error('Registration error:', error)
      throw error
    }
  },

  // Add staff member
  async addStaffMember(restaurantId: string, staffData: {
    fullName: string
    email: string
    phoneNumber?: string
    role: 'manager' | 'staff' | 'viewer'
    permissions: string[]
  }, createdBy: string) {
    const supabase = createClient()
    
    try {
      let userId: string

      // Check if user already exists
      const { data: existingProfile } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', staffData.email)
        .single()

      if (existingProfile) {
        userId = existingProfile.id

        // Check if already a staff member
        const { data: existingStaff } = await supabase
          .from('restaurant_staff')
          .select('id')
          .eq('restaurant_id', restaurantId)
          .eq('user_id', userId)
          .single()

        if (existingStaff) {
          throw new Error('User is already a staff member')
        }
      } else {
        // Create new user account with temporary password
        const tempPassword = Math.random().toString(36).slice(-8) + 'Aa1!'
        
        const { data: authData, error: authError } = await supabase.auth.admin.createUser({
          email: staffData.email,
          password: tempPassword,
          email_confirm: true,
          user_metadata: {
            full_name: staffData.fullName,
            phone_number: staffData.phoneNumber || null
          }
        })

        if (authError) throw authError
        if (!authData.user) throw new Error('Failed to create user account')
        
        userId = authData.user.id

        // Create profile
        await supabase.from('profiles').insert({
          id: userId,
          full_name: staffData.fullName,
          phone_number: staffData.phoneNumber || null,
          email: staffData.email
        })

        // TODO: Send welcome email with temporary password
        console.log('Temporary password for', staffData.email, ':', tempPassword)
      }

      // Add staff member
      const { data: newStaff, error }:any = await supabase
        .from('restaurant_staff')
        .insert({
          restaurant_id: restaurantId,
          user_id: userId,
          role: staffData.role,
          permissions: staffData.permissions,
          is_active: true,
          created_by: createdBy
        })
        .select(`
          id,
          role,
          permissions,
          is_active,
          created_at,
          user:profiles(id, full_name, email, phone_number)
        `)
        .single()

      if (error) throw error

      // Log the activity
      await supabase
        .from('staff_activity_log')
        .insert({
          staff_id: createdBy,
          restaurant_id: restaurantId,
          action_type: 'staff_added',
          action_details: { 
            added_staff_name: staffData.fullName,
            added_staff_email: staffData.email,
            role: staffData.role
          }
        })

      return newStaff
    } catch (error) {
      console.error('Add staff error:', error)
      throw error
    }
  },

  // Update staff member
  async updateStaffMember(staffId: string, updates: {
    role?: string
    permissions?: string[]
    is_active?: boolean
  }, updatedBy: string) {
    const supabase = createClient()
    
    try {
      const { data, error }:any = await supabase
        .from('restaurant_staff')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('id', staffId)
        .select(`
          id,
          restaurant_id,
          role,
          permissions,
          is_active,
          user:profiles(full_name, email)
        `)
        .single()

      if (error) throw error

      // Log the activity
      await supabase
        .from('staff_activity_log')
        .insert({
          staff_id: updatedBy,
          restaurant_id: data.restaurant_id,
          action_type: 'staff_updated',
          action_details: { 
            updated_staff_name: data.user?.full_name,
            updates: updates
          }
        })

      return data
    } catch (error) {
      console.error('Update staff error:', error)
      throw error
    }
  },

  // Remove staff member
  async removeStaffMember(staffId: string, removedBy: string) {
    const supabase = createClient()
    
    try {
      // Get staff info before deletion
      const { data: staffInfo }:any = await supabase
        .from('restaurant_staff')
        .select(`
          restaurant_id,
          user:profiles(full_name, email)
        `)
        .eq('id', staffId)
        .single()

      const { error } = await supabase
        .from('restaurant_staff')
        .delete()
        .eq('id', staffId)

      if (error) throw error

      // Log the activity
      if (staffInfo) {
        await supabase
          .from('staff_activity_log')
          .insert({
            staff_id: removedBy,
            restaurant_id: staffInfo.restaurant_id,
            action_type: 'staff_removed',
            action_details: { 
              removed_staff_name: staffInfo.user?.full_name,
              removed_staff_email: staffInfo.user?.email
            }
          })
      }
    } catch (error) {
      console.error('Remove staff error:', error)
      throw error
    }
  },

  // Get restaurant staff
  async getRestaurantStaff(restaurantId: string) {
    const supabase = createClient()
    
    const { data, error } = await supabase
      .from('restaurant_staff')
      .select(`
        id,
        role,
        permissions,
        is_active,
        hired_at,
        last_login_at,
        created_at,
        user:profiles(id, full_name, email, phone_number, avatar_url)
      `)
      .eq('restaurant_id', restaurantId)
      .order('hired_at', { ascending: false })

    if (error) throw error
    return data
  },

  // Check if user has permission
  hasPermission(userPermissions: string[], requiredPermission: string, userRole: string): boolean {
    if (userRole === 'owner') return true
    if (userPermissions.includes('all')) return true
    return userPermissions.includes(requiredPermission)
  },

  // Get default permissions for role
  getDefaultPermissions(role: string): string[] {
    const defaults = {
      owner: ['all'],
      manager: [
        'bookings.view', 'bookings.manage',
        'menu.view', 'menu.manage',
        'tables.view', 'tables.manage',
        'customers.view', 'customers.manage',
        'analytics.view',
        'settings.view'
      ],
      staff: [
        'bookings.view', 'bookings.manage',
        'menu.view',
        'tables.view',
        'customers.view'
      ],
      viewer: [
        'bookings.view',
        'menu.view',
        'tables.view',
        'customers.view'
      ]
    }
    
    return defaults[role as keyof typeof defaults] || []
  }
}